CREATE TABLE `review_import_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`archive_id` text NOT NULL,
	`part` integer NOT NULL,
	`payload` text NOT NULL
);
