-- Tracking may be enabled without prepared frequency; preserve every existing row.
DROP TRIGGER round_default_on_track;
--> statement-breakpoint
DROP TRIGGER round_stock_timeline;
--> statement-breakpoint
CREATE TRIGGER round_stock_timeline AFTER UPDATE OF included,track,round_id ON stock_items
WHEN (OLD.included!=NEW.included OR OLD.track!=NEW.track OR OLD.round_id IS NOT NEW.round_id)
 AND EXISTS(SELECT 1 FROM round_state)
BEGIN
 INSERT INTO round_timeline(item_id,round_id,days,schedule_revision,active,recorded_at,source,actor)
 SELECT NEW.item_id,NEW.round_id,coalesce(r.days,'[]'),coalesce(r.revision,0),NEW.included*NEW.track,strftime('%Y-%m-%dT%H:%M:%fZ','now'),
 coalesce((SELECT NEW.round_source WHERE OLD.round_id IS NOT NEW.round_id),'stock-settings'),coalesce((SELECT substr(NEW.round_source,7) WHERE OLD.round_id IS NOT NEW.round_id AND NEW.round_source LIKE 'owner:%'),(SELECT NEW.round_source WHERE OLD.round_id IS NOT NEW.round_id AND NEW.round_source LIKE 'system:%'),NEW.updated_by) FROM (SELECT 1) LEFT JOIN check_rounds r ON r.id=NEW.round_id;
END;
