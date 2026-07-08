const { v4: uuidv4 } = require('uuid');
const { getEventsContainer } = require('../config/cosmos');
const { ServiceError } = require('./auth.service');

const ALLOWED_CATEGORIES = ['CONFERENCE', 'WORKSHOP', 'MEETUP', 'NETWORKING', 'SEMINAR', 'CONCERT', 'SPORTS', 'OTHER'];

const VALID_TRANSITIONS = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

function isValidISO(value) {
  if (!value) return false;
  const d = new Date(value);
  return d instanceof Date && !isNaN(d.getTime());
}

async function createEvent(organizerId, data) {
  const { title, description, category, location, startDate, endDate, registrationDeadline, capacity } = data;

  if (!title || !title.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Title is required.', 400);
  }
  if (!description || !description.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Description is required.', 400);
  }
  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    throw new ServiceError('VALIDATION_ERROR', `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`, 400);
  }
  if (!location || !location.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Location is required.', 400);
  }
  if (!startDate || !isValidISO(startDate)) {
    throw new ServiceError('INVALID_DATES', 'A valid start date is required.', 400);
  }
  if (!endDate || !isValidISO(endDate)) {
    throw new ServiceError('INVALID_DATES', 'A valid end date is required.', 400);
  }
  if (!registrationDeadline || !isValidISO(registrationDeadline)) {
    throw new ServiceError('INVALID_DATES', 'A valid registration deadline is required.', 400);
  }
  if (new Date(endDate) <= new Date(startDate)) {
    throw new ServiceError('INVALID_DATES', 'End date must be after start date.', 400);
  }
  if (new Date(registrationDeadline) >= new Date(startDate)) {
    throw new ServiceError('INVALID_DATES', 'Registration deadline must be before start date.', 400);
  }
  const parsedCapacity = parseInt(capacity, 10);
  if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
    throw new ServiceError('INVALID_CAPACITY', 'Capacity must be a positive integer.', 400);
  }

  const now = new Date().toISOString();
  const eventId = uuidv4();

  const eventDoc = {
    id: eventId,
    organizerId,
    title: title.trim(),
    description: description.trim(),
    category,
    location: location.trim(),
    startDate,
    endDate,
    registrationDeadline,
    capacity: parsedCapacity,
    registrationCount: 0,
    status: 'DRAFT',
    materials: [],
    createdAt: now,
    updatedAt: now
  };

  const container = getEventsContainer();
  await container.items.create(eventDoc);

  return eventDoc;
}

async function getPublishedEvents(filters = {}) {
  const container = getEventsContainer();
  const conditions = ['c.status = "PUBLISHED"'];
  const parameters = [];

  if (filters.category) {
    conditions.push('c.category = @category');
    parameters.push({ name: '@category', value: filters.category });
  }
  if (filters.location) {
    conditions.push('CONTAINS(c.location, @location, true)');
    parameters.push({ name: '@location', value: filters.location });
  }
  if (filters.search) {
    conditions.push('(CONTAINS(c.title, @search, true) OR CONTAINS(c.description, @search, true))');
    parameters.push({ name: '@search', value: filters.search });
  }
  if (filters.upcoming === 'true' || filters.upcoming === true) {
    conditions.push('c.startDate > @now');
    parameters.push({ name: '@now', value: new Date().toISOString() });
  }

  const query = {
    query: `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.startDate ASC`,
    parameters
  };

  const { resources: events } = await container.items.query(query).fetchAll();
  return events;
}

async function getEventById(eventId, requestingUser) {
  const container = getEventsContainer();
  const { resource: event } = await container.item(eventId, eventId).read();

  if (!event) {
    throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
  }

  if (event.status === 'PUBLISHED' || event.status === 'COMPLETED') {
    return event;
  }

  if (requestingUser && event.organizerId === requestingUser.userId) {
    return event;
  }

  throw new ServiceError('EVENT_NOT_FOUND', 'Event not found.', 404);
}

async function getOrganizerEvents(organizerId) {
  const container = getEventsContainer();
  const { resources: events } = await container.items
    .query({
      query: 'SELECT * FROM c WHERE c.organizerId = @organizerId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@organizerId', value: organizerId }]
    })
    .fetchAll();

  return events;
}

function validateChanges(changes) {
  const forbidden = ['id', 'organizerId', 'registrationCount', 'createdAt'];
  const attempted = Object.keys(changes).filter((k) => forbidden.includes(k));

  if (attempted.length > 0) {
    throw new ServiceError(
      'VALIDATION_ERROR',
      `Cannot modify read-only fields: ${attempted.join(', ')}.`,
      400
    );
  }

  if (changes.title !== undefined && !changes.title.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Title must not be empty.', 400);
  }
  if (changes.description !== undefined && !changes.description.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Description must not be empty.', 400);
  }
  if (changes.category !== undefined && !ALLOWED_CATEGORIES.includes(changes.category)) {
    throw new ServiceError('VALIDATION_ERROR', `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`, 400);
  }
  if (changes.location !== undefined && !changes.location.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'Location must not be empty.', 400);
  }
  if (changes.startDate !== undefined && !isValidISO(changes.startDate)) {
    throw new ServiceError('INVALID_DATES', 'A valid start date is required.', 400);
  }
  if (changes.endDate !== undefined && !isValidISO(changes.endDate)) {
    throw new ServiceError('INVALID_DATES', 'A valid end date is required.', 400);
  }
  if (changes.registrationDeadline !== undefined && !isValidISO(changes.registrationDeadline)) {
    throw new ServiceError('INVALID_DATES', 'A valid registration deadline is required.', 400);
  }
  if (changes.capacity !== undefined) {
    const parsedCapacity = parseInt(changes.capacity, 10);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      throw new ServiceError('INVALID_CAPACITY', 'Capacity must be a positive integer.', 400);
    }
  }
}

async function updateEvent(event, changes) {
  if (event.status === 'COMPLETED' || event.status === 'CANCELLED') {
    throw new ServiceError('EVENT_ALREADY_FINALIZED', 'Cannot update a completed or cancelled event.', 400);
  }

  validateChanges(changes);

  const updatedStart = changes.startDate || event.startDate;
  const updatedEnd = changes.endDate || event.endDate;
  const updatedDeadline = changes.registrationDeadline || event.registrationDeadline;

  if (updatedStart && updatedEnd && new Date(updatedEnd) <= new Date(updatedStart)) {
    throw new ServiceError('INVALID_DATES', 'End date must be after start date.', 400);
  }
  if (updatedDeadline && updatedStart && new Date(updatedDeadline) >= new Date(updatedStart)) {
    throw new ServiceError('INVALID_DATES', 'Registration deadline must be before start date.', 400);
  }

  const updatedEvent = {
    ...event,
    ...changes,
    capacity: changes.capacity !== undefined ? parseInt(changes.capacity, 10) : event.capacity,
    updatedAt: new Date().toISOString()
  };

  const container = getEventsContainer();
  await container.item(event.id, event.id).replace(updatedEvent);

  return updatedEvent;
}

async function publishEvent(event) {
  if (event.status !== 'DRAFT') {
    throw new ServiceError(
      'EVENT_ALREADY_FINALIZED',
      'Only DRAFT events can be published.',
      400
    );
  }

  const missing = [];
  if (!event.title || !event.title.trim()) missing.push('title');
  if (!event.description || !event.description.trim()) missing.push('description');
  if (!event.category) missing.push('category');
  if (!event.location || !event.location.trim()) missing.push('location');
  if (!event.startDate || !isValidISO(event.startDate)) missing.push('startDate');
  if (!event.endDate || !isValidISO(event.endDate)) missing.push('endDate');
  if (!event.registrationDeadline || !isValidISO(event.registrationDeadline)) missing.push('registrationDeadline');
  if (!event.capacity || parseInt(event.capacity, 10) <= 0) missing.push('capacity');

  if (missing.length > 0) {
    throw new ServiceError(
      'INCOMPLETE_EVENT_FOR_PUBLISH',
      `Cannot publish event. Missing or invalid fields: ${missing.join(', ')}.`,
      400
    );
  }

  if (new Date(event.endDate) <= new Date(event.startDate)) {
    throw new ServiceError('INVALID_DATES', 'End date must be after start date.', 400);
  }
  if (new Date(event.registrationDeadline) >= new Date(event.startDate)) {
    throw new ServiceError('INVALID_DATES', 'Registration deadline must be before start date.', 400);
  }

  const updatedEvent = {
    ...event,
    status: 'PUBLISHED',
    updatedAt: new Date().toISOString()
  };

  const container = getEventsContainer();
  await container.item(event.id, event.id).replace(updatedEvent);

  return updatedEvent;
}

async function cancelEvent(event) {
  if (!VALID_TRANSITIONS[event.status] || !VALID_TRANSITIONS[event.status].includes('CANCELLED')) {
    throw new ServiceError(
      'EVENT_ALREADY_FINALIZED',
      `Cannot cancel an event with status "${event.status}".`,
      400
    );
  }

  const updatedEvent = {
    ...event,
    status: 'CANCELLED',
    updatedAt: new Date().toISOString()
  };

  const container = getEventsContainer();
  await container.item(event.id, event.id).replace(updatedEvent);

  return updatedEvent;
}

module.exports = {
  createEvent,
  getPublishedEvents,
  getEventById,
  getOrganizerEvents,
  updateEvent,
  publishEvent,
  cancelEvent,
  ServiceError
};
