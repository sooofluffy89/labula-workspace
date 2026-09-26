CREATE TABLE `check_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`days` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `round_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `round_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`activated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `round_timeline` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`round_id` text,
	`days` text NOT NULL,
	`schedule_revision` integer NOT NULL,
	`active` integer NOT NULL,
	`recorded_at` text NOT NULL,
	`source` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `round_timeline_item` ON `round_timeline` (`item_id`,`seq`);--> statement-breakpoint
ALTER TABLE `evening_answers` ADD `round_snapshot` text;--> statement-breakpoint
ALTER TABLE `evening_checks` ADD `rounds_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `round_id` text;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `round_source` text;--> statement-breakpoint
CREATE TRIGGER round_default_on_track AFTER UPDATE OF included,track ON stock_items
WHEN NEW.included=1 AND NEW.track=1 AND NEW.round_id IS NULL AND EXISTS(SELECT 1 FROM round_state)
BEGIN
 UPDATE stock_items SET round_revision=round_revision+1,round_id='daily',round_source='system:daily-default' WHERE item_id=NEW.item_id AND round_id IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER round_stock_timeline AFTER UPDATE OF included,track,round_id ON stock_items
WHEN (OLD.included!=NEW.included OR OLD.track!=NEW.track OR OLD.round_id IS NOT NEW.round_id)
 AND EXISTS(SELECT 1 FROM round_state) AND NOT(NEW.included=1 AND NEW.track=1 AND NEW.round_id IS NULL)
BEGIN
 INSERT INTO round_timeline(item_id,round_id,days,schedule_revision,active,recorded_at,source,actor)
 SELECT NEW.item_id,NEW.round_id,coalesce(r.days,'[]'),coalesce(r.revision,0),NEW.included*NEW.track,strftime('%Y-%m-%dT%H:%M:%fZ','now'),
 coalesce((SELECT NEW.round_source WHERE OLD.round_id IS NOT NEW.round_id),'stock-settings'),coalesce((SELECT substr(NEW.round_source,7) WHERE OLD.round_id IS NOT NEW.round_id AND NEW.round_source LIKE 'owner:%'),(SELECT NEW.round_source WHERE OLD.round_id IS NOT NEW.round_id AND NEW.round_source LIKE 'system:%'),NEW.updated_by) FROM (SELECT 1) LEFT JOIN check_rounds r ON r.id=NEW.round_id;
END;
--> statement-breakpoint
CREATE TRIGGER round_stock_revision AFTER UPDATE ON stock_items
BEGIN UPDATE round_state SET revision=revision+1 WHERE id='kitchen'; END;
--> statement-breakpoint
CREATE TRIGGER round_stock_insert AFTER INSERT ON stock_items
BEGIN UPDATE round_state SET revision=revision+1 WHERE id='kitchen'; END;
--> statement-breakpoint
CREATE TRIGGER round_schedule_timeline AFTER UPDATE OF days ON check_rounds
WHEN OLD.days!=NEW.days
BEGIN
 INSERT INTO round_timeline(item_id,round_id,days,schedule_revision,active,recorded_at,source,actor)
 SELECT item_id,NEW.id,NEW.days,NEW.revision,included*track,NEW.updated_at,'schedule',NEW.updated_by FROM stock_items WHERE round_id=NEW.id;
 UPDATE round_state SET revision=revision+1 WHERE id='kitchen';
END;
