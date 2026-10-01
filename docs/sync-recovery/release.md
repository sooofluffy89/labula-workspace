# Sync recovery / nonblocking work / Finish — 2026-10-01

Baseline: v59, `333c6a6d908526475f5f6f86eea21caff79fa988`. Source and production matched before work. Evidence directory: `/Users/johnny/Documents/LABULA/obnova-sync-finish-release-2026-10-01`. Publication metadata and post-deployment comparison are recorded there after publication; this document describes the tested source.

## Result and scope

Exhausting the three network retries no longer permanently stops the outbox. Focus, online and successful existing synchronization can start a fresh, identity-verified recovery series. A 15-second cooldown, one recovery flight and the existing single writer prevent a request storm. Retries retain original command IDs, durable local storage and per-item conflict handling. Authentication/permission rejection and invalid batch requests stop automatic network recovery; content conflicts require a reviewed choice. Reload restores the unchanged journal format and schedules recovery after loading the original context.

Retry reads no longer globally lock safe answers or Ready/Undo. The controller still guards identity, storage failure, Finish and incompatible operations. Local persistence precedes UI acceptance; pending intents overlay incoming shared data. The existing compact status bar counts **changes**, not unique items, and distinguishes local storage, sending, verification and server receipts. After about four seconds it adds an explanation without changing operation success or timeout policy.

Ingredient-group and pause-member dialogs show progress, uncertain failure and retry inside the modal. Group selection survives refresh of the same revision; a genuinely different revision requires explicit comparison. Closing/reopening retains the original uncertain request; successful retry reuses its ID. Pause keeps permissions and owner protections unchanged.

Finish shares an in-flight poll only when selection, context epoch, snapshot serial, accepted intent epoch and an empty outbox at read start remain compatible. Otherwise it aborts/replaces only the obsolete read. A separate epoch guards both the response and finally; writes are never cancelled to pretend that they failed. Summary remains bounded by existing read/page limits and CAS publication guards.

## Negotiated publication contract

New fast-sync clients send `X-Labula-Confirm: 1`. For Confirm only, a successful response contains `operationId` and `publication` (protocol 1, actorId, checkId, targetDay, publication version, resulting check and plan revisions, confirmedAt, confirmedBy). The metadata is persisted with the receipt **inside the existing atomic transaction**, and returned only after the committed receipt is verified. The first transaction also selects and returns the actual resulting check header and morning tasks as `plan`; tasks are never fabricated from the local answer cache. Reads are inside the atomic batch and do not add a full `readEvening()` after commit.

A replay returns the original publication receipt without republishing. If its plan is absent, the client shows “Check published. Loading shared Morning prep…” and requests the narrow authenticated `/api/evening?day=…&publication=1` read. Failure here retries only that read, not publication. UI remains guarded until actual tasks load. The compact reply does **not** advance the sync cursor or prove whole-plan freshness: `needsVerification` remains set, and existing delta synchronization must consume unseen events before completion is claimed.

Clients without the header continue receiving the original `snapshot` response. New clients also accept that response from an older server. The legacy fallback does not negotiate the new reply. No schema migration, journal format change, provider, transport, role, calendar, Track, round or production-content change was introduced. Existing open tabs must refresh when their pending work is safely preserved to run the new UI, but their protocol remains supported.

## Verification

- Full `npm run check`: **71 regression scripts passed**, including two new suites using actual controllers, API handlers and SQLite transactions.
- TypeScript and lint passed. Production build passed; the publication workflow builds the final source again before packaging.
- New `check-sync-recovery.mjs`: exhausted retries fast/legacy; throttled simultaneous hints and one writer; held Retry GET accepting new durable answers; compatible poll reuse/obsolete replacement; identity rejection; lost compact ACK and exactly-once replay; failed publication read/read-only retry; old/new server compatibility; storage rejection; held GET with Ready/Undo/Ready and retained cursor.
- New `check-recovery-dialogs.mjs`: actual component handlers/hooks and API/SQLite; same-revision selection retention; changed-revision comparison; group uncertain retry across close/reopen; synthetic member pause retry with one committed operation.
- Existing fast-sync, calm-sync/UI, evening/morning, motion, roles, activity, disposal/navigation and concurrency suites cover stale ACKs, independent conflicts, reload journals, revoked permissions, changes between summary and Confirm, and completion guards. No tests were suppressed.
- Actual browser against a disposable SQLite database: 80 offline answers, automatic return of sending without Retry, Finish/Confirm/Morning, 30 rapid Ready with slow writes, separate owner and helper clients and concurrent shared task conflicts, original-request retry in both dialogs. Conflict comparison preserved both values; explicitly keeping shared data resolved the test conflict. No production responses or Ready were entered.
- Chrome actual viewport widths 320/390/430 px (844 px height), desktop, keyboard Space for Ready. QA forced the reduced-motion CSS branch and observed zero transition duration; existing motion tests passed. This is desktop responsive testing, **not native physical-phone or OS preference testing**. The forced CSS and all synthetic identities/network controls exist only in the disposable preview, outside shipped source.

Screenshots: `evening-waiting.jpg`, `evening-saved.jpg`, `finish.jpg`, `morning-syncing.jpg`, `morning-320.jpg`, `morning-390.jpg`, `morning-430.jpg`, `morning-conflict.jpg`, `group-dialog-error.jpg`, `team-dialog-error.jpg` in the evidence directory.

## Comparative measurements

Real application controllers/API/SQLite, synthetic per-HTTP delays of 60 ms / 800 ms and per-database-trip delays of 2 ms / 20 ms. Identical datasets: 80 answers and 30 Ready. Normal condition has five runs per scenario/phase; slow has three. Values below are medians. These are **not production measurements** or browser rendering timings.

| Measurement | Before normal | After normal | Before slow | After slow |
| --- | ---: | ---: | ---: | ---: |
| Local accepted action, median maximum per 80-answer run | 0.84 ms | 0.76 ms | 2.40 ms | 0.67 ms |
| First answer to server receipt | 38.04 ms | 38.37 ms | 452.09 ms | 445.64 ms |
| Last of 80 answers to server receipts | 331.09 ms | 310.58 ms | 3863.26 ms | 3829.70 ms |
| Finish with 80 waiting answers to current summary | 437.02 ms | 414.01 ms | 5117.70 ms | 5077.43 ms |
| Confirm to authoritative publication / usable actual tasks | 147.03 ms | 92.67 ms | 1226.70 ms | 920.04 ms |
| Last of 30 Ready to server receipts | 178.25 ms | 172.91 ms | 2159.71 ms | 2137.08 ms |

The Confirm route now uses **5 database trips versus 17**, with **17,777 response bytes versus 87,299** for the same 80-item data. Entire 80-answer/Finish/Confirm scenario: 7 HTTP requests in both phases; database trips 29 → 17; response bytes 199,904 → 130,382. Ordinary answer/Ready throughput is essentially unchanged; the main gain is removal of redundant reads and reliable recovery, not a faster network.

Separate before/after recovery and compatible-poll experiment: three runs per phase/network condition (12 total). A compatible already-running poll was held for 100 ms after its request; Finish with an empty outbox took 174.04 → 101.35 ms normally and 955.75 → 101.38 ms on the slow condition. There is no second serial poll. After the exhausted retry series and a successful service hint, all 80 waiting writes resumed automatically: before left 80 pending, after left zero (median 480.62 ms normal / 5300.88 ms slow). **Only for this experiment**, 2/4/8-second retry timers were accelerated to 10 ms and the 15-second cooldown was explicitly elapsed. Real polling/cooldown scheduling adds waiting time and these numbers are not a promise of immediate recovery.

Commit-to-second-client display with an immediate second-client read: 99.96 → 101.58 ms normal and 1247.74 → 1249.23 ms slow, effectively unchanged. Existing 2.5–30-second polling scheduling is excluded from that measurement and remains in production. Raw JSON/logs: `baseline-normal`, `after-normal`, `baseline-slow`, `after-slow`, `recovery-comparison` in the evidence directory.

## Data safety, publication and recovery

Before publication: fresh full private export `production-before-latest.json`, captured 2026-10-01T10:36:15.551Z, all 33 expected tables, SHA-256 `02866b61e89ba84e580f537f4e76a50c0d8536acc8c2f83e10f8c9c6d30c133f`. Earlier before export retained separately. Sites private custom audience verified unchanged revision 5 with the existing owner and two external viewers. Never publish QA overrides, seeds, backups or browser metrics in the application archive.

After publication: inspect saved version/deployment; read-only production Evening/Morning/Manage smoke; collect complete export and compare tables/rows using stable identifiers and normalized contents. Preserve any legitimate intervening user writes; do not restore an older backup over current operations. Final deployment and comparison records live outside the shipped repository in the evidence directory.

Recovery is compatible code repair or redeployment of the previous version without resetting the database/browser storage. Receipt extra JSON fields are backward-compatible; a prior server still returns its snapshot. Keep original pending IDs and any committed receipt; do not reconstruct uncertain commands or remove history. A replay can use the original receipt without creating another publication/version.

## Remaining limits

Initial complete notebook/stock bootstrap and wide History/other permissions loading were deliberately outside scope. They can still wait on slow service. The historical 5–6-minute delay was not reproduced; this change does not claim to eliminate every possible cause. Background polling is still bounded and not push delivery. Content conflicts, identity/permission failure and broken local storage still require explicit resolution. Narrow publication read can fail after a successful commit and then shows loading/retry; success is not inferred from cache.
