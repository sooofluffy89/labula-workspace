# Evening check → Morning prep

## Delivered workflow

Current stock now has Evening check, Morning prep and Manage list. The landing page opens the daily work directly; its Continue link opens the dated unfinished check. Existing ingredient type/search/tracking filters stay in Manage list. Track only configures future checks. Production choices are never seeded.

The compact A layout keeps stable alphabetical snapshot rows, equal 48 × 48 px answer buttons, sticky column labels, full wrapping names and no automatic reordering. Each new check starts Unchecked. The item name opens secondary options, including Return to Unchecked. Availability does not mean a sufficient amount for service.

One shared check is identified by the kitchen operational date. Europe/Prague and a 04:00 cutoff are centralized in `lib/evening.ts`; this is an implementation convention, not an assertion about opening hours. Dates can be selected explicitly. Resuming a draft keeps its original identity. A morning date can change before first confirmation only.

Finish first drains recoverable writes, fetches fresh shared data and checks completeness. The modal shows the evening date, morning date, available/missing counts and every missing name. Back/Escape never confirm; focus returns to Finish. Confirm sends the exact displayed check, plan and catalog revisions. A stale summary requires another explicit confirmation. An all-available check still needs confirmation and creates a distinguishable empty confirmed plan.

Morning prep splits items selected for the morning plan into preparations and bought ingredients, with Ready/Undo, dates, authorship and server time. Unchanged tasks retain Ready during corrections. Correct check starts a draft while the old plan remains readable; only reconfirmation publishes additions/cancellations. Reappearing selected tasks reopen individually. Concurrent Ready changes invalidate a stale correction summary instead of being overwritten.

## Persistence and concurrency

Five independent D1 tables (`evening_checks`, `evening_answers`, `evening_versions`, `morning_tasks`, `evening_commands`) are added by migrations 0007–0008. No inventory data enters Notebook payloads or review data. One unique `plan_day` prevents competing plans for a morning date; a conflicting draft remains available for explicit date correction. Confirmation versions retain the complete answer snapshot and prior tasks. Cancelled tasks are tombstones, not deleted history.

Server commands bind exact content, actor ID, scope and operation UUID. Per-answer revisions preserve unrelated concurrent edits. Confirmation also guards check revision, plan revision and catalog revision. All statements in the D1 batch are gated by an unapplied receipt, which becomes applied at transaction end. A duplicate or lost reply can replay only the original receipt. Both failed confirmation and partial transaction rollback are tested. All request origins and authenticated identities use the existing private app protections.

Answer intents persist locally before immediate UI feedback, then run through a bounded sequential queue without a GET round trip between taps. Shared state and the pending overlay remain separate. Sent commands keep their IDs/content; uncertain operations are never rebased. Definitively rejected operations require a displayed comparison and explicit use-local/keep-shared choice. Recovery is tied to stable account and kitchen; the server also rejects an account switch after the client's identity check. Refresh cannot overwrite pending intents. The shared request deadline covers both fetch and JSON body consumption. Unmount retains recovery and ignores late callbacks.

Each answer retains snapshot position, first actor, per-client device ID and first sequence. Retries and corrections do not change the first sequence. Different clients' sequences remain distinguishable; these are not presented as an optimal walking route.

Renames preserve historical names and show the current name. Missing/type-changed catalog IDs block Ready and confirmation. An explicit replacement links by ID, resets the answer to Unchecked and retains history. A retired duplicate can explicitly use another valid row already in the check; the retired row remains recorded as superseded and its obsolete task is cancelled on reconfirmation. No automatic name matching or invisible merge is used. Legacy merge/Undo retains the snapshot; undo restores link validity when its catalog ID returns.

## Verification

`check-evening.mjs` exercises real API handlers and the client controller against all real SQLite migrations: dynamic/empty roster, concurrent start, new-day defaults, fixed snapshots, first-answer sequence, per-row revisions, incomplete/stale confirmation, injected transactional rollback, idempotent confirmation, empty plan, conflicting morning dates, Ready/Undo, correction/Ready concurrency, cancellation/reopening, identity/origin/scope/date checks, rename/deletion/replacement, actual legacy merge/Undo and explicit duplicate resolution. Client scenarios include rapid same/different-row input, lost responses before/after commit, reload, disposal, 401/account switches, reviewed conflict reapplication and unavailable local recovery. Shared request-body deadlines are additionally exercised by the existing stock regression.

The full regression runner currently contains 42 scripts. KitchenApp/useNotebook integration retains dirty and in-flight recipes during stock navigation. The private backup test and download validator now require all 18 tables, preserving owner-only export.

Browser QA uses `/private/tmp/labula-evening-qa` on port 5185 with 24 generated QA-only catalog items, never production responses. Verified: empty Track state, real test roster selection, 24-item rapid check with stable DOM order, 48 px controls and 57 px normal rows, 320/360/390/430 px and desktop without horizontal overflow, long names, scrollable long modal, Back/Escape and focus return, stale summary after a second tab changes an answer, reconfirmation, Ready/Undo, correction preserving Ready, and a real post-commit 3-second response delay with a local-only 1-second timeout, followed by navigation/reload/exact retry. Temporary fault code stays outside the source checkout. Final checks also cover text enlargement and removal of fault instrumentation.

## Deployment, data and rollback

Use the existing Sites project and custom private audience. Full backups and verification reports live outside the checkout in `../nasazeni-vecerni-kontrola-2026-09-23/`. Compare each pre-existing table before and after publication; never restore an earlier backup over newer chef work. Production smoke is read-only: do not start a check, change Track or mark a task ready.

Both migrations are additive; the second adds a nullable field. There are no new triggers or destructive migrations. A rollback can publish the prior v31 source/artifact while keeping all five tables, their data and both migrations applied. The older backup UI does not know these new tables, so retain the complete new backup procedure even during UI rollback. Prefer a compatible forward fix for a post-release issue.

Limits: no quantities, sufficiency, batch recommendations, automatic route learning, push updates or ordering. The browser refreshes on return; open confirmation dialogs rely on server revision guards. Recovery of uncommitted input depends on retaining the browser's site storage. Testing uses emulated viewports, not a physical kitchen phone or assistive-technology session.
