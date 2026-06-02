export const envConfig = {
    app: {
        number: process.env.APP_NUMBER || '628123456789',
    },
    log: {
        level: process.env.LOG_LEVEL || 'debug',
    },
    db: {
        database: process.env.DB_DATABASE || 'sqlite.db',
    },
};
