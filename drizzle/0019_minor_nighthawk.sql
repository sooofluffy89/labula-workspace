CREATE TABLE `user_photo_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`before_revision` integer NOT NULL,
	`after_revision` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_photo_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`object_key` text,
	`sha256` text,
	`size` integer,
	`fingerprint` text NOT NULL,
	`state` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_photos` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`object_key` text,
	`sha256` text,
	`size` integer,
	`updated_at` text NOT NULL
);
