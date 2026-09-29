# Manage list — unified check frequency

Scope: Manage list only. Base source `1c660c80af9db314af19cc28f9e8b236839c800e`, production v54. No migrations and no runtime data conversion.

## Behavior

- One Check frequency select: Do not check / Daily / Twice weekly / Weekly. Shows shared scheduled weekdays and the next evening check, ingredient group, and shared instruction preview/editor.
- Explicit confirmation names the item, old/new frequency, actual weekdays, and frozen-check behavior. Off retains the last round, group, instruction and list membership. Remove remains a separate secondary action.
- New tables/styles are scoped to Manage list. Check rounds component and shared AdminItemsTable are unchanged, as are chef answers, Finish, Morning, Ready/Undo and fast-sync endpoints.
- Existing search, alias, type, multi-menu filters, instruction coverage, grouped lists and personal views remain. Legacy tracked/untracked preferences map to all scheduled/off. Counts use effective tracking, not retained inactive membership.
- Desktop table; stacked mobile rows with full instruction in shared detail. Focus returns to the select on cancel and to list counts if the saved item leaves the filter. Local instruction drafts use the existing editor.

## Persistence and correctness

`POST /api/stock-frequency` is Owner/Manager-only and uses one database batch with round_commands receipts. It checks stable actor identity, active access, stock revision, round revision, shared planning revision, calendar revision, current operational day and catalog membership. One stock update changes track and round atomically; existing triggers record the effective timeline without intermediate Daily assignment. No-op has no new activity/timeline event. Replays cannot overwrite later decisions.

The existing StockController uses a separate durable, account-scoped frequency-recovery namespace. Unknown outcomes retain the same operation and require retry; definite conflicts retain the intent for comparison and explicit dismissal/reselection. Legacy stock commands and their recovery remain supported.

`GET /api/stock?planning=1` returns a coherent stock/planning snapshot, with before/after revision checks and bounded retries. Legacy GET is unchanged. Reads are batched, not per-item. Next-check calculation uses the shared immutable calendarObligation function and confirmed version coverage, with Prague cutoff, calendar exceptions and frozen current-check membership. New manager metadata refreshes on focus/return, relevant local storage notifications and every minute while visible and without a pending review. A stale display cannot authorize a stale write.

## Verification

- All 68 dynamically discovered regression scripts passed, including fast-sync, role restrictions, stock, check rounds, calendar, notes and new `check-stock-frequency.mjs`.
- New actual handler/SQLite/controller coverage: all 16 transitions, no-op, one timeline event, Off retention, replay, legacy/round/schedule/calendar races, rollback, stale-day rejection, owner/manager/cook/anonymous, frozen draft/published tasks/Ready, calendar exception, unconfirmed obligation, Prague cutoff/DST, missing metadata, non-contiguous future confirmed checks, durable recovery/reload, pre-commit failure, lost reply after commit, duplicate clicks, explicit conflict resolution, old personal view schema and complete 33-table backup.
- Metadata read in synthetic three-item in-memory SQLite: 29 SQL statements, about 1 ms; this is not a production network benchmark.
- Browser QA in `/private/tmp/labula-frequency-qa`, using independent synthetic SQLite storage and two separately identified managers: confirmed change, cancel/Escape/focus, row disappearing under filter, conflict with preserved intent, shared group editor, instruction draft reopen/save, multi-menu filters, Check rounds cards, Evening correction→Finish→Confirm→Morning→Ready→Undo.
- Responsive browser widths 320/390/430 verified. A pre-existing long signed-in name overflow at 320 was fixed only when the new Manage list is present. No horizontal overflow in final checks. Screenshot evidence kept outside the source repository.
- TypeScript and lint passed; final production build is performed by the official Sites workflow before saving the exact source version.

## Release safeguards and limits

Complete pre-release private backup: 33 tables, counts validated, SHA256 `6f2c6e79bd81536b4dc641d7a0ed23e61709bbb607477604d3113a67922edf7b`. Access audience custom, revision 5, owner and two existing external users preserved. No production operational settings, notes, answers or Ready entered by this task.

Deployment/version and post-release data comparison are recorded in the external handoff report under `jednotne-nastaveni-release-2026-09-29`. Unsaved browser drafts remain on their originating devices; no mechanism enumerates or changes drafts on other cooks' phones. Browser QA uses viewport emulation and keyboard checks, not physical device or screen-reader certification. Manage list's next-check display is a verified snapshot, not a new live transport; existing chef synchronization is unchanged.
