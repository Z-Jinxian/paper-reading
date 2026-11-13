CREATE TABLE `paper_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paper_topics_name_key_unique` ON `paper_topics` (`name_key`);