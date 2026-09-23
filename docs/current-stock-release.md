# Current stock list — 2026-09-23

## Delivered scope

The new **Aktuální zásoby** main tab configures the shared kitchen stock-check roster. Every saved catalog ID starts included with Track Off, including unused and Manifesto-associated catalog items. No stock quantity or physical check is inferred. Track choices are made by the kitchen. Removing an item affects this roster only; Add items restores existing catalog entries with Track Off. Names, aliases and types come from the saved catalog, with stable alphabetical ordering, accent-insensitive search, three filters and global counts.

## Persistence and safety

Migration `0006_heavy_multiple_man.sql` adds `stock_items`, `stock_commands` and `stock_catalog_effects`. The fixed `kitchen` notebook is the app's existing shared scope; the dedicated tables use that same single-kitchen database. Explicit removed rows remain as tombstones. GET initializes missing saved IDs idempotently. Stock writes never update notebook/review content or revision. Whole-notebook saves and restores do not carry stock configuration.

Each command contains explicit target states, a UUID and expected per-item revisions. The server transaction inserts an actor-bound immutable receipt only when *all* changes are valid, then applies all changed rows atomically. Retries resolve the same command; unrelated item edits can succeed concurrently. Same-item conflicts require a fresh comparison and explicit reapplication or keeping shared settings. Database triggers atomically transfer merge membership/Track using OR semantics and preserve before states. Undo rejects changed stock revisions rather than overwriting later choices, including operations from older recipe clients.

Browser recovery records are separate keys per stable account ID, kitchen and operation UUID. They survive tab navigation, reload and page closure; different tabs cannot overwrite each other's record. The client checks the currently authenticated stable identity before replay. A response is bounded through complete JSON consumption by the existing 30-second request helper. Uncertain requests remain recoverable; late callbacks after disposal do not update UI. Storage failure prevents starting a write. The stock controls serialize unresolved commands, while the rest of the application remains usable. Recipe saved status now explicitly says **Recipe changes saved**.

The full private backup now includes all 13 tables; both the endpoint and its download validator were updated. Existing chef/owner permissions and private Sites audience are unchanged. Inventory membership does not change any Manifesto production exclusion, recipe completion, preparation answer or owner approval.

## Verification coverage

`check-stock.mjs` executes the real API routes and client controller against transactional SQLite with all migrations. It covers dynamic/empty catalogs; initialization and tombstones; toggles/removal/multi-add; reload/account sharing; stale per-item revisions and atomic rejection; exact receipts; anonymous/origin/invalid-command rejection; stable IDs across rename/alias/activity/restore; unseen unsaved IDs; actual catalog merge and undo, including a stock write racing the merge; pre/post-commit network faults; authenticated recovery; 401/account changes; repeated clicks and unmount; explicit conflict review; unavailable recovery storage; real request deadlines covering hanging response bodies and late replies.

`check-kitchen-preparation-integration.mjs` additionally exercises actual KitchenApp/useNotebook navigation to stock with dirty and in-flight recipe edits. Inventory receives only account/visibility props and has no callback that can replace the notebook. The complete existing suite, type check, lint and production build are required at release.

Browser QA uses a separate copy and synthetic database at `/private/tmp/labula-stock-qa`, port 5183: four QA-only catalog items, aliases and a long preparation name. Checked desktop, 390px and 320px layouts; keyboard toggles and focus after a filtered item disappears; search/filters; removing every item and reloading the empty list; multi-add and all-included empty dialog; two tabs editing different rows; same-row conflict with fresh comparison and keeping shared settings; deliberately truncated response after a committed multi-add, leaving/reopening stock, reload and same-request retry. Fault code exists only in the disposable QA copy and is removed after the scenario. API identity tests use synthetic users; no real chef account is impersonated.

## Deployment and rollback

Deploy to the existing Sites project and URL only. Keep the custom sharing policy. Save and compare complete private backups outside the checkout, preserving any intervening chef changes. Production smoke checks are read-only apart from idempotent creation of initial stock configuration. Do not switch actual Track settings or insert QA items in production.

If rollback is needed, prefer a compatible forward fix. The prior UI/build can run with the three additive tables and triggers retained; hide the new tab by restoring the earlier code version without reversing the migration or restoring an older database. Preserve stock tables and their receipts. An older backup UI exports only its known tables, so keep the complete 13-table backup procedure for recovery. Never overwrite newer kitchen work with the pre-release backup.

## Limits

This first version selects a future nightly checklist; it does not record amounts, inventory dates, target stocks or morning prep tasks. Refresh/on-return loading is used instead of real-time push. A pending stock command must be resolved before another stock command is started in that client. Browser recovery depends on retaining site storage; the shared committed configuration remains in D1. No physical phone or screen reader was used in QA.
