const { v4: uuidv4 } = require('uuid');
const { getEventsContainer, getRegistrationsContainer, getUsersContainer } = require('../config/cosmos');
const { ServiceError } = require('./auth.service');

const VALID_ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'NOT_MARKED'];

/*
 * Note on concurrency:
 * Duplicate prevention, capacity enforcement, and registrationCount updates use
 * application-level checks and sequential Cosmos DB operations. They are NOT
 * concurrency-safe under simultaneous requests — two requests could race and
 * both pass capacity or duplicate checks before either writes. Full distributed
 * transaction handling (e.g., Cosmos DB transactional batches or stored procedures)
 * is out of scope for this MVP.
 */

async function registerForEvent(eventId, userId, userRole) {
  if (userRole !== 'ATTENDEE') {
    throw new ServiceError(
      'FORBIDDEN_ORGANIZER_CANNOT_REGISTER',
      'Only attendees can register for events.',
      403
    );
  }

  const eventsContainer = getEventsContainer();
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  if (event.status !== 'PUBLISHED') {
    throw new ServiceError('EVENT_NOT_PUBLISHED', 'Event is not open for registration.', 400);
  }

  const now = new Date();
  if (now > new Date(event.registrationDeadline)) {
    throw new ServiceError('REGISTRATION_CLOSED', 'Registration deadline has passed.', 400);
  }

  if (now > new Date(event.startDate)) {
    throw new ServiceError('EVENT_ALREADY_STARTED', 'Event has already started.', 400);
  }

  const registrationsContainer = getRegistrationsContainer();
  const { resources: existing } = await registrationsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.eventId = @eventId AND c.userId = @userId AND c.status = @status',
      parameters: [
        { name: '@eventId', value: eventId },
        { name: '@userId', value: userId },
        { name: '@status', value: 'REGISTERED' }
      ]
    })
    .fetchAll();

  if (existing.length > 0) {
    throw new ServiceError('ALREADY_REGISTERED', 'You are already registered for this event.', 409);
  }

  if (event.registrationCount >= event.capacity) {
    throw new ServiceError('EVENT_FULL', 'Event has reached maximum capacity.', 400);
  }

  const registrationDoc = {
    id: uuidv4(),
    eventId,
    userId,
    status: 'REGISTERED',
    attendanceStatus: 'NOT_MARKED',
    registeredAt: new Date().toISOString(),
    cancelledAt: null
  };

  await registrationsContainer.items.create(registrationDoc);

  // Increment registrationCount on the event.
  // If this fails after the registration doc was created, clean up the orphan.
  try {
    const updatedEvent = {
      ...event,
      registrationCount: event.registrationCount + 1,
      updatedAt: new Date().toISOString()
    };
    await eventsContainer.item(event.id, event.id).replace(updatedEvent);
  } catch (err) {
    // Rollback: delete the orphaned registration doc
    try {
      await registrationsContainer.item(registrationDoc.id, eventId).delete();
    } catch (cleanupErr) {
      console.error('Failed to clean up orphaned registration:', cleanupErr.message);
    }
    throw new ServiceError(
      'INTERNAL_ERROR',
      'Registration count update failed. Registration was not completed.',
      500
    );
  }

  return registrationDoc;
}

async function cancelRegistration(eventId, userId) {
  const eventsContainer = getEventsContainer();
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  const registrationsContainer = getRegistrationsContainer();
  const { resources: existing } = await registrationsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.eventId = @eventId AND c.userId = @userId',
      parameters: [
        { name: '@eventId', value: eventId },
        { name: '@userId', value: userId }
      ]
    })
    .fetchAll();

  if (existing.length === 0) {
    throw new ServiceError('REGISTRATION_NOT_FOUND', 'No registration found for this event.', 404);
  }

  const registration = existing[0];

  if (registration.status === 'CANCELLED') {
    throw new ServiceError('ALREADY_CANCELLED', 'Registration is already cancelled.', 400);
  }

  if (new Date() > new Date(event.startDate)) {
    throw new ServiceError('EVENT_ALREADY_STARTED', 'Cannot cancel registration after event has started.', 400);
  }

  const now = new Date().toISOString();
  registration.status = 'CANCELLED';
  registration.cancelledAt = now;

  await registrationsContainer.item(registration.id, eventId).replace(registration);

  // Decrement registrationCount on the event, never below 0.
  // If this fails, attempt rollback of the registration status.
  try {
    const newCount = Math.max(0, event.registrationCount - 1);
    const updatedEvent = {
      ...event,
      registrationCount: newCount,
      updatedAt: now
    };
    await eventsContainer.item(event.id, event.id).replace(updatedEvent);
  } catch (err) {
    // Rollback: restore registration to REGISTERED
    try {
      registration.status = 'REGISTERED';
      registration.cancelledAt = null;
      await registrationsContainer.item(registration.id, eventId).replace(registration);
    } catch (rollbackErr) {
      console.error('Failed to rollback cancelled registration:', rollbackErr.message);
    }
    throw new ServiceError(
      'INTERNAL_ERROR',
      'Registration count update failed. Please try again.',
      500
    );
  }

  return registration;
}

async function getMyRegistrations(userId) {
  /*
   * Note: This is a cross-partition query because registrations are partitioned
   * by eventId, but we're querying by userId. This is an accepted tradeoff for
   * this project's scale. For higher-volume scenarios, consider a separate
   * user-partitioned container or a fan-out pattern.
   */
  const registrationsContainer = getRegistrationsContainer();
  const eventsContainer = getEventsContainer();

  const { resources: registrations } = await registrationsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.status = @status ORDER BY c.registeredAt DESC',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@status', value: 'REGISTERED' }
      ]
    })
    .fetchAll();

  const enriched = await Promise.all(
    registrations.map(async (reg) => {
      try {
        const { resource: event } = await eventsContainer.item(reg.eventId, reg.eventId).read();
        return {
          registrationId: reg.id,
          eventId: reg.eventId,
          status: reg.status,
          attendanceStatus: reg.attendanceStatus,
          registeredAt: reg.registeredAt,
          event: event
            ? {
                title: event.title,
                description: event.description,
                category: event.category,
                location: event.location,
                startDate: event.startDate,
                endDate: event.endDate,
                capacity: event.capacity
              }
            : null
        };
      } catch {
        return {
          registrationId: reg.id,
          eventId: reg.eventId,
          status: reg.status,
          attendanceStatus: reg.attendanceStatus,
          registeredAt: reg.registeredAt,
          event: null
        };
      }
    })
  );

  return enriched;
}

async function getEventAttendees(eventId, organizerId) {
  const eventsContainer = getEventsContainer();
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  if (event.organizerId !== organizerId) {
    throw new ServiceError('FORBIDDEN_NOT_OWNER', 'You do not own this event.', 403);
  }

  // Query the eventId partition for all registrations
  const registrationsContainer = getRegistrationsContainer();
  const { resources: registrations } = await registrationsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.eventId = @eventId',
      parameters: [{ name: '@eventId', value: eventId }]
    })
    .fetchAll();

  const usersContainer = getUsersContainer();
  const attendees = await Promise.all(
    registrations.map(async (reg) => {
      try {
        const { resource: user } = await usersContainer.item(reg.userId, reg.userId).read();
        return {
          userId: reg.userId,
          name: user ? user.name : 'Unknown',
          email: user ? user.email : 'Unknown',
          registrationId: reg.id,
          registrationStatus: reg.status,
          attendanceStatus: reg.attendanceStatus,
          registeredAt: reg.registeredAt
        };
      } catch {
        return {
          userId: reg.userId,
          name: 'Unknown',
          email: 'Unknown',
          registrationId: reg.id,
          registrationStatus: reg.status,
          attendanceStatus: reg.attendanceStatus,
          registeredAt: reg.registeredAt
        };
      }
    })
  );

  return attendees;
}

async function markAttendance(eventId, registrationId, organizerId, attendanceStatus) {
  if (!VALID_ATTENDANCE_STATUSES.includes(attendanceStatus)) {
    throw new ServiceError(
      'VALIDATION_ERROR',
      `Attendance status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}.`,
      400
    );
  }

  const eventsContainer = getEventsContainer();
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  if (event.organizerId !== organizerId) {
    throw new ServiceError('FORBIDDEN_NOT_OWNER', 'You do not own this event.', 403);
  }

  // Point-read using eventId as partition key
  const registrationsContainer = getRegistrationsContainer();
  const { resource: registration } = await registrationsContainer.item(registrationId, eventId).read();

  if (!registration) {
    throw new ServiceError('REGISTRATION_NOT_FOUND', 'Registration not found.', 404);
  }

  registration.attendanceStatus = attendanceStatus;
  await registrationsContainer.item(registration.id, eventId).replace(registration);

  return registration;
}

module.exports = {
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
  getEventAttendees,
  markAttendance
};
