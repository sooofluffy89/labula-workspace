# Shared check rounds — release and coverage

Implementation baseline: source `edf5ea603863915748c69d5d18739079473c2a33`, production v43. See `plan.md` for invariants. Deployment results are recorded outside the repository in `nasazeni-kontrolni-kola-2026-09-26` so a post-deploy report does not alter the packaged source.

## Delivered behavior

- Owner-only **Manage list → Check rounds**: three fixed rounds, explicit weekday validation, grouped item selection using the existing nine practical categories plus Needs grouping.
- All six filter dimensions: name/alias, type, multi-select active menu OR, ingredient category, Track, current round. Dimensions combine with AND. Existing nested-preparation usage rules are reused. No invented ingredient grouping.
- Filtered group/all selection uses matching IDs, not visible DOM rows. Selected IDs survive filtering, collapse, closing and reload. Already assigned items are separate from change candidates. The review shows each item's category and old/new round including days; Track is unchanged.
- Local selection/day drafts and operation recovery are account-scoped. Ambiguous saves retry the original operation. A server conflict requires a successful refresh before clearing the rejected request and reviewing a fresh change.
- Server planning uses effective round/Track timelines, published check versions, Prague operational dates and the existing 04:00 cutoff. No cron and no historical debt before activation. One unique roster/check per day; snapshots preserve names, kind, group, position and scheduling reason/version.
- Missed scheduled checks remain due after membership/day changes. Fixed weekdays remain fixed. Track Off intervals create no new debt. A late confirmation covers only up to its check date. Unpublished corrections retain the previously published coverage.
- Explicit **Check other items**, including a day with zero scheduled items; only valid included tracked IDs can be added. A roster change increments the check revision and invalidates old finish summaries.
- Existing Finish/Confirm, Morning prep Prepare/Restock, Ready/Undo, correction rules, durable queues and operation authorship are retained. No unanswered or overdue item creates a task by itself.
- Old drafts covered by later published checks retain their answers, show a covering-check link and are excluded from the recommendation to continue unfinished work.

## Persistence / compatibility

Additive generated migrations `0012` and `0013` add `check_rounds`, `round_state`, `round_timeline`, `round_commands`, independent stock membership/revision/source, check generation marker and answer snapshot metadata. The existing stock invariant trigger is extended to accept monotonic round revisions without changing stock or group revisions.

Runtime initialization is idempotent: three default schedules and **only included Track On items lacking a membership → Daily**. Less frequent rounds start empty. Track itself, group decisions and notebook payload are not written. A compatibility trigger assigns Daily when an older client turns on an unassigned item. Track Off/removal retain membership. Merges preserve the target round; undo does not overwrite later round decisions.

The timeline stores UTC activation/effective timestamps, source and actor. Schedule/membership commands also have ordinary activity events and immutable operation receipts. Coverage is derived from the exact published version of `evening_versions`, not local answers. Old pre-activation retrospective checks explicitly use the legacy roster and do not claim a historical round.

The complete private backup includes all 26 tables. `readPrivateBackup` accepts a complete old 22-table archive and marks missing round metadata as legacy; it does not mutate or restore it. Current complete exports still reject missing new tables.

Same-operational-day rule: a schedule/membership change retains the old day's scheduled obligation. Track Off stops the old active interval before its off operational day; prior-day outstanding obligations remain in history and become visible again when the item is tracked. Off days between intervals create no obligations.

## Verification

- Dynamic `scripts/check-all.mjs`: 51 scripts, including new actual API/SQLite transaction/migration and controller tests.
- `check-rounds.mjs`: initialization/idempotency, preserved Track/revisions/notebook, schedule validation, atomic conflicts and rollback, original receipt replay after later decisions, owner/Cook/anonymous, menu OR and nested ingredients, alias and Needs grouping filters, hidden selection, pinned roster, overdue across changed days/membership, extra checks, zero scheduled day, later coverage of old draft, retroactive confirmation, published correction semantics, retained Ready, off intervals, Prague DST and backups. Actual merge/undo endpoints verify stable target decisions.
- `check-rounds-client.mjs`: uncertain committed request, exact retry after reload, 401, changed identity, explicit conflict review, failed storage before send, duplicate click and unmount. Existing request tests cover bounded fetch and body deadlines.
- TypeScript, ESLint and production build are run; exact results are in the deployment evidence directory.
- Browser QA uses only `/private/tmp/labula-rounds-qa`, a separate D1 database, 10 synthetic ingredients and synthetic owner/Cook identities. No production answers or Track changes are used.
- Observed browser flow: change shared days, combine all filters, select a group, preserve hidden selection and recover it after remount, review/move two items, Cook Start → answers → Finish/Confirm → Prepare/Restock → Ready/Undo. Zero scheduled day → explicit extra check → confirmed empty Morning prep. Two independent owner sessions reject a stale confirmation. An actual 30-second browser timeout after a committed synthetic write preserves the pending request; Retry confirms the original operation without a duplicate move.
- Layout checked at 320 / 390 / 430 px and desktop; no document horizontal overflow. Full long names wrap. 200% rendering tested using temporary CSS zoom in the disposable QA checkout, not native browser zoom. Focus starts on Back in confirmation; dialogs use Radix focus trapping and Escape never writes.

## Rollout / recovery

Take a fresh owner-only complete export immediately before deploying; verify inventory, counts, digest and role/access policy. Publish the exact tested source/archive to the existing Sites project and preserve its custom audience. Read production, allowing only the authorized Daily initialization, then take another complete export.

Compare every original row by primary key and every original column. Only new round columns/tables and their system initialization are expected. Any concurrent legitimate operation must be explained by its actor/revision/history; never restore an older whole notebook over it.

If a defect appears, retain current schema, schedules, snapshots and receipts and publish a compatible forward fix. Do not roll back to a backend that ignores Cook restrictions or round planning. Do not truncate timelines/receipts, replay a new command ID for an uncertain operation, or restore the baseline database over newer work.

## Operational limits

This manages checking frequency, not stock quantities, food safety or a production cadence. It does not automatically carry old morning work forward. Very old checks retain legacy behavior. The owner must deliberately assign any less frequent items; none are selected automatically. Browser screenshots and observations are included in the task's tool transcript; test logs and backup verification are in the deployment evidence directory.
