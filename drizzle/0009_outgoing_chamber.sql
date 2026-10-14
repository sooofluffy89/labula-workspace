CREATE TABLE `kitchen_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`source` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`recorded_at` text NOT NULL,
	`client_at` text,
	`session_id` text,
	`sequence` integer,
	`supersedes_command_id` text,
	`check_id` text,
	`target_day` text,
	`item_id` text,
	`item_name` text,
	`item_kind` text,
	`before_value` text,
	`after_value` text
);
--> statement-breakpoint
CREATE INDEX `activity_time` ON `kitchen_activity` (`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `activity_check` ON `kitchen_activity` (`check_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `activity_actor` ON `kitchen_activity` (`actor_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `activity_item` ON `kitchen_activity` (`item_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE TABLE `kitchen_team` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen_team_user` ON `kitchen_team` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen_team_email` ON `kitchen_team` (`email`);--> statement-breakpoint
CREATE TABLE `team_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`request` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER activity_no_update BEFORE UPDATE ON kitchen_activity BEGIN SELECT RAISE(ABORT,'activity_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER activity_no_delete BEFORE DELETE ON kitchen_activity BEGIN SELECT RAISE(ABORT,'activity_is_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER activity_catalog_merge AFTER INSERT ON stock_catalog_effects BEGIN
 INSERT INTO kitchen_activity(id,command_id,category,action,source,actor_id,actor_email,actor_name,recorded_at,item_id,item_name,before_value,after_value)
 SELECT NEW.operation_id||':stock:merge:'||s.item_id,NEW.operation_id,'stock','merge','system',c.actor_id,c.actor_email,coalesce(t.name,c.actor_email),c.created_at,s.item_id,
 (SELECT json_extract(i.value,'$.name') FROM json_each(c.before_payload,'$.items') i WHERE json_extract(i.value,'$.id')=s.item_id),
 CASE WHEN s.item_id=NEW.source_id THEN NEW.before_source ELSE NEW.before_target END,
 CASE WHEN s.item_id=NEW.source_id THEN json_object('included',0,'track',0) ELSE json_object('included',max(json_extract(NEW.before_source,'$.included'),json_extract(NEW.before_target,'$.included')),'track',max(json_extract(NEW.before_source,'$.track'),json_extract(NEW.before_target,'$.track'))) END
 FROM stock_items s JOIN catalog_operations c ON c.id=NEW.operation_id LEFT JOIN kitchen_team t ON t.user_id=c.actor_id WHERE s.item_id IN (NEW.source_id,NEW.target_id);
END;
--> statement-breakpoint
CREATE TRIGGER activity_catalog_undo AFTER INSERT ON catalog_operations WHEN NEW.kind='undo' BEGIN
 INSERT INTO kitchen_activity(id,command_id,category,action,source,actor_id,actor_email,actor_name,recorded_at,item_id,item_name,before_value,after_value)
 SELECT NEW.id||':stock:undo:'||s.item_id,NEW.id,'stock','undo','system',NEW.actor_id,NEW.actor_email,coalesce(t.name,NEW.actor_email),NEW.created_at,s.item_id,
 (SELECT json_extract(i.value,'$.name') FROM json_each(NEW.after_payload,'$.items') i WHERE json_extract(i.value,'$.id')=s.item_id),
 CASE WHEN s.item_id=e.source_id THEN json_object('included',0,'track',0) ELSE json_object('included',max(json_extract(e.before_source,'$.included'),json_extract(e.before_target,'$.included')),'track',max(json_extract(e.before_source,'$.track'),json_extract(e.before_target,'$.track'))) END,
 json_object('included',s.included,'track',s.track)
 FROM stock_catalog_effects e JOIN stock_items s ON s.item_id IN(e.source_id,e.target_id) LEFT JOIN kitchen_team t ON t.user_id=NEW.actor_id WHERE e.operation_id=NEW.undo_of;
END;
