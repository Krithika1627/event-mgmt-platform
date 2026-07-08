import client from './client';

export const registerForEvent = (eventId) =>
  client.post(`/events/${eventId}/register`).then((r) => r.data);

export const cancelRegistration = (eventId) =>
  client.delete(`/events/${eventId}/register`).then((r) => r.data);

export const getMyRegistrations = () =>
  client.get('/me/registrations').then((r) => r.data);

export const getEventAttendees = (eventId) =>
  client.get(`/events/${eventId}/attendees`).then((r) => r.data);

export const markAttendance = (eventId, registrationId, status) =>
  client.patch(`/events/${eventId}/registrations/${registrationId}/attendance`, {
    attendanceStatus: status
  }).then((r) => r.data);
