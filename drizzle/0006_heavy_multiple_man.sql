CREATE TABLE `stock_catalog_effects` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`before_source` text NOT NULL,
	`before_target` text NOT NULL,
	`source_revision` integer NOT NULL,
	`target_revision` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_items` (
	`item_id` text PRIMARY KEY NOT NULL,
	`included` integer NOT NULL,
	`track` integer NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
-- Catalog triggers also protect merges/undo from already-open older clients.
CREATE TRIGGER stock_merge AFTER INSERT ON catalog_operations WHEN NEW.kind='merge'
BEGIN
 INSERT INTO stock_items (item_id,included,track,revision,updated_at,updated_by)
 VALUES (json_extract(NEW.request,'$.sourceId'),1,0,0,NEW.created_at,NEW.actor_id),
 (json_extract(NEW.request,'$.targetId'),1,0,0,NEW.created_at,NEW.actor_id)
 ON CONFLICT(item_id) DO NOTHING;
 INSERT INTO stock_catalog_effects (operation_id,source_id,target_id,before_source,before_target,source_revision,target_revision)
 SELECT NEW.id,s.item_id,t.item_id,
 json_object('included',s.included,'track',s.track),json_object('included',t.included,'track',t.track),s.revision+1,t.revision+1
 FROM stock_items s,stock_items t WHERE s.item_id=json_extract(NEW.request,'$.sourceId') AND t.item_id=json_extract(NEW.request,'$.targetId');
 UPDATE stock_items SET included=(SELECT MAX(s.included,t.included) FROM stock_items s,stock_items t WHERE s.item_id=json_extract(NEW.request,'$.sourceId') AND t.item_id=json_extract(NEW.request,'$.targetId')),
 track=(SELECT MAX(s.track,t.track) FROM stock_items s,stock_items t WHERE s.item_id=json_extract(NEW.request,'$.sourceId') AND t.item_id=json_extract(NEW.request,'$.targetId')),
 revision=revision+1,updated_at=NEW.created_at,updated_by=NEW.actor_id WHERE item_id=json_extract(NEW.request,'$.targetId');
 UPDATE stock_items SET included=0,track=0,revision=revision+1,updated_at=NEW.created_at,updated_by=NEW.actor_id WHERE item_id=json_extract(NEW.request,'$.sourceId');
END;
--> statement-breakpoint
CREATE TRIGGER stock_undo BEFORE INSERT ON catalog_operations WHEN NEW.kind='undo'
BEGIN
 SELECT CASE WHEN EXISTS (
 SELECT 1 FROM stock_catalog_effects e JOIN stock_items s ON s.item_id=e.source_id JOIN stock_items t ON t.item_id=e.target_id
 WHERE e.operation_id=NEW.undo_of AND (s.revision!=e.source_revision OR t.revision!=e.target_revision)
 ) THEN RAISE(ABORT,'stock_undo_conflict') END;
 UPDATE stock_items SET included=json_extract(e.before_source,'$.included'),track=json_extract(e.before_source,'$.track'),revision=revision+1,updated_at=NEW.created_at,updated_by=NEW.actor_id
 FROM stock_catalog_effects e WHERE e.operation_id=NEW.undo_of AND stock_items.item_id=e.source_id;
 UPDATE stock_items SET included=json_extract(e.before_target,'$.included'),track=json_extract(e.before_target,'$.track'),revision=revision+1,updated_at=NEW.created_at,updated_by=NEW.actor_id
 FROM stock_catalog_effects e WHERE e.operation_id=NEW.undo_of AND stock_items.item_id=e.target_id;
END;
--> statement-breakpoint
CREATE TRIGGER stock_valid_insert BEFORE INSERT ON stock_items WHEN NEW.included NOT IN (0,1) OR NEW.track NOT IN (0,1) OR (NEW.included=0 AND NEW.track=1) OR NEW.revision<0
BEGIN SELECT RAISE(ABORT,'invalid_stock_state'); END;
--> statement-breakpoint
CREATE TRIGGER stock_valid_update BEFORE UPDATE ON stock_items WHEN NEW.included NOT IN (0,1) OR NEW.track NOT IN (0,1) OR (NEW.included=0 AND NEW.track=1) OR NEW.revision<=OLD.revision
BEGIN SELECT RAISE(ABORT,'invalid_stock_state'); END;
