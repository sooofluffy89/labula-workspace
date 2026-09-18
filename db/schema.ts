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
