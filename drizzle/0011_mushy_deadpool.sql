CREATE TABLE `ingredient_group_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `evening_answers` ADD `group_id` text;--> statement-breakpoint
ALTER TABLE `evening_checks` ADD `grouped` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `morning_tasks` ADD `group_id` text;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `group_id` text;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `group_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `group_source` text;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `group_updated_at` text;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `group_updated_by` text;
--> statement-breakpoint
DROP TRIGGER stock_valid_update;
--> statement-breakpoint
CREATE TRIGGER stock_valid_update BEFORE UPDATE ON stock_items WHEN NEW.included NOT IN (0,1) OR NEW.track NOT IN (0,1) OR (NEW.included=0 AND NEW.track=1) OR NEW.revision<OLD.revision OR NEW.group_revision<OLD.group_revision OR (NEW.revision=OLD.revision AND NEW.group_revision=OLD.group_revision)
BEGIN SELECT RAISE(ABORT,'invalid_stock_state'); END;
