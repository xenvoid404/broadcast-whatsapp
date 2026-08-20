export const env = {
  app: {
    number: process.env.APP_NUMBER || 'changeme',
    method: process.env.APP_METHOD || 'pairing',
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
  db: {
    url: process.env.DB_URL || 'file:./data/sqlite.db',
    name: process.env.DB_NAME || 'sqlite.db',
  },
};
