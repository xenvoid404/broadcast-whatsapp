import { envConfig } from '@/config';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db: Database.Database = new Database(join(DATA_DIR, envConfig.db.database));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
