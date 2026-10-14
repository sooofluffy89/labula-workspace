CREATE TABLE `catalog_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`request` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`before_revision` integer NOT NULL,
	`after_revision` integer NOT NULL,
	`before_payload` text NOT NULL,
	`after_payload` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL,
	`retired_id` text,
	`undo_of` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_operations_after_revision_unique` ON `catalog_operations` (`after_revision`);--> statement-breakpoint
CREATE TABLE `kitchen_owner` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL
);
