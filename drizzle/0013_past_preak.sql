ALTER TABLE `stock_items` ADD `round_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DROP TRIGGER stock_valid_update;
--> statement-breakpoint
CREATE TRIGGER stock_valid_update BEFORE UPDATE ON stock_items WHEN NEW.included NOT IN (0,1) OR NEW.track NOT IN (0,1) OR (NEW.included=0 AND NEW.track=1) OR NEW.revision<OLD.revision OR NEW.group_revision<OLD.group_revision OR NEW.round_revision<OLD.round_revision OR (NEW.revision=OLD.revision AND NEW.group_revision=OLD.group_revision AND NEW.round_revision=OLD.round_revision)
BEGIN SELECT RAISE(ABORT,'invalid_stock_state'); END;
