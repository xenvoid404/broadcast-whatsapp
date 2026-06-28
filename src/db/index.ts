import { envConfig } from '@/config.js';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as schema from './schema.js';

const DATA_DIR = join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const client = new Database(join(DATA_DIR, envConfig.db.name));
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');

export const db = drizzle(client, { schema });
