import { logger } from '@/lib/logger';
import { db } from './index';

logger.info('⏳ Memulai pembuatan schema database...');

db.exec(`
--> statement-breakpoint
CREATE TABLE configs (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	start integer DEFAULT 8 NOT NULL,
	end integer DEFAULT 22 NOT NULL,
	link_threshold integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE sessions (
	id text PRIMARY KEY NOT NULL,
	data text NOT NULL
);
--> statement-breakpoint
CREATE TABLE messages (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	text text NOT NULL,
	image text
);
--> statement-breakpoint
CREATE TABLE links (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	url text NOT NULL,
	sender_name text DEFAULT '' NOT NULL,
	source_group_name text DEFAULT '' NOT NULL,
	collected_at text NOT NULL,
	is_sent integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE schedules (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	group_jid text NOT NULL,
	scheduled_time text NOT NULL,
	scheduled_date text NOT NULL,
	status text DEFAULT 'pending' NOT NULL,
	sent_at text
);
--> statement-breakpoint
CREATE UNIQUE INDEX links_url_unique ON links (url);
`);

logger.info('✅ Schema database berhasil dibuat');
