/**
 * Seed script — creates 3 sample DRAFT events for a given organizer email.
 *
 * Usage: node scripts/seedEvents.js <organizerEmail>
 *
 * Note: This script does not check for duplicates. Re-running will create
 * additional events with the same data. Delete them via the API as needed.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { connectCosmos, getUsersContainer, getEventsContainer } = require('../src/config/cosmos');
const { v4: uuidv4 } = require('uuid');

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

async function seed() {
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error('Usage: node scripts/seedEvents.js <organizerEmail>');
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(emailArg);

  await connectCosmos();

  const usersContainer = getUsersContainer();
  const { resources: users } = await usersContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: normalizedEmail }]
    })
    .fetchAll();

  if (users.length === 0) {
    console.error(`No user found with email "${normalizedEmail}".`);
    process.exit(1);
  }

  const organizer = users[0];
  if (organizer.role !== 'ORGANIZER') {
    console.error(`User "${normalizedEmail}" has role "${organizer.role}", not ORGANIZER.`);
    process.exit(1);
  }

  console.log(`Found organizer: ${organizer.name} (${organizer.email})`);

  const now = new Date();
  const day = (offset) => new Date(now.getTime() + offset * 24 * 60 * 60 * 1000).toISOString();

  const sampleEvents = [
    {
      title: 'Cloud Architecture Workshop',
      description: 'A hands-on workshop covering modern cloud architecture patterns, microservices, and serverless computing with Azure.',
      category: 'WORKSHOP',
      location: 'San Francisco, CA',
      startDate: day(30),
      endDate: day(31),
      registrationDeadline: day(25),
      capacity: 100,
      materialUrls: []
    },
    {
      title: 'Tech Networking Mixer',
      description: 'An evening networking event for engineers, product managers, and tech leaders to connect and share ideas.',
      category: 'NETWORKING',
      location: 'New York, NY',
      startDate: day(14),
      endDate: day(14),
      registrationDeadline: day(10),
      capacity: 200,
      materialUrls: []
    },
    {
      title: 'Annual Developers Conference',
      description: 'Our flagship conference featuring keynotes, breakout sessions, and hands-on labs across multiple tracks.',
      category: 'CONFERENCE',
      location: 'Austin, TX',
      startDate: day(60),
      endDate: day(63),
      registrationDeadline: day(55),
      capacity: 500,
      materialUrls: []
    }
  ];

  const eventsContainer = getEventsContainer();
  const createdIds = [];

  for (const eventData of sampleEvents) {
    const doc = {
      id: uuidv4(),
      organizerId: organizer.id,
      ...eventData,
      registrationCount: 0,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await eventsContainer.items.create(doc);
    createdIds.push({ id: doc.id, title: doc.title });
    console.log(`Created event: "${doc.title}" (${doc.id})`);
  }

  console.log(`\nSeeded ${createdIds.length} DRAFT events for organizer "${normalizedEmail}".`);
  console.log('Re-running this script will create additional duplicates.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
