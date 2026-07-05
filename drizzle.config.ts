import { defineConfig } from 'drizzle-kit';

try {
    process.loadEnvFile();
} catch {}

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: 'file:./data/6281219171144.db',
    },
});
