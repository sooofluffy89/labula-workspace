import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const notebooks = sqliteTable('notebooks', {
 id:text('id').primaryKey(), payload:text('payload').notNull(), revision:integer('revision').notNull().default(0),
 updatedAt:text('updated_at').notNull(), updatedBy:text('updated_by').notNull(),
});
export const catalogOperations = sqliteTable('catalog_operations', {
 id:text('id').primaryKey(), kind:text('kind').notNull(), request:text('request').notNull(), actorId:text('actor_id').notNull(), actorEmail:text('actor_email').notNull(),
 beforeRevision:integer('before_revision').notNull(), afterRevision:integer('after_revision').notNull().unique(), beforePayload:text('before_payload').notNull(), afterPayload:text('after_payload').notNull(),
 summary:text('summary').notNull(), createdAt:text('created_at').notNull(), retiredId:text('retired_id'), undoOf:text('undo_of'),
});
export const kitchenOwner = sqliteTable('kitchen_owner', {id:text('id').primaryKey(),userId:text('user_id').notNull()});
export const notebookCommands = sqliteTable('notebook_commands', {
 id:text('id').primaryKey(), kind:text('kind').notNull(), actorId:text('actor_id').notNull(), fingerprint:text('fingerprint').notNull(),
 beforeRevision:integer('before_revision').notNull(), afterRevision:integer('after_revision').notNull().unique(), createdAt:text('created_at').notNull(),
});
export const dataReviews = sqliteTable('data_reviews', {
 id:text('id').primaryKey(), source:text('source').notNull(), payload:text('payload').notNull(), revision:integer('revision').notNull(),
 updatedAt:text('updated_at').notNull(), updatedBy:text('updated_by').notNull(),
});
export const dataReviewCommands = sqliteTable('data_review_commands', {
 id:text('id').primaryKey(), reviewId:text('review_id').notNull(), actorId:text('actor_id').notNull(), actorEmail:text('actor_email').notNull(),
 request:text('request').notNull(), beforeRevision:integer('before_revision').notNull(), afterRevision:integer('after_revision').notNull(),
 beforePayload:text('before_payload').notNull(), afterPayload:text('after_payload').notNull(), createdAt:text('created_at').notNull(),
});
// Authority lives outside cook-editable drafts. Every record binds an exact dependency fingerprint.
export const reviewAuthority = sqliteTable('review_authority', {
 id:text('id').primaryKey(), reviewId:text('review_id').notNull(), kind:text('kind').notNull(), entityId:text('entity_id').notNull(),
 fingerprint:text('fingerprint').notNull(), payload:text('payload').notNull(), actorId:text('actor_id').notNull(), actorEmail:text('actor_email').notNull(), createdAt:text('created_at').notNull(),
});
export const reviewActions = sqliteTable('review_actions', {
 id:text('id').primaryKey(), reviewId:text('review_id').notNull(), actorId:text('actor_id').notNull(), request:text('request').notNull(), result:text('result').notNull(), createdAt:text('created_at').notNull(),
});
export const reviewedEntities = sqliteTable('reviewed_entities', {
 id:text('id').primaryKey(), reviewId:text('review_id').notNull(), entityId:text('entity_id').notNull(), fingerprint:text('fingerprint').notNull(), payload:text('payload').notNull(), notebookRevision:integer('notebook_revision').notNull(), effective:text('effective').notNull(), approvalId:text('approval_id').notNull(),
});

export const reviewImportChunks = sqliteTable('review_import_chunks', {id:text('id').primaryKey(),archiveId:text('archive_id').notNull(),part:integer('part').notNull(),payload:text('payload').notNull()});

// Shared stock-list configuration is independent of whole-notebook autosave and imports.
export const stockItems = sqliteTable('stock_items', {
 itemId:text('item_id').primaryKey(),included:integer('included').notNull(),track:integer('track').notNull(),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),
 roundId:text('round_id'),roundRevision:integer('round_revision').notNull().default(0),roundSource:text('round_source'),groupId:text('group_id'),groupRevision:integer('group_revision').notNull().default(0),groupSource:text('group_source'),groupUpdatedAt:text('group_updated_at'),groupUpdatedBy:text('group_updated_by'),
});
export const ingredientGroupCommands = sqliteTable('ingredient_group_commands', {
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),request:text('request').notNull(),result:text('result').notNull(),createdAt:text('created_at').notNull(),
});
export const stockCommands = sqliteTable('stock_commands', {
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),request:text('request').notNull(),result:text('result').notNull(),createdAt:text('created_at').notNull(),
});
export const stockCatalogEffects = sqliteTable('stock_catalog_effects', {
 operationId:text('operation_id').primaryKey(),sourceId:text('source_id').notNull(),targetId:text('target_id').notNull(),beforeSource:text('before_source').notNull(),beforeTarget:text('before_target').notNull(),sourceRevision:integer('source_revision').notNull(),targetRevision:integer('target_revision').notNull(),
});

// A date identifies one shared kitchen check. planDay is set only at confirmation.
export const eveningChecks=sqliteTable('evening_checks',{
 id:text('id').primaryKey(),calendarRevision:integer('calendar_revision'),targetDay:text('target_day').notNull(),planDay:text('plan_day').unique(),stage:text('stage').notNull(),revision:integer('revision').notNull(),planRevision:integer('plan_revision').notNull(),version:integer('version').notNull(),startOperation:text('start_operation').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),updatedAt:text('updated_at').notNull(),confirmedAt:text('confirmed_at'),confirmedBy:text('confirmed_by'),grouped:integer('grouped').notNull().default(0),roundsVersion:integer('rounds_version').notNull().default(0),
});
export const eveningAnswers=sqliteTable('evening_answers',{
 checkId:text('check_id').notNull(),itemId:text('item_id').notNull(),catalogId:text('catalog_id').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),position:integer('position').notNull(),value:text('value'),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),firstActor:text('first_actor'),firstDevice:text('first_device'),firstSequence:integer('first_sequence'),supersededBy:text('superseded_by'),groupId:text('group_id'),roundSnapshot:text('round_snapshot'),instructionSnapshot:text('instruction_snapshot'),
},t=>[primaryKey({columns:[t.checkId,t.itemId]})]);
export const eveningVersions=sqliteTable('evening_versions',{
 checkId:text('check_id').notNull(),version:integer('version').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),
},t=>[primaryKey({columns:[t.checkId,t.version]})]);
export const morningTasks=sqliteTable('morning_tasks',{
 checkId:text('check_id').notNull(),itemId:text('item_id').notNull(),catalogId:text('catalog_id').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),position:integer('position').notNull(),ready:integer('ready').notNull(),cancelled:integer('cancelled').notNull(),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),groupId:text('group_id'),instructionSnapshot:text('instruction_snapshot'),
},t=>[primaryKey({columns:[t.checkId,t.itemId]})]);
export const eveningCommands=sqliteTable('evening_commands',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),request:text('request').notNull(),result:text('result').notNull(),applied:integer('applied').notNull(),createdAt:text('created_at').notNull(),
});

// Stable authenticated identity; roster names never replace the signed-in actor.
export const kitchenTeam=sqliteTable('kitchen_team',{
 id:text('id').primaryKey(),userId:text('user_id'),email:text('email').notNull(),name:text('name').notNull(),accessRole:text('access_role').notNull().default('legacy'),active:integer('active').notNull().default(1),revision:integer('revision').notNull().default(0),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('kitchen_team_user').on(t.userId),uniqueIndex('kitchen_team_email').on(t.email)]);
export const teamCommands=sqliteTable('team_commands',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),request:text('request').notNull(),createdAt:text('created_at').notNull(),
});
// Append-only business events. All timestamps are UTC; client time is unverified.
export const kitchenActivity=sqliteTable('kitchen_activity',{
 id:text('id').primaryKey(),commandId:text('command_id').notNull(),category:text('category').notNull(),action:text('action').notNull(),source:text('source').notNull(),actorId:text('actor_id').notNull(),actorEmail:text('actor_email').notNull(),actorName:text('actor_name').notNull(),recordedAt:text('recorded_at').notNull(),clientAt:text('client_at'),sessionId:text('session_id'),sequence:integer('sequence'),supersedesCommandId:text('supersedes_command_id'),checkId:text('check_id'),targetDay:text('target_day'),itemId:text('item_id'),itemName:text('item_name'),itemKind:text('item_kind'),beforeValue:text('before_value'),afterValue:text('after_value'),
},t=>[index('activity_time').on(t.recordedAt,t.id),index('activity_check').on(t.checkId,t.recordedAt,t.id),index('activity_actor').on(t.actorId,t.recordedAt,t.id),index('activity_item').on(t.itemId,t.recordedAt,t.id)]);

// Schedules and append-only effective intervals live outside Recipe Notebook.
export const checkRounds=sqliteTable('check_rounds',{
 id:text('id').primaryKey(),days:text('days').notNull(),revision:integer('revision').notNull().default(0),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),
});
export const roundState=sqliteTable('round_state',{
 id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),activatedAt:text('activated_at').notNull(),
});
export const roundTimeline=sqliteTable('round_timeline',{
 seq:integer('seq').primaryKey({autoIncrement:true}),itemId:text('item_id').notNull(),roundId:text('round_id'),days:text('days').notNull(),scheduleRevision:integer('schedule_revision').notNull(),active:integer('active').notNull(),recordedAt:text('recorded_at').notNull(),source:text('source').notNull(),actor:text('actor').notNull(),
},t=>[index('round_timeline_item').on(t.itemId,t.seq)]);
export const roundCommands=sqliteTable('round_commands',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),request:text('request').notNull(),applied:integer('applied').notNull().default(0),createdAt:text('created_at').notNull(),
});

export const operatingCalendarVersions=sqliteTable('operating_calendar_versions',{
 revision:integer('revision').primaryKey(),effectiveDay:text('effective_day').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),operationId:text('operation_id').notNull().unique(),
},t=>[index('operating_calendar_effective').on(t.effectiveDay,t.revision)]);
export const operatingCommands=sqliteTable('operating_commands',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),request:text('request').notNull(),createdAt:text('created_at').notNull(),
});
export const operatingOutcomes=sqliteTable('operating_outcomes',{
 id:text('id').primaryKey(),checkId:text('check_id').notNull(),itemId:text('item_id').notNull(),version:integer('version').notNull(),outcome:text('outcome').notNull(),note:text('note').notNull(),reportedReadyAt:text('reported_ready_at'),supersedesId:text('supersedes_id'),actorId:text('actor_id').notNull(),actorName:text('actor_name').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('operating_outcomes_task').on(t.checkId,t.itemId,t.createdAt)]);

// Owner guidance and service feedback remain outside Recipe Notebook.
export const prepInstructions=sqliteTable('prep_instructions',{
 itemId:text('item_id').primaryKey(),text:text('text').notNull(),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),actorId:text('actor_id').notNull(),
});
export const prepInstructionVersions=sqliteTable('prep_instruction_versions',{
 id:text('id').primaryKey(),itemId:text('item_id').notNull(),text:text('text').notNull(),revision:integer('revision').notNull(),actorId:text('actor_id').notNull(),actorName:text('actor_name').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('prep_instruction_revision').on(t.itemId,t.revision)]);
export const prepNoteCommands=sqliteTable('prep_note_commands',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),request:text('request').notNull(),applied:integer('applied').notNull().default(0),createdAt:text('created_at').notNull(),
});
export const prepFeedback=sqliteTable('prep_feedback',{
 id:text('id').primaryKey(),checkId:text('check_id').notNull(),itemId:text('item_id').notNull(),catalogId:text('catalog_id').notNull(),version:integer('version').notNull(),instructionRevision:integer('instruction_revision'),phase:text('phase').notNull(),text:text('text').notNull(),actorId:text('actor_id').notNull(),actorName:text('actor_name').notNull(),actorEmail:text('actor_email').notNull(),createdAt:text('created_at').notNull(),clientAt:text('client_at'),
},t=>[index('prep_feedback_service').on(t.checkId,t.itemId,t.catalogId),index('prep_feedback_catalog').on(t.catalogId,t.createdAt,t.id)]);
