CREATE TABLE `industry_checks` (
	`domain` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `industry_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`first_seen` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `industry_events_source_key_unique` ON `industry_events` (`source_key`);