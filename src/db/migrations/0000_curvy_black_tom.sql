CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`source_group_name` text DEFAULT '' NOT NULL,
	`is_sent` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` integer DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_url_unique` ON `links` (`url`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_jid` text NOT NULL,
	`text` text NOT NULL,
	`attachment` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_at` integer NOT NULL,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` integer DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` integer DEFAULT (CURRENT_TIMESTAMP)
);
