const { CosmosClient } = require('@azure/cosmos');
const logger = require('../utils/logger');
const config = require('./env');

let usersContainer;
let eventsContainer;
let registrationsContainer;
let notificationsContainer;

async function connectCosmos() {
  const client = new CosmosClient(config.COSMOS_CONNECTION_STRING);
  const database = client.database(config.COSMOS_DATABASE_NAME);
  usersContainer = database.container(config.COSMOS_USERS_CONTAINER);
  eventsContainer = database.container(config.COSMOS_EVENTS_CONTAINER);
  registrationsContainer = database.container(config.COSMOS_REGISTRATIONS_CONTAINER);
  notificationsContainer = database.container(config.COSMOS_NOTIFICATIONS_CONTAINER);

  try {
    await database.read();
    logger.info('Connected to Cosmos DB database');
  } catch (err) {
    logger.error('Failed to connect to Cosmos DB:', err.message);
    throw err;
  }

  return { usersContainer, eventsContainer, registrationsContainer, notificationsContainer };
}

function getUsersContainer() {
  if (!usersContainer) {
    throw new Error('Cosmos DB not initialized. Call connectCosmos() first.');
  }
  return usersContainer;
}

function getEventsContainer() {
  if (!eventsContainer) {
    throw new Error('Cosmos DB not initialized. Call connectCosmos() first.');
  }
  return eventsContainer;
}

function getRegistrationsContainer() {
  if (!registrationsContainer) {
    throw new Error('Cosmos DB not initialized. Call connectCosmos() first.');
  }
  return registrationsContainer;
}

function getNotificationsContainer() {
  if (!notificationsContainer) {
    throw new Error('Cosmos DB not initialized. Call connectCosmos() first.');
  }
  return notificationsContainer;
}

module.exports = { connectCosmos, getUsersContainer, getEventsContainer, getRegistrationsContainer, getNotificationsContainer };
