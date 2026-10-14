# Morning prep A — compact mobile list

The existing Current stock → Morning prep view now uses stable 53px rows with a 56×48px checkbox target on the right, full wrapping 16px names, and separate House-made prep / Bought ingredients · Restock headings. Only the right target changes readiness. Checked items stay in place; toggling again undoes Ready. The detail disclosure retains the source confirmation and each task's last server-saved actor/time. There is no Finish morning, quantity or new planning rule.

## Saving and compatibility

The existing EveningController now queues Ready intents as well as evening answers, with immediate separate optimistic overlays and monotonically ordered recovery timestamps. Reading the latest visible task inside toggleReady avoids closures losing rapid Undo/Redo. Ordinary Ready writes leave other rows enabled; structural commands still require the queue to settle. Every sent command keeps its ID and original payload. The existing server's per-task CAS, actor-bound receipts, mapping checks and plan revision guards are unchanged. There are no schema migrations, dependency changes or new access rules.

Ready overlays never alter authoritative task metadata. Waiting rows show an ellipsis and left accent; the shared saving status distinguishes local intent from committed work. All morning items ready requires an actual confirmed nonempty plan, every active task Ready with a valid link, no pending writes, no error/loading/saving/unauthorized state. No plan, unfinished check, confirmed empty plan and failed load remain distinct.

Rejected Ready changes show the item, local intent and shared result. Explicit reapplication uses new IDs and fresh per-task revisions. If a refresh changes the displayed plan/catalog during that choice, the user reviews the new comparison before choosing again. Cancelled or unmapped tasks cannot be revived by reapplication. A small device-local resolution journal makes replacing rejected requests recoverable across partial storage failures; it is fully materialized before any replacement is sent. Original v32 operation keys and payloads remain readable. Unknown/sent operations are never discarded as rejected.

The queue does not change the selected morning date on each save. Recovered work for another check is announced. Original evening confirmation, correction, catalog mapping, recipe-save isolation and Manifesto production exclusions remain in force.

## Verification / release

Run check-all (43 scripts at implementation), TypeScript, lint and production build. check-morning executes the actual controller, API, SQLite migrations and React MorningList. It covers a 24-row queue, repeated same-item changes, exact before/after-commit retries, disposal/reload, tied clocks, local quota failure, identity changes, reviewed conflicts, interrupted recovery replacement, legacy Ready records, correction concurrency/cancellation, catalog removal and unchanged notebook/stock data. Existing evening and stock suites cover confirmation atomicity, auth/origin, request-body deadlines and catalog merge/Undo.

Browser QA uses only 24 synthetic QA items at /private/tmp/labula-evening-qa on localhost:5185. Fault instrumentation remains solely in that disposable copy. Production checks are read-only. Release evidence and complete before/after backups live outside the Site source in ../nasazeni-morning-prep-2026-09-23/.

Rollback: prefer a forward fix. A prior UI remains compatible with the unchanged server/schema and saved Ready commands. For any rollback, preserve all server data and browser recovery, including resolution journals; do not clear site storage or restore an old database over newer kitchen work. Older UI cannot finish a new resolution journal, so retain this recovery implementation until those local changes are resolved.

Limits: availability only, no quantity/sufficiency, batch recommendations or automatic reordering. Shared refresh occurs on return rather than via push. Unsynced recovery needs the same account and retained browser storage. Mobile verification uses emulated viewport sizes, not a physical kitchen phone.
