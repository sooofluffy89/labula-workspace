import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
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
