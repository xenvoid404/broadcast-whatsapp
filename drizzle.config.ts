import { defineConfig } from 'drizzle-kit';

try {
    process.loadEnvFile();
} catch {}

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: process.env.DB_URL as string,
    },
});
