CREATE TABLE `notebook_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`actor_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`before_revision` integer NOT NULL,
	`after_revision` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notebook_commands_after_revision_unique` ON `notebook_commands` (`after_revision`);