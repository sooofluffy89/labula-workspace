# Evening check: three cooks and faster receipt

Scope: A–F in the 2026-10-02 master prompt. Baseline: v67 / `30e1ada148e19ef8254565d65f77fee720ef1053`. No database migration or change to permissions, calendar, rounds, stations, Track, or Morning prep workflow.

## Receipt and safe close

The server must atomically commit the approved check and plan. The device validates the exact original operation ID, authenticated actor/account, check, target date, generation/version, check and plan revisions, and confirmation time. It persists a verified compact receipt before removing the full approval. A receipt proves that operation; it does not consume a sync cursor or establish live plan freshness.

`currentFinishReceipt` requires that the loaded check still matches that confirmed version and date, with no own pending writes, save, authentication, storage, or command error. `safeToCloseEvening` additionally requires no accepted Evening operations/resolution journals anywhere in the account's device storage, no unresolved Finish, and no accepted prep-note writes. The UI also checks the mounted note controller. Storage events invalidate this reassurance when another tab accepts work. Unsaved note drafts remain drafts; they are not automatically submitted.

Every confirmed Finish triggers immediate shared-plan verification. A later read failure leaves a valid operation receipt intact and offers a separate read retry. Correct or a later version invalidates current success. Morning completion keeps its existing freshness requirements; Evening no longer uses an all-Morning-ready message.

## Reads, refresh, and conflicts

Evening initializes compatible stock without building the administrative stock overview. Planning, notebook, calendar, check rows, answers, tasks, coverage and sync metadata are read from one planning batch. Start/Add reuse these consistent inputs; transactional CAS and the post-write read remain authoritative. There is no global cache, global writer lock, new transport, or more aggressive polling.

A same-scope refresh retains rows and local overlays with `Updating shared check…`. Changed scope uses loading and navigation epochs; 401/403 hide inaccessible rows. Freshness and accepted writes remain separate.

After explicit review, a definitively rejected identical answer can adopt the fresh same-generation result without a new answer event, author or time. Later different local intents remain ordered. Uncertain commands still replay their original IDs. Different values and generations still require review.

## Recovery and retention

All full Finish records are validated and scanned. Unresolved records are offered with their dates; same-check explicit supersession cannot hide another day's approval. Malformed data is preserved and blocks recovery with an explanation.

An explicit `Keep shared result` for a definitively rejected Finish stores a separate identity-bound withdrawal decision before clearing the rejected command. For an approval stopped before creating any confirm command, `Keep reviewed shared check` first verifies the exact displayed shared result. These decisions never create a successful publication. A stale tab rewriting the original full record cannot conceal the withdrawal. Unknown writes cannot be withdrawn through this shortcut. Original approvals and decisions remain available on the device.

Completed receipts use `labula-finish-receipt-v1:`; pending full approvals retain `labula-finish-v1:`. Explicit decisions use `labula-finish-resolution-v1:`. Older clients ignore the new namespaces and continue to use original command identities. Compact replacements are written, read back and validated before old records are removed. Retain 20 unprotected completed receipts plus the active receipt and completed ancestors referenced by unresolved approvals. Never delete unresolved/uncertain work, note drafts, operation queues, or server history. Cleanup runs before accepting a new approval, so a cleanup failure cannot leave a hidden accepted Finish.

## Verification and limits

The complete dynamic suite contains 85 regression scripts, including actual controllers, API handlers, SQLite, request-scoped authentication for three identities, storage interruption/quota, legacy negotiation, uncertain replay, multiple recovery journals and concurrent publication. TypeScript, lint and production build are required before deployment. Detailed raw measurements, browser results, screenshots and data comparison are stored outside the deployable project in `../evening-tri-kuchari-release-2026-10-02/`.

Controlled benchmarks cover 35/56/80 items, one/three independent clients, empty/one/all queued writes, and normal/slow injected latency, with ten repeats per combination. Memory-storage timings are not browser disk, human pace, production latency, or restaurant Wi-Fi. The final report distinguishes browser/UI evidence from controller/API measurements. Several-minute production waiting has not been reproduced; its cause is not claimed fixed.

Known audit items outside this scope: ingredient History requests lacking the stations capability header, and Morning layout-version changes during held pointer interaction. Physical phones and restaurant Wi-Fi require the pilot below.

## First controlled pilot (English)

1. Each cook signs in with their own account. The manager confirms the three accounts and station assignments before service; do not share a login.
2. Each cook checks their station. The station filter does not create a separate check. The total progress and Finish apply to the whole shared evening.
3. Each cook confirms their own changes are shared and tells the others. One agreed cook reviews the complete summary and presses Finish. This is pilot coordination, not a new permission; concurrent Finish remains safe.
4. Keep the app open until its real result appears. `Saved on this device` means not shared. Close only when `You can close the app` is shown for your account's work. Do not erase browser data to clear an error.
5. If another cook finished first, review the confirmed result and explicitly keep it if correct. Your rejected Finish is not a second successful publication. Different answers require a decision.
6. If your offline change returns after a colleague finished, keep the device data, reconnect, and review the difference with the manager. It cannot silently alter the published plan; use the existing correction procedure if needed.

The manager records actual opening/Start/Finish times on restaurant Wi-Fi, delivery between three phones, any conflicts, and confirmation of the correct target morning (Sunday → Tuesday). Stop the pilot and preserve device data if accepted work disappears, authorship is wrong, a duplicate plan appears, or safe-close is shown with waiting work.

## Rollback

Redeploy the prior code version through the same Sites project without restoring or resetting production data. There is no schema migration. Pending journals retain the old full format and immutable commands; completed compact receipts and withdrawal decisions stay on devices. An older client may require a shared reload and may show a previously withdrawn rejected Finish again; server CAS/idempotency still prevent a duplicate successful publication. Return to the new code to restore full decision visibility. Never clear local storage or roll back operational data.
