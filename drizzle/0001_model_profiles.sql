CREATE TABLE `model_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`model` text NOT NULL,
	`sealed_key` text,
	`updated_at` text NOT NULL
);
