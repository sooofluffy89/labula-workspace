# Current menu and operational scope

`lib/menu-scope.ts` defines the shared menu membership used by the catalog,
preparation and batch queues, dashboards, overview matrix and working exports.
Active variants of ready dishes supply the roots. Dependency traversal uses
current approved Review composition, then current notebook production, then
retained item composition where applicable. A co-produced output is not itself
an active menu item unless a selected recipe needs it.

Ingredients & prep opens in **Current menu**. **All items** retains the complete
catalog and identifies outside-menu, uncertain and paused items. Ingredient and
production selectors and duplicate tools continue to use the complete catalog.

Manage list and Check rounds open in **Current work**, with **All items** available
for administration. Operational eligibility includes known menu use, explicit
outside-menu use and unresolved scope. An unfinished active recipe, missing
preparation composition or unavailable approved source cannot prove an ingredient
is unnecessary. These cases retain tracked work with a scope-review label.
Tracking alone and production-review exclusions do not establish external use.

## Saved planning and effective intervals

Migration `0020_menu_scope.sql` adds append-only source snapshots captured by
database triggers in the same transaction as notebook and applied Review writes.
This covers ordinary saves, bulk edits, imports, merges, scenario application and
Review application, including successive archive/restore writes between reads.
The activation baseline starts when the feature is introduced; previous menu
intervals are not invented. Earlier v1–v3 dish identities remain readable during
the normal notebook migration.

`menu-scope-timeline.ts` intersects these intervals with the existing immutable
tracking timeline. It preserves operating-calendar rules and older obligations
while adding no new obligations during inactivity. On return, manual included,
tracking, round, group, station, frequency and instruction settings remain intact.

Open evening answers and current/future morning tasks have derived suspension
metadata. Their answers, Ready states, revisions and authorship are retained.
New Finish publications exclude suspended items from task creation and validate
the saved notebook revision. Ordinary and fast-batch responses and delta sync
carry the same scope metadata. Original pending item commands can still be
acknowledged and recovered without silently discarding accepted local work.

Closed publications and past operational snapshots retain their historical scope.
Operations overview uses effective intervals for expected checks and preserves
the measurements of recorded work. Current work counters exclude suspended tasks.

## Refresh, exports and verification

Clean notebook tabs refresh on focus, reconnect and a 15-second visible-tab poll.
Dirty drafts, open preparation sessions and pending receipts are protected.
Preparation sessions can refresh their shared menu while retaining their local
answers and original compare-and-swap base. Administrative lists also refresh
on focus and periodically. Evening sync resets on notebook revision changes.

Working CSV exports explicitly identify Current menu; complete exports and
private backups retain inactive catalog items. Private backups include
`menu_scope_sources`, and older backups remain distinguishable from current
incomplete backups.

`scripts/check-menu-scope.mjs` exercises shared dependencies, co-products,
archive/restore, explicit external use, incomplete authority, preparation queues,
exports, actual saved API planning, atomic receipt replay, unchanged settings,
offline answers, stale Finish, fast batch/delta scope, suspended morning tasks,
immutable publications, legacy sources, inactive intervals and full backups.
Root integration tests cover clean cross-tab refresh and protection of dirty
local edits. Run the full `npm run validate` suite before release.
