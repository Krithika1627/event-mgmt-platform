// Initialize Application Insights before any other application module.
// This is optional: if the connection string is not set, it logs a warning
// and continues without monitoring.
require('dotenv').config();

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();
  console.log(`[${new Date().toISOString()}] [INFO] Application Insights initialized`);
} else {
  console.log(`[${new Date().toISOString()}] [WARN] APPLICATIONINSIGHTS_CONNECTION_STRING not set — monitoring disabled`);
}

const config = require('./src/config/env');
const { connectCosmos } = require('./src/config/cosmos');
const app = require('./src/app');
const logger = require('./src/utils/logger');

async function start() {
  try {
    await connectCosmos();
  } catch (err) {
    logger.error('Failed to initialize Cosmos DB. Exiting.');
    process.exit(1);
  }

  app.listen(config.PORT, () => {
    logger.info(`Server listening on port ${config.PORT}`);
  });
}

start();
