const formatTimestamp = () => new Date().toISOString();

const logger = {
  info(msg, ...args) {
    console.log(`[${formatTimestamp()}] [INFO] ${msg}`, ...args);
  },
  warn(msg, ...args) {
    console.warn(`[${formatTimestamp()}] [WARN] ${msg}`, ...args);
  },
  error(msg, ...args) {
    console.error(`[${formatTimestamp()}] [ERROR] ${msg}`, ...args);
  }
};

module.exports = logger;
