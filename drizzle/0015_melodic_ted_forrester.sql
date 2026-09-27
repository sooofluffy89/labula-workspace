CREATE TABLE `prep_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`check_id` text NOT NULL,
	`item_id` text NOT NULL,
	`catalog_id` text NOT NULL,
	`version` integer NOT NULL,
	`instruction_revision` integer,
	`phase` text NOT NULL,
	`text` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL,
	`client_at` text
);
--> statement-breakpoint
CREATE INDEX `prep_feedback_service` ON `prep_feedback` (`check_id`,`item_id`,`catalog_id`);--> statement-breakpoint
CREATE INDEX `prep_feedback_catalog` ON `prep_feedback` (`catalog_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `prep_instruction_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`text` text NOT NULL,
	`revision` integer NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prep_instruction_revision` ON `prep_instruction_versions` (`item_id`,`revision`);--> statement-breakpoint
CREATE TABLE `prep_instructions` (
	`item_id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`actor_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prep_note_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `evening_answers` ADD `instruction_snapshot` text;--> statement-breakpoint
ALTER TABLE `morning_tasks` ADD `instruction_snapshot` text;--> statement-breakpoint
CREATE TRIGGER prep_feedback_no_update BEFORE UPDATE ON prep_feedback BEGIN SELECT RAISE(ABORT,'prep_feedback_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER prep_feedback_no_delete BEFORE DELETE ON prep_feedback BEGIN SELECT RAISE(ABORT,'prep_feedback_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER prep_instruction_history_no_update BEFORE UPDATE ON prep_instruction_versions BEGIN SELECT RAISE(ABORT,'prep_instruction_history_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER prep_instruction_history_no_delete BEFORE DELETE ON prep_instruction_versions BEGIN SELECT RAISE(ABORT,'prep_instruction_history_is_append_only'); END;
