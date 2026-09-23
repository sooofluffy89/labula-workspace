CREATE TABLE `evening_answers` (
	`check_id` text NOT NULL,
	`item_id` text NOT NULL,
	`catalog_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`value` text,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`first_actor` text,
	`first_device` text,
	`first_sequence` integer,
	PRIMARY KEY(`check_id`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `evening_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`target_day` text NOT NULL,
	`plan_day` text,
	`stage` text NOT NULL,
	`revision` integer NOT NULL,
	`plan_revision` integer NOT NULL,
	`version` integer NOT NULL,
	`start_operation` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`confirmed_at` text,
	`confirmed_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evening_checks_plan_day_unique` ON `evening_checks` (`plan_day`);--> statement-breakpoint
CREATE TABLE `evening_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`result` text NOT NULL,
	`applied` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evening_versions` (
	`check_id` text NOT NULL,
	`version` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`check_id`, `version`)
);
--> statement-breakpoint
CREATE TABLE `morning_tasks` (
	`check_id` text NOT NULL,
	`item_id` text NOT NULL,
	`catalog_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`ready` integer NOT NULL,
	`cancelled` integer NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`check_id`, `item_id`)
);
