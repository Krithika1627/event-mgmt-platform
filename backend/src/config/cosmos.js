const { CosmosClient } = require('@azure/cosmos');
const logger = require('../utils/logger');
const config = require('./env');

let usersContainer;
let eventsContainer;

async function connectCosmos() {
  const client = new CosmosClient(config.COSMOS_CONNECTION_STRING);
  const database = client.database(config.COSMOS_DATABASE_NAME);
  usersContainer = database.container(config.COSMOS_USERS_CONTAINER);
  eventsContainer = database.container(config.COSMOS_EVENTS_CONTAINER);

  try {
    await database.read();
    logger.info('Connected to Cosmos DB database');
  } catch (err) {
    logger.error('Failed to connect to Cosmos DB:', err.message);
    throw err;
  }

  return { usersContainer, eventsContainer };
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

module.exports = { connectCosmos, getUsersContainer, getEventsContainer };
