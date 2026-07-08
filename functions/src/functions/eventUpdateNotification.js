const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

/*
 * Event Update Notification Azure Function
 * HTTP trigger. Accepts { eventId, subject, message, recipients: [{ userId, email }] }.
 * Sends an email to each recipient, creating a notification doc per recipient
 * with SENT or FAILED status.
 */
app.http('eventUpdateNotification', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('eventUpdateNotification triggered');

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, body: 'Invalid JSON body.' };
    }

    const { eventId, subject, message, recipients } = body;
    if (!eventId || !subject || !message || !Array.isArray(recipients) || recipients.length === 0) {
      return { status: 400, body: 'Missing required fields: eventId, subject, message, recipients.' };
    }

    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseName = process.env.COSMOS_DATABASE_NAME;
    const notificationsContainerName = process.env.COSMOS_NOTIFICATIONS_CONTAINER;

    if (!connectionString || !databaseName) {
      context.error('Missing Cosmos DB configuration.');
      return { status: 500, body: 'Server configuration error.' };
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseName);
    const notificationsContainer = database.container(notificationsContainerName);

    // Create transporter once
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const results = [];

    for (const recipient of recipients) {
      if (!recipient.userId || !recipient.email) {
        context.warn('Skipping invalid recipient:', JSON.stringify(recipient));
        continue;
      }

      // Create notification doc
      const notificationDoc = {
        id: uuidv4(),
        userId: recipient.userId,
        eventId,
        type: 'EVENT_UPDATE',
        subject,
        status: 'PENDING',
        errorMessage: null,
        createdAt: new Date().toISOString(),
        sentAt: null
      };

      try {
        await notificationsContainer.items.create(notificationDoc);
      } catch (createErr) {
        context.error('Failed to create notification doc:', createErr.message);
        results.push({ userId: recipient.userId, status: 'FAILED', error: 'Failed to create notification record.' });
        continue;
      }

      // Send email
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: recipient.email,
          subject: subject,
          text: message
        });

        notificationDoc.status = 'SENT';
        notificationDoc.sentAt = new Date().toISOString();
        await notificationsContainer.item(notificationDoc.id, recipient.userId).replace(notificationDoc);
        results.push({ userId: recipient.userId, status: 'SENT' });
        context.log(`Update email sent to ${recipient.email}.`);
      } catch (err) {
        context.error(`Failed to send email to ${recipient.email}:`, err.message);

        notificationDoc.status = 'FAILED';
        notificationDoc.errorMessage = err.message;
        try {
          await notificationsContainer.item(notificationDoc.id, recipient.userId).replace(notificationDoc);
        } catch (updateErr) {
          context.error('Failed to update notification status:', updateErr.message);
        }
        results.push({ userId: recipient.userId, status: 'FAILED', error: err.message });
      }
    }

    return {
      status: 200,
      body: JSON.stringify({ sent: results.filter((r) => r.status === 'SENT').length, failed: results.filter((r) => r.status === 'FAILED').length, results })
    };
  }
});
