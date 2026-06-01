export const envConfig = {
    log: {
        level: process.env.LOG_LEVEL || 'debug',
    },
    db: {
        database: process.env.DB_DATABASE || 'sqlite.db',
    },
};
