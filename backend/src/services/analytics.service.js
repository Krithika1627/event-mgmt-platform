const { getEventsContainer, getRegistrationsContainer, getUsersContainer } = require('../config/cosmos');
const { ServiceError } = require('./auth.service');

/*
 * getOverview(organizerId)
 * Returns aggregated analytics across all events owned by the organizer.
 *
 * Registrations are partitioned by /eventId. To avoid unnecessary cross-partition
 * queries, we query each event's partition individually and aggregate client-side.
 * This is a valid pattern at this project's scale.
 */
async function getOverview(organizerId) {
  const eventsContainer = getEventsContainer();
  const registrationsContainer = getRegistrationsContainer();
  const usersContainer = getUsersContainer();

  // 1. Fetch all events for this organizer
  const { resources: events } = await eventsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.organizerId = @organizerId',
      parameters: [{ name: '@organizerId', value: organizerId }]
    })
    .fetchAll();

  const totalEvents = events.length;

  if (totalEvents === 0) {
    return {
      totalEvents: 0,
      totalRegistrations: 0,
      totalAttendance: 0,
      averageAttendanceRate: 0,
      mostPopularEvent: null,
      registrationsOverTime: [],
      demographics: { ageGroups: {}, genders: {} },
      popularityRanking: []
    };
  }

  // 2. Fetch registrations per event using the eventId partition key
  const registrationPromises = events.map(async (event) => {
    const { resources: regs } = await registrationsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.eventId = @eventId',
        parameters: [{ name: '@eventId', value: event.id }]
      })
      .fetchAll();
    return regs;
  });

  const regResults = await Promise.all(registrationPromises);

  // Flatten all registrations
  const allRegistrations = [];
  for (const regs of regResults) {
    for (const reg of regs) {
      allRegistrations.push(reg);
    }
  }

  // Only count active (REGISTERED) registrations
  const activeRegistrations = allRegistrations.filter((r) => r.status === 'REGISTERED');
  const totalRegistrations = activeRegistrations.length;

  // 3. Attendance
  const totalAttendance = activeRegistrations.filter((r) => r.attendanceStatus === 'PRESENT').length;
  const averageAttendanceRate = totalRegistrations > 0
    ? parseFloat(((totalAttendance / totalRegistrations) * 100).toFixed(2))
    : 0;

  // 4. Popularity ranking
  const popularityRanking = events
    .map((e) => ({
      eventId: e.id,
      title: e.title,
      registrationCount: e.registrationCount
    }))
    .sort((a, b) => b.registrationCount - a.registrationCount);

  // 5. Most popular event
  const mostPopularEvent = popularityRanking.length > 0 ? popularityRanking[0] : null;

  // 6. Registrations over time (by YYYY-MM-DD)
  const dateMap = {};
  for (const reg of activeRegistrations) {
    const date = reg.registeredAt ? reg.registeredAt.split('T')[0] : null;
    if (date) {
      dateMap[date] = (dateMap[date] || 0) + 1;
    }
  }
  const registrationsOverTime = Object.entries(dateMap)
    .map(([date, registrations]) => ({ date, registrations }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 7. Demographics — fetch each attendee's ageGroup and gender
  const userIds = [...new Set(activeRegistrations.map((r) => r.userId))];
  const ageGroups = {};
  const genders = {};

  if (userIds.length > 0) {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { resource: user } = await usersContainer.item(userId, userId).read();
          if (user) {
            if (user.ageGroup) {
              ageGroups[user.ageGroup] = (ageGroups[user.ageGroup] || 0) + 1;
            }
            if (user.gender) {
              genders[user.gender] = (genders[user.gender] || 0) + 1;
            }
          }
        } catch {
          // User not found — skip silently
        }
      })
    );
  }

  return {
    totalEvents,
    totalRegistrations,
    totalAttendance,
    averageAttendanceRate,
    mostPopularEvent,
    registrationsOverTime,
    demographics: { ageGroups, genders },
    popularityRanking
  };
}

/*
 * getEventAnalytics(eventId, organizerId)
 * Returns the same analytics shape scoped to a single event.
 * Validates ownership before computing aggregates.
 */
async function getEventAnalytics(eventId, organizerId) {
  const eventsContainer = getEventsContainer();
  const registrationsContainer = getRegistrationsContainer();
  const usersContainer = getUsersContainer();

  // Verify event exists and belongs to this organizer
  const { resource: event } = await eventsContainer.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  if (event.organizerId !== organizerId) {
    throw new ServiceError('FORBIDDEN_NOT_OWNER', 'You do not own this event.', 403);
  }

  // Fetch registrations for this eventId partition
  const { resources: allRegs } = await registrationsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.eventId = @eventId',
      parameters: [{ name: '@eventId', value: eventId }]
    })
    .fetchAll();

  const activeRegistrations = allRegs.filter((r) => r.status === 'REGISTERED');
  const totalRegistrations = activeRegistrations.length;

  // Attendance
  const totalAttendance = activeRegistrations.filter((r) => r.attendanceStatus === 'PRESENT').length;
  const averageAttendanceRate = totalRegistrations > 0
    ? parseFloat(((totalAttendance / totalRegistrations) * 100).toFixed(2))
    : 0;

  // Registrations over time
  const dateMap = {};
  for (const reg of activeRegistrations) {
    const date = reg.registeredAt ? reg.registeredAt.split('T')[0] : null;
    if (date) {
      dateMap[date] = (dateMap[date] || 0) + 1;
    }
  }
  const registrationsOverTime = Object.entries(dateMap)
    .map(([date, registrations]) => ({ date, registrations }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Demographics
  const userIds = [...new Set(activeRegistrations.map((r) => r.userId))];
  const ageGroups = {};
  const genders = {};

  if (userIds.length > 0) {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { resource: user } = await usersContainer.item(userId, userId).read();
          if (user) {
            if (user.ageGroup) ageGroups[user.ageGroup] = (ageGroups[user.ageGroup] || 0) + 1;
            if (user.gender) genders[user.gender] = (genders[user.gender] || 0) + 1;
          }
        } catch {
          // Skip
        }
      })
    );
  }

  return {
    totalEvents: 1,
    totalRegistrations,
    totalAttendance,
    averageAttendanceRate,
    mostPopularEvent: { eventId: event.id, title: event.title, registrationCount: event.registrationCount },
    registrationsOverTime,
    demographics: { ageGroups, genders },
    popularityRanking: [
      { eventId: event.id, title: event.title, registrationCount: event.registrationCount }
    ]
  };
}

module.exports = { getOverview, getEventAnalytics };
