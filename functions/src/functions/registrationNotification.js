const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const nodemailer = require('nodemailer');

/*
 * Registration Notification Azure Function
 * HTTP trigger. Accepts { userId, eventId, notificationId }.
 * Fetches user and event details from Cosmos, sends an email via SMTP,
 * then updates the notification document to SENT or FAILED.
 */
app.http('registrationNotification', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('registrationNotification triggered');

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, body: 'Invalid JSON body.' };
    }

    const { userId, eventId, notificationId } = body;
    if (!userId || !eventId || !notificationId) {
      return { status: 400, body: 'Missing required fields: userId, eventId, notificationId.' };
    }

    // Initialize Cosmos client
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseName = process.env.COSMOS_DATABASE_NAME;
    const notificationsContainerName = process.env.COSMOS_NOTIFICATIONS_CONTAINER;
    const usersContainerName = process.env.COSMOS_USERS_CONTAINER;
    const eventsContainerName = process.env.COSMOS_EVENTS_CONTAINER;

    if (!connectionString || !databaseName) {
      context.error('Missing Cosmos DB configuration.');
      return { status: 500, body: 'Server configuration error.' };
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseName);
    const notificationsContainer = database.container(notificationsContainerName);
    const usersContainer = database.container(usersContainerName);
    const eventsContainer = database.container(eventsContainerName);

    try {
      // Fetch user and event details
      const { resource: user } = await usersContainer.item(userId, userId).read();
      if (!user) {
        context.error(`User ${userId} not found.`);
        await updateNotifStatus(notificationsContainer, notificationId, userId, 'FAILED', 'User not found.');
        return { status: 404, body: 'User not found.' };
      }

      const { resource: event } = await eventsContainer.item(eventId, eventId).read();
      if (!event) {
        context.error(`Event ${eventId} not found.`);
        await updateNotifStatus(notificationsContainer, notificationId, userId, 'FAILED', 'Event not found.');
        return { status: 404, body: 'Event not found.' };
      }

      // Send email via SMTP
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: `Registration Confirmed: ${event.title}`,
        text: [
          `Hello ${user.name},`,
          '',
          `You are registered for "${event.title}".`,
          '',
          `Date: ${event.startDate}`,
          `Location: ${event.location}`,
          '',
          'We look forward to seeing you there!',
          '',
          '— Event Management Platform'
        ].join('\n')
      };

      await transporter.sendMail(mailOptions);
      context.log(`Confirmation email sent to ${user.email} for event "${event.title}".`);

      await updateNotifStatus(notificationsContainer, notificationId, userId, 'SENT', null);
      return { status: 200, body: 'Notification sent successfully.' };
    } catch (error) {
      context.error('Registration notification failed:', error);
      try {
        await updateNotifStatus(notificationsContainer, notificationId, userId, 'FAILED', error.message);
      } catch (updateErr) {
        context.error('Failed to update notification status:', updateError.message);
      }
      return { status: 500, body: 'Failed to send notification.' };
    }
  }
});

async function updateNotifStatus(container, notificationId, userId, status, errorMessage) {
  const { resource: notification } = await container.item(notificationId, userId).read();
  if (!notification) return;

  notification.status = status;
  notification.errorMessage = errorMessage || null;
  if (status === 'SENT') {
    notification.sentAt = new Date().toISOString();
  }
  await container.item(notification.id, userId).replace(notification);
}
