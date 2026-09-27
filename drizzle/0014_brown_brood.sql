CREATE TABLE `operating_calendar_versions` (
	`revision` integer PRIMARY KEY NOT NULL,
	`effective_day` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`operation_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operating_calendar_versions_operation_id_unique` ON `operating_calendar_versions` (`operation_id`);--> statement-breakpoint
CREATE INDEX `operating_calendar_effective` ON `operating_calendar_versions` (`effective_day`,`revision`);--> statement-breakpoint
CREATE TABLE `operating_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operating_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`check_id` text NOT NULL,
	`item_id` text NOT NULL,
	`version` integer NOT NULL,
	`outcome` text NOT NULL,
	`note` text NOT NULL,
	`reported_ready_at` text,
	`supersedes_id` text,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `operating_outcomes_task` ON `operating_outcomes` (`check_id`,`item_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `evening_checks` ADD `calendar_revision` integer;--> statement-breakpoint
CREATE TRIGGER operating_calendar_no_update BEFORE UPDATE ON operating_calendar_versions BEGIN SELECT RAISE(ABORT,'calendar_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER operating_calendar_no_delete BEFORE DELETE ON operating_calendar_versions BEGIN SELECT RAISE(ABORT,'calendar_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER operating_outcome_no_update BEFORE UPDATE ON operating_outcomes BEGIN SELECT RAISE(ABORT,'outcome_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER operating_outcome_no_delete BEFORE DELETE ON operating_outcomes BEGIN SELECT RAISE(ABORT,'outcome_is_append_only'); END;
