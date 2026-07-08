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
