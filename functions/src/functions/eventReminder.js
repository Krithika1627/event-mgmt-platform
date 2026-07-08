const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

/*
 * Event Reminder Azure Function
 * Timer trigger — runs hourly for demo (schedule: "0 0 * * * *").
 * In production, daily ("0 0 * * *") is more appropriate.
 *
 * Queries PUBLISHED events starting within the next 24 hours, finds their
 * active registrations, checks no REMINDER notification already exists for
 * that user+event combo, sends reminder emails, and records notification docs.
 *
 * Duplicate prevention: queries for existing REMINDER notifications for each
 * user+event pair and skips if one already exists.
 */
app.timer('eventReminder', {
  schedule: '0 0 * * * *',
  handler: async (myTimer, context) => {
    context.log('eventReminder triggered');

    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseName = process.env.COSMOS_DATABASE_NAME;
    const eventsContainerName = process.env.COSMOS_EVENTS_CONTAINER;
    const registrationsContainerName = process.env.COSMOS_REGISTRATIONS_CONTAINER;
    const notificationsContainerName = process.env.COSMOS_NOTIFICATIONS_CONTAINER;
    const usersContainerName = process.env.COSMOS_USERS_CONTAINER;

    if (!connectionString || !databaseName) {
      context.error('Missing Cosmos DB configuration.');
      return;
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseName);
    const eventsContainer = database.container(eventsContainerName);
    const registrationsContainer = database.container(registrationsContainerName);
    const notificationsContainer = database.container(notificationsContainerName);
    const usersContainer = database.container(usersContainerName);

    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
      // Find PUBLISHED events starting within the next 24 hours
      const { resources: upcomingEvents } = await eventsContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.status = @status AND c.startDate >= @now AND c.startDate <= @soon',
          parameters: [
            { name: '@status', value: 'PUBLISHED' },
            { name: '@now', value: now.toISOString() },
            { name: '@soon', value: twentyFourHoursLater.toISOString() }
          ]
        })
        .fetchAll();

      context.log(`Found ${upcomingEvents.length} upcoming events for reminders.`);

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      for (const event of upcomingEvents) {
        // Get active registrations for this event
        const { resources: registrations } = await registrationsContainer.items
          .query({
            query: 'SELECT * FROM c WHERE c.eventId = @eventId AND c.status = @status',
            parameters: [
              { name: '@eventId', value: event.id },
              { name: '@status', value: 'REGISTERED' }
            ]
          })
          .fetchAll();

        for (const reg of registrations) {
          // Check if a REMINDER notification already exists for this user+event
          const { resources: existingReminders } = await notificationsContainer.items
            .query({
              query: 'SELECT * FROM c WHERE c.userId = @userId AND c.eventId = @eventId AND c.type = @type',
              parameters: [
                { name: '@userId', value: reg.userId },
                { name: '@eventId', value: event.id },
                { name: '@type', value: 'EVENT_REMINDER' }
              ]
            })
            .fetchAll();

          if (existingReminders.length > 0) {
            context.log(`Reminder already sent for user ${reg.userId} / event ${event.id}. Skipping.`);
            continue;
          }

          // Fetch user details
          let user;
          try {
            const { resource: userResource } = await usersContainer.item(reg.userId, reg.userId).read();
            user = userResource;
          } catch {
            context.warn(`User ${reg.userId} not found. Skipping reminder.`);
            continue;
          }

          if (!user || !user.email) {
            context.warn(`User ${reg.userId} has no email. Skipping reminder.`);
            continue;
          }

          // Create notification doc
          const notificationDoc = {
            id: uuidv4(),
            userId: reg.userId,
            eventId: event.id,
            type: 'EVENT_REMINDER',
            subject: `Reminder: ${event.title} starts soon!`,
            status: 'PENDING',
            errorMessage: null,
            createdAt: new Date().toISOString(),
            sentAt: null
          };

          try {
            await notificationsContainer.items.create(notificationDoc);
          } catch (createErr) {
            context.error('Failed to create reminder notification doc:', createErr.message);
            continue;
          }

          // Send email
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_FROM,
              to: user.email,
              subject: notificationDoc.subject,
              text: [
                `Hello ${user.name},`,
                '',
                `This is a reminder that "${event.title}" starts soon!`,
                '',
                `Date: ${event.startDate}`,
                `Location: ${event.location}`,
                '',
                'We look forward to seeing you there!',
                '',
                '— Event Management Platform'
              ].join('\n')
            });

            notificationDoc.status = 'SENT';
            notificationDoc.sentAt = new Date().toISOString();
            await notificationsContainer.item(notificationDoc.id, reg.userId).replace(notificationDoc);
            context.log(`Reminder sent to ${user.email} for event "${event.title}".`);
          } catch (err) {
            context.error(`Failed to send reminder to ${user.email}:`, err.message);
            notificationDoc.status = 'FAILED';
            notificationDoc.errorMessage = err.message;
            try {
              await notificationsContainer.item(notificationDoc.id, reg.userId).replace(notificationDoc);
            } catch (updateErr) {
              context.error('Failed to update reminder notification status:', updateErr.message);
            }
          }
        }
      }

      context.log('eventReminder completed.');
    } catch (err) {
      context.error('eventReminder failed:', err.message);
    }
  }
});
