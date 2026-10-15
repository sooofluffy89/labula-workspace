CREATE TABLE `workspace_runtime_policy` (
	`id` text PRIMARY KEY NOT NULL,
	`write_paused` integer DEFAULT 0 NOT NULL,
	`min_client_version` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `access_write_guards` ADD `client_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
INSERT INTO workspace_runtime_policy(id,write_paused,min_client_version,revision,updated_at) VALUES('kitchen',0,1,0,'initial-policy');
--> statement-breakpoint
CREATE TRIGGER workspace_request_policy BEFORE INSERT ON access_write_guards
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0 AND min_client_version>=1) THEN RAISE(ABORT,'workspace_write_paused') END;
 SELECT CASE WHEN NEW.client_version < (SELECT min_client_version FROM workspace_runtime_policy WHERE id='kitchen') THEN RAISE(ABORT,'workspace_update_required') END;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_catalog_operations_insert BEFORE INSERT ON catalog_operations
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_catalog_operations_update BEFORE UPDATE ON catalog_operations
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_catalog_operations_delete BEFORE DELETE ON catalog_operations
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_check_rounds_insert BEFORE INSERT ON check_rounds
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_check_rounds_update BEFORE UPDATE ON check_rounds
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_check_rounds_delete BEFORE DELETE ON check_rounds
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_checking_station_commands_insert BEFORE INSERT ON checking_station_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_checking_station_commands_update BEFORE UPDATE ON checking_station_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_checking_station_commands_delete BEFORE DELETE ON checking_station_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_checking_station_items_insert BEFORE INSERT ON checking_station_items
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_checking_station_items_update BEFORE UPDATE ON checking_station_items
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_checking_station_items_delete BEFORE DELETE ON checking_station_items
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_data_review_commands_insert BEFORE INSERT ON data_review_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_data_review_commands_update BEFORE UPDATE ON data_review_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_data_review_commands_delete BEFORE DELETE ON data_review_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_data_reviews_insert BEFORE INSERT ON data_reviews
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_data_reviews_update BEFORE UPDATE ON data_reviews
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_data_reviews_delete BEFORE DELETE ON data_reviews
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_answers_insert BEFORE INSERT ON evening_answers
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_answers_update BEFORE UPDATE ON evening_answers
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_answers_delete BEFORE DELETE ON evening_answers
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_checks_insert BEFORE INSERT ON evening_checks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_checks_update BEFORE UPDATE ON evening_checks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_checks_delete BEFORE DELETE ON evening_checks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_commands_insert BEFORE INSERT ON evening_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_commands_update BEFORE UPDATE ON evening_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_commands_delete BEFORE DELETE ON evening_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_versions_insert BEFORE INSERT ON evening_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_versions_update BEFORE UPDATE ON evening_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_evening_versions_delete BEFORE DELETE ON evening_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_ingredient_group_commands_insert BEFORE INSERT ON ingredient_group_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_ingredient_group_commands_update BEFORE UPDATE ON ingredient_group_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_ingredient_group_commands_delete BEFORE DELETE ON ingredient_group_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_activity_insert BEFORE INSERT ON kitchen_activity
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_activity_update BEFORE UPDATE ON kitchen_activity
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_activity_delete BEFORE DELETE ON kitchen_activity
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_owner_insert BEFORE INSERT ON kitchen_owner
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_owner_update BEFORE UPDATE ON kitchen_owner
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_owner_delete BEFORE DELETE ON kitchen_owner
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_team_insert BEFORE INSERT ON kitchen_team
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_team_update BEFORE UPDATE ON kitchen_team
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_kitchen_team_delete BEFORE DELETE ON kitchen_team
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_menu_scope_sources_insert BEFORE INSERT ON menu_scope_sources
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_menu_scope_sources_update BEFORE UPDATE ON menu_scope_sources
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_menu_scope_sources_delete BEFORE DELETE ON menu_scope_sources
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_morning_tasks_insert BEFORE INSERT ON morning_tasks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_morning_tasks_update BEFORE UPDATE ON morning_tasks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_morning_tasks_delete BEFORE DELETE ON morning_tasks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_notebook_commands_insert BEFORE INSERT ON notebook_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_notebook_commands_update BEFORE UPDATE ON notebook_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_notebook_commands_delete BEFORE DELETE ON notebook_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_notebooks_insert BEFORE INSERT ON notebooks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_notebooks_update BEFORE UPDATE ON notebooks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_notebooks_delete BEFORE DELETE ON notebooks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_calendar_versions_insert BEFORE INSERT ON operating_calendar_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_calendar_versions_update BEFORE UPDATE ON operating_calendar_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_calendar_versions_delete BEFORE DELETE ON operating_calendar_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_commands_insert BEFORE INSERT ON operating_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_commands_update BEFORE UPDATE ON operating_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_commands_delete BEFORE DELETE ON operating_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_outcomes_insert BEFORE INSERT ON operating_outcomes
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_outcomes_update BEFORE UPDATE ON operating_outcomes
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_operating_outcomes_delete BEFORE DELETE ON operating_outcomes
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_feedback_insert BEFORE INSERT ON prep_feedback
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_feedback_update BEFORE UPDATE ON prep_feedback
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_feedback_delete BEFORE DELETE ON prep_feedback
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_instruction_versions_insert BEFORE INSERT ON prep_instruction_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_instruction_versions_update BEFORE UPDATE ON prep_instruction_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_instruction_versions_delete BEFORE DELETE ON prep_instruction_versions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_instructions_insert BEFORE INSERT ON prep_instructions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_instructions_update BEFORE UPDATE ON prep_instructions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_instructions_delete BEFORE DELETE ON prep_instructions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_note_commands_insert BEFORE INSERT ON prep_note_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_note_commands_update BEFORE UPDATE ON prep_note_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_prep_note_commands_delete BEFORE DELETE ON prep_note_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_actions_insert BEFORE INSERT ON review_actions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_actions_update BEFORE UPDATE ON review_actions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_actions_delete BEFORE DELETE ON review_actions
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_authority_insert BEFORE INSERT ON review_authority
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_authority_update BEFORE UPDATE ON review_authority
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_authority_delete BEFORE DELETE ON review_authority
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_import_chunks_insert BEFORE INSERT ON review_import_chunks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_import_chunks_update BEFORE UPDATE ON review_import_chunks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_review_import_chunks_delete BEFORE DELETE ON review_import_chunks
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_reviewed_entities_insert BEFORE INSERT ON reviewed_entities
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_reviewed_entities_update BEFORE UPDATE ON reviewed_entities
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_reviewed_entities_delete BEFORE DELETE ON reviewed_entities
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_commands_insert BEFORE INSERT ON round_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_commands_update BEFORE UPDATE ON round_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_commands_delete BEFORE DELETE ON round_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_state_insert BEFORE INSERT ON round_state
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_state_update BEFORE UPDATE ON round_state
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_state_delete BEFORE DELETE ON round_state
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_timeline_insert BEFORE INSERT ON round_timeline
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_timeline_update BEFORE UPDATE ON round_timeline
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_round_timeline_delete BEFORE DELETE ON round_timeline
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_catalog_effects_insert BEFORE INSERT ON stock_catalog_effects
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_catalog_effects_update BEFORE UPDATE ON stock_catalog_effects
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_catalog_effects_delete BEFORE DELETE ON stock_catalog_effects
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_commands_insert BEFORE INSERT ON stock_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_commands_update BEFORE UPDATE ON stock_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_commands_delete BEFORE DELETE ON stock_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_items_insert BEFORE INSERT ON stock_items
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_items_update BEFORE UPDATE ON stock_items
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_stock_items_delete BEFORE DELETE ON stock_items
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_team_access_state_insert BEFORE INSERT ON team_access_state
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_team_access_state_update BEFORE UPDATE ON team_access_state
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_team_access_state_delete BEFORE DELETE ON team_access_state
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_team_commands_insert BEFORE INSERT ON team_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_team_commands_update BEFORE UPDATE ON team_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_team_commands_delete BEFORE DELETE ON team_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photo_commands_insert BEFORE INSERT ON user_photo_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photo_commands_update BEFORE UPDATE ON user_photo_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photo_commands_delete BEFORE DELETE ON user_photo_commands
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photo_uploads_insert BEFORE INSERT ON user_photo_uploads
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photo_uploads_update BEFORE UPDATE ON user_photo_uploads
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photo_uploads_delete BEFORE DELETE ON user_photo_uploads
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photos_insert BEFORE INSERT ON user_photos
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photos_update BEFORE UPDATE ON user_photos
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
--> statement-breakpoint
CREATE TRIGGER workspace_freeze_user_photos_delete BEFORE DELETE ON user_photos
WHEN NOT EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)
BEGIN SELECT RAISE(ABORT,'workspace_write_paused'); END;
