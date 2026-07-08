const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getNotificationsContainer, getEventsContainer, getRegistrationsContainer } = require('../config/cosmos');
const { ServiceError } = require('./auth.service');
const config = require('../config/env');
const logger = require('../utils/logger');

async function createNotification({ userId, eventId, type, subject }) {
  const container = getNotificationsContainer();
  const doc = {
    id: uuidv4(),
    userId,
    eventId,
    type,
    subject,
    status: 'PENDING',
    errorMessage: null,
    createdAt: new Date().toISOString(),
    sentAt: null
  };

  await container.items.create(doc);
  return doc;
}

async function updateNotificationStatus(notificationId, userId, status, errorMessage) {
  const container = getNotificationsContainer();
  const { resource: notification } = await container.item(notificationId, userId).read();

  if (!notification) {
    logger.error(`Notification ${notificationId} not found for status update.`);
    return;
  }

  notification.status = status;
  notification.errorMessage = errorMessage || null;
  if (status === 'SENT') {
    notification.sentAt = new Date().toISOString();
  }

  await container.item(notification.id, userId).replace(notification);
}

async function triggerRegistrationNotification(userId, eventId) {
  const notification = await createNotification({
    userId,
    eventId,
    type: 'REGISTRATION_CONFIRMATION',
    subject: 'Registration Confirmation'
  });

  // Fire-and-forget: do not await to avoid blocking the registration response
  triggerFunctionAsync(config.REGISTRATION_NOTIFICATION_FUNCTION_URL, {
    userId,
    eventId,
    notificationId: notification.id
  });

  return notification;
}

async function triggerEventUpdateNotification(eventId, organizerId, subject, message) {
  const registrationsContainer = getRegistrationsContainer();
  const { resources: registrations } = await registrationsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.eventId = @eventId AND c.status = @status',
      parameters: [
        { name: '@eventId', value: eventId },
        { name: '@status', value: 'REGISTERED' }
      ]
    })
    .fetchAll();

  if (registrations.length === 0) {
    throw new ServiceError(
      'VALIDATION_ERROR',
      'No active registrations for this event.',
      400
    );
  }

  // Build recipient list — fetch user profiles for names/emails
  const { getUsersContainer } = require('../config/cosmos');
  const usersContainer = getUsersContainer();
  const recipients = await Promise.all(
    registrations.map(async (reg) => {
      try {
        const { resource: user } = await usersContainer.item(reg.userId, reg.userId).read();
        return user ? { userId: reg.userId, email: user.email } : null;
      } catch {
        return null;
      }
    })
  );
  const validRecipients = recipients.filter(Boolean);

  const payload = {
    eventId,
    subject,
    message,
    recipients: validRecipients
  };

  triggerFunctionAsync(config.EVENT_UPDATE_NOTIFICATION_FUNCTION_URL, payload);

  return { recipientCount: validRecipients.length };
}

function triggerFunctionAsync(url, body) {
  // Intentionally not awaited — notification failures must not block the caller.
  axios.post(url, body).catch((err) => {
    logger.error('Failed to trigger notification function:', err.message);
  });
}

module.exports = {
  createNotification,
  updateNotificationStatus,
  triggerRegistrationNotification,
  triggerEventUpdateNotification
};
