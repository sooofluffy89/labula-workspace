CREATE TABLE `review_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_authority` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`payload` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviewed_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`payload` text NOT NULL,
	`notebook_revision` integer NOT NULL,
	`effective` text NOT NULL,
	`approval_id` text NOT NULL
);
