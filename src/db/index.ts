import { config } from '@/config';
import { logger } from '@/lib/logger';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db: Database.Database = new Database(join(DATA_DIR, config.dbName));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb(): void {
    try {
        logger.info('⏳ Membuat schema database...');
        db.exec(`
            CREATE TABLE IF NOT EXISTS configs (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                start          INTEGER NOT NULL DEFAULT 8,
                end            INTEGER NOT NULL DEFAULT 22,
                link_threshold INTEGER NOT NULL DEFAULT 5
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id   TEXT PRIMARY KEY NOT NULL,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                text  TEXT NOT NULL,
                image TEXT
            );

            CREATE TABLE IF NOT EXISTS links (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                url               TEXT NOT NULL UNIQUE,
                sender_name       TEXT NOT NULL DEFAULT '',
                source_group_name TEXT NOT NULL DEFAULT '',
                collected_at      TEXT NOT NULL,
                is_sent           INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS schedules (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                group_jid      TEXT NOT NULL,
                scheduled_time TEXT NOT NULL,
                scheduled_date TEXT NOT NULL,
                status         TEXT NOT NULL DEFAULT 'pending',
                sent_at        TEXT
            );
            
            INSERT OR IGNORE INTO configs (
                id, start, end, link_threshold
            )
            VALUES (
                1, 18, 22, 5
            );
            
            INSERT OR IGNORE INTO messages (
                id, text
            )
            VALUES (
                1, 'p'
            );
        `);
        logger.info('📂 Schema database siap');
    } catch (err) {
        logger.error({ err }, '❌ Gagal inisialisasi tabel database');
        process.exit(1);
    }
}

initDb();
