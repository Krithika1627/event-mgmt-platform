/**
 * Seed script — registers a handful of attendees against published events.
 *
 * Usage: node scripts/seedRegistrations.js <organizerEmail>
 *
 * This script:
 * 1. Finds the organizer by email
 * 2. Finds their published events
 * 3. Creates 3 attendee accounts (if they don't exist)
 * 4. Registers each attendee against each published event
 *
 * Re-running will create duplicate attendees and duplicate registrations.
 * The script does not check for existing registrations.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { connectCosmos, getUsersContainer, getEventsContainer, getRegistrationsContainer } = require('../src/config/cosmos');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

const ATTENDEE_SAMPLES = [
  { name: 'Alice Wang', email: 'alice@example.com', ageGroup: '18_25', gender: 'female' },
  { name: 'Bob Martinez', email: 'bob@example.com', ageGroup: '26_35', gender: 'male' },
  { name: 'Carol Chen', email: 'carol@example.com', ageGroup: '36_50', gender: 'female' }
];

async function seed() {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error('Usage: node scripts/seedRegistrations.js <organizerEmail>');
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(emailArg);

  await connectCosmos();

  // --- Find organizer ---
  const usersContainer = getUsersContainer();
  const { resources: organizers } = await usersContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: normalizedEmail }]
    })
    .fetchAll();

  if (organizers.length === 0) {
    console.error(`No user found with email "${normalizedEmail}".`);
    process.exit(1);
  }

  const organizer = organizers[0];
  if (organizer.role !== 'ORGANIZER') {
    console.error(`User "${normalizedEmail}" has role "${organizer.role}", not ORGANIZER.`);
    process.exit(1);
  }

  console.log(`Found organizer: ${organizer.name} (${organizer.email})`);

  // --- Find published events ---
  const eventsContainer = getEventsContainer();
  const { resources: events } = await eventsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.organizerId = @organizerId AND c.status = @status',
      parameters: [
        { name: '@organizerId', value: organizer.id },
        { name: '@status', value: 'PUBLISHED' }
      ]
    })
    .fetchAll();

  if (events.length === 0) {
    console.error('No published events found. Run seedEvents.js first and publish via the API.');
    process.exit(1);
  }

  console.log(`Found ${events.length} published event(s):`);
  events.forEach((e) => console.log(`  - ${e.title} (${e.id})`));

  // --- Create or find attendee accounts ---
  const attendeeIds = [];

  for (const sample of ATTENDEE_SAMPLES) {
    const sampleEmail = normalizeEmail(sample.email);
    const { resources: existing } = await usersContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.email = @email',
        parameters: [{ name: '@email', value: sampleEmail }]
      })
      .fetchAll();

    if (existing.length > 0) {
      console.log(`Found existing attendee: ${existing[0].name} (${existing[0].email})`);
      attendeeIds.push(existing[0].id);
    } else {
      const userId = uuidv4();
      const passwordHash = await bcrypt.hash('password123', 10);
      const doc = {
        id: userId,
        name: sample.name,
        email: sampleEmail,
        passwordHash,
        role: 'ATTENDEE',
        ageGroup: sample.ageGroup,
        gender: sample.gender,
        createdAt: new Date().toISOString()
      };
      await usersContainer.items.create(doc);
      console.log(`Created attendee: ${sample.name} (${sampleEmail}) — password: password123`);
      attendeeIds.push(userId);
    }
  }

  // --- Register attendees against events ---
  const registrationsContainer = getRegistrationsContainer();
  let totalRegistrations = 0;

  for (const event of events) {
    for (const attendeeId of attendeeIds) {
      const regDoc = {
        id: uuidv4(),
        eventId: event.id,
        userId: attendeeId,
        status: 'REGISTERED',
        attendanceStatus: 'NOT_MARKED',
        registeredAt: new Date().toISOString(),
        cancelledAt: null
      };

      await registrationsContainer.items.create(regDoc);

      // Increment registrationCount on the event
      event.registrationCount += 1;
      event.updatedAt = new Date().toISOString();
      await eventsContainer.item(event.id, event.id).replace(event);

      totalRegistrations++;
      console.log(`  Registered attendee ${attendeeId} for "${event.title}"`);
    }
  }

  console.log(`\nSeeded ${totalRegistrations} registrations across ${events.length} event(s).`);
  console.log('Re-running this script will create additional duplicate registrations.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
