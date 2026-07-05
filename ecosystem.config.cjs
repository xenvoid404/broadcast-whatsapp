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
            APP_METHOD: 'pairing',
            APP_NUMBER: '6281392842481',
            LOG_LEVEL: 'info',
            DB_URL: 'file:./data/6281392842481.db',
            DB_NAME: '6281392842481.db',
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
            APP_METHOD: 'pairing',
            APP_NUMBER: '6285135391938',
            LOG_LEVEL: 'info',
            DB_URL: 'file:./data/6285135391938.db',
            DB_NAME: '6285135391938.db',
        },
    },
    {
        name: 'bc3',
        script: './dist/index.js',
        interpreter: 'node',
        watch: false,
        autorestart: true,
        restart_delay: 5000,
        max_restarts: 10,
        env: {
            NODE_ENV: 'production',
            TZ: 'Asia/Jakarta',
            APP_METHOD: 'pairing',
            APP_NUMBER: '6281219171144',
            LOG_LEVEL: 'info',
            DB_URL: 'file:./data/6281219171144.db',
            DB_NAME: '6281219171144.db',
        },
    },
];

module.exports = { apps };
