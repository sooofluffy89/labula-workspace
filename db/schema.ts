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
 groupId:text('group_id'),groupRevision:integer('group_revision').notNull().default(0),groupSource:text('group_source'),groupUpdatedAt:text('group_updated_at'),groupUpdatedBy:text('group_updated_by'),
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
 id:text('id').primaryKey(),targetDay:text('target_day').notNull(),planDay:text('plan_day').unique(),stage:text('stage').notNull(),revision:integer('revision').notNull(),planRevision:integer('plan_revision').notNull(),version:integer('version').notNull(),startOperation:text('start_operation').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),updatedAt:text('updated_at').notNull(),confirmedAt:text('confirmed_at'),confirmedBy:text('confirmed_by'),grouped:integer('grouped').notNull().default(0),
});
export const eveningAnswers=sqliteTable('evening_answers',{
 checkId:text('check_id').notNull(),itemId:text('item_id').notNull(),catalogId:text('catalog_id').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),position:integer('position').notNull(),value:text('value'),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),firstActor:text('first_actor'),firstDevice:text('first_device'),firstSequence:integer('first_sequence'),supersededBy:text('superseded_by'),groupId:text('group_id'),
},t=>[primaryKey({columns:[t.checkId,t.itemId]})]);
export const eveningVersions=sqliteTable('evening_versions',{
 checkId:text('check_id').notNull(),version:integer('version').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),
},t=>[primaryKey({columns:[t.checkId,t.version]})]);
export const morningTasks=sqliteTable('morning_tasks',{
 checkId:text('check_id').notNull(),itemId:text('item_id').notNull(),catalogId:text('catalog_id').notNull(),name:text('name').notNull(),kind:text('kind').notNull(),position:integer('position').notNull(),ready:integer('ready').notNull(),cancelled:integer('cancelled').notNull(),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),groupId:text('group_id'),
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
