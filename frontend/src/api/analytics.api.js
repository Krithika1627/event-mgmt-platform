import client from './client';

export const getOverview = () =>
  client.get('/analytics/overview').then((r) => r.data);

export const getEventAnalytics = (eventId) =>
  client.get(`/analytics/events/${eventId}`).then((r) => r.data);
