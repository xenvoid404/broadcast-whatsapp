'use strict';

/** @type {import('pm2').StartOptions[]} */
const apps = [
    {
        name: 'bc1',
        script: './dist/index.js',
        interpreter: 'node',
        watch: false,
        autorestart: true,
        restart_delay: 5000,
        max_restarts: 10,
        env: {
            NODE_ENV: 'production',
            TZ: 'Asia/Jakarta',
            APP_NUMBER: '6281392842481',
            DB_NAME: '6281392842481.db',
            LOG_LEVEL: 'info',
        },
    },
    {
        name: 'bc2',
        script: './dist/index.js',
        interpreter: 'node',
        watch: false,
        autorestart: true,
        restart_delay: 5000,
        max_restarts: 10,
        env: {
            NODE_ENV: 'production',
            TZ: 'Asia/Jakarta',
            APP_NUMBER: '6281219171144',
            DB_NAME: '6281219171144.db',
            LOG_LEVEL: 'info',
        },
    },
];

module.exports = { apps };
