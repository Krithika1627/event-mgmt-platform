import client from './client';

export const getPublishedEvents = (filters = {}) =>
  client.get('/events', { params: filters }).then((r) => r.data);

export const getEventById = (id) =>
  client.get(`/events/${id}`).then((r) => r.data);

export const createEvent = (data) =>
  client.post('/events', data).then((r) => r.data);

export const updateEvent = (id, data) =>
  client.patch(`/events/${id}`, data).then((r) => r.data);

export const publishEvent = (id) =>
  client.patch(`/events/${id}/status`, { status: 'PUBLISHED' }).then((r) => r.data);

export const cancelEvent = (id) =>
  client.delete(`/events/${id}`).then((r) => r.data);

export const getOrganizerEvents = () =>
  client.get('/organizer/events').then((r) => r.data);
