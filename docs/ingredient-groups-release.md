# Practical ingredient groups — 25 September 2026

The fixed practical group is catalog metadata keyed by stable item ID. It is separate from ingredient type, menu categories and Track. The nine groups appear in the specified order, followed by **Needs grouping**. The owner can change a group from Manage list. Cook can see groups in permitted Evening check and Morning prep views but cannot change them or access Manage list.

The initial proposal file is checked against saved item ID, name and kind before assignment. Only matching, undecided items receive a proposal. A manually selected **Needs grouping** remains a decision and is never overwritten by initialization. Group changes have an owner-only server check, independent revision, exact idempotent command receipt and activity record. Existing stock commands and Track revisions remain independent.

Manage list applies its existing search, Type, Tracking and multi-select Menu filters before grouping. New evening checks capture group and row order at start; the morning plan inherits that snapshot. Later catalog changes do not reorder a running check. Older checks retain their flat list and display a short explanation. Prepare and Restock remain the two morning actions, with groups nested under each.

Migration `0011_mushy_deadpool.sql` is additive. It adds group metadata and a command receipt table, and adds snapshot group fields to evening answers and morning tasks. The complete private backup includes the new table alongside the existing tables and columns. Do not restore an older whole-database backup over later chef work. If a deployment problem occurs, prefer a forward fix that preserves the new schema and command history; reverting to code unaware of group snapshots would hide existing group metadata.

Verification: 49 regression scripts, TypeScript, ESLint and production build passed. Browser QA used a separate local database and synthetic catalog items, checks and tasks. It exercised Manage list, group change, evening answer/finish, Morning prep Ready/undo, narrow mobile widths and large text. No real Track, answer or Ready state was changed in testing. The deployment record and private backup live outside the source repository under `/Users/johnny/Documents/LABULA/nasazeni-skupiny-ingredienci-2026-09-25/`.

The older Evening check / Morning prep UX findings in `audit-evening-morning-v40-2026-09-25/audit.md` are outside this grouping change. Passing group tests does not establish that those separate findings were fixed.

## Merge review resolution — 2 October 2026

The group dialog compares the retained ingredient with the original names and groups of merged ingredients. A manager can confirm the existing group or choose another. Confirmation stores the exact merge operation IDs in the existing ingredient-group command receipt and activity event, atomically with the group decision. Fresh snapshots suppress only explicitly reviewed merges; changing a group without that acknowledgement does not silently resolve a review. A later merge has its own identity and remains reviewable, including after undo and remerge.

The server validates the current target group revision, each source group revision, merge target, management permission and active merge status. Failed writes roll back both the group decision and acknowledgement. Retrying the original request returns its original receipt without applying another change. Recovery from a rejected merge review requires reopening the current comparison before a new confirmation. Existing private backups include the receipts; no migration or historical-check rewrite is needed.

Verification includes real API and component-handler regression scripts covering same-group confirmation, lost responses and remount/retry, stale reviews, rollback, undo/remerge, an additional merge while the dialog is open, audit and backup preservation.
