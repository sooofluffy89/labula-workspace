# Fast saving and incremental synchronization — 2026-09-27

## Result and boundary

The item write path now uses bounded HTTP batches and small acknowledgements. Evening check and Morning prep consume incremental changes while their own writes are pending. Finish drains durable local commands, reads a current shared summary, and retains explicit confirmation with transactional revision guards.

The transport is **adaptive incremental polling**, not server push. The installed Sites 0.1.71 contract exposes D1/R2 and the project's current D1 binding; its documented manifest/tools do not expose a supported cross-instance subscription coordinator or Durable Object binding. General Workers SSE support is insufficient evidence of supported authenticated cross-instance broadcast in this Site. No undocumented binding, in-memory broadcast, external broker or new provider was introduced. Actual SSE/WebSocket push remains incomplete. The smallest follow-up is a supported Sites coordinator/binding with authenticated subscriptions, reconnect/catch-up and revocation tests across instances. HTTP writes must remain independent of that transport.

## Verified bottlenecks

v47 sent each queued item serially, with full reads before and after each POST. Those reads repeated stock initialization, notebook derivation and planning work. The old background refresh waited 30 seconds and skipped pending local work. These are measured costs; they do not alone prove the cause of the user's particular uninstrumented 5–6 minute wait.

For 80 answers and Finish, the measured protocol cost fell from 82 to 7 HTTP requests, 2,443 to 30 SQL round trips, and 5,075,712 to 176,779 JSON request/response bytes. For 30 Ready it fell from 30 to 3 requests, 900 to 6 SQL round trips and 2,424,160 to 30,181 bytes. Initial application loading and seeding are outside those scenarios.

## Protocol and integrity

- `/api/evening/batch`: at most 20 answer/ready commands for one check; first command leaves immediately, backlog travels together. One writer request is in flight. Every original command retains its ID, immutable normalized payload, author and client timestamp. Each receives its own saved/conflict/blocked result.
- A D1 transactional batch contains CAS, audit event, state change and receipt. Technical errors roll back the transaction. Logical item conflicts reject only dependent changes; unrelated items continue. Same-value stale requests do not invent authorship. Ready → Undo → Ready remains three accepted events.
- Authorization is checked against the current active member on every request, and writes include active-member guards. No permission cache or new privileges. Cook remains limited to the operational endpoints.
- `/api/evening/sync`: read-only cursor over the existing audit's stable SQLite row order. Cursor is bound to account and selected date/plan. A captured high-water mark, pages of 128 and a subsequent catch-up prevent boundary commits from being skipped. Metadata/structural events trigger a full refresh. Every table is unchanged by pure sync reads.
- Selected changed rows and cursor high water are read in a single transaction. Client state uses nondecreasing item revisions; incoming data does not replace local pending intents. ACKs never advance the read cursor. Old scope replies are ignored.
- Visible activity polls every 2.5 seconds, idle after two minutes every 10 seconds; hidden tabs skip polling and resume on focus. Errors back off up to 30 seconds. Manage/History are not polled. Polling is bounded and does not fetch the complete notebook per item click.
- Finish locks conflicting handlers from the initial click, flushes the queue and obtains a fresh summary. Confirmation uses a narrow catalog/check read and the original atomic publication guards. A changed shared summary needs new explicit confirmation. Failed/cancelled/unmounted transitions release the guard; durable intents survive.
- Existing v47 local storage/recovery entries and the single-command endpoint remain supported. A snapshot advertises protocol capability, so new clients use batches only after a compatible server responds. There is no schema migration or separate history database.

## Failure recovery

Lost request/ACK/body timeout retries the original IDs and payloads. Independent offline clicks remain available after durable local persistence; quota failures reject an unsafe optimistic acceptance. Mixed conflict plus unknown receipt offers `Retry remaining saves` before conflict resolution. Explicit reapplication uses the existing new-ID recovery mechanism. Old offline answers cannot silently change an already published plan.

Local browser storage can be cleared by the user/private browsing; it is not a server backup. Other offline phones' unsubmitted changes are unknowable. Client clocks are retained as reported, while server times/authors remain authoritative for persistence. No changes are auto-confirmed for a chef.

## Measurements

Measured with the actual controller, API, migrations and SQLite; 80 synthetic items; five runs per normal scenario; 60 ms synthetic HTTP round trip and 2 ms per database trip. SQL row counts are rows returned, not internal scanned rows. Authentication transport is synthetic; actual member/CAS SQL executes. These are local comparisons, not production D1 latency or p95 guarantees.

- 80 answers: Finish → current summary approximately 14.86 s → 0.43 s median. Confirm → server acknowledgement approximately 0.21 s → 0.15 s.
- 30 Ready: last tap → complete acknowledged queue approximately 5.51 s → 0.23 s median.
- Synthetic 3 s per HTTP request (one stress run): 80-answer Finish 253.60 s → 18.10 s; 30 Ready total 93.83 s → 9.07 s. This earlier stress run preceded the additional narrow confirmation read.
- Separate five-run peer tests measure actual COMMIT → second controller, not the local checkbox. The fallback delivers in its 2.5 s interval plus read latency. Full raw values are in the release evidence directory.
- Real browser QA, separate local database and Owner/Cook tabs: warm 30 Ready paint median 14.4 ms, max 28.6 ms; last click → ACK 32 ms; last commit → second tab's DOM 1,699 ms. 80-click Finish → dialog 62 ms and confirmation → completed DOM 409 ms while writes had already drained during clicking.
- The first cold dev-browser run had 12/80 paints above 100 ms (maximum 329.8 ms). That is not represented as a universal response-time guarantee.

Full raw runs and comparison: `/Users/johnny/Documents/LABULA/rychly-sync-release-2026-09-27/mereni.md` and adjacent JSON files.

## Verification matrix

`scripts/check-fast-sync.mjs` uses real SQLite transactions and real routes/controller. It covers rapid ordered changes, partial conflicts/dependencies, transaction rollback, exact lost-ACK replay, unfinished body timeout, offline extra clicks, old-format durable recovery, quota failure, same-account two-tab drain, distinct actors, remote merge during writes, stale ACK, 5,000 audit events over 40 pages with a concurrent boundary commit, read-only tables, metadata reset, cancelled task rejection, Finish double activation/handler lock, stale summary/reconfirmation, immutable published versions, Ready history, pause/anonymous access and disposal/recovery.

All existing scripts remain in the runner. Four controller tests explicitly select legacy transport to retain old-client protocol coverage; their behavioural assertions remain. Calendar/deadline/history/permissions/review/notebook suites cover unchanged semantics. Final release runs the complete 57-script runner, TypeScript, lint and production build.

Browser QA covers actual Evening → Finish → confirmation → Morning, Owner/Cook peers, slow/offline Ready and retry, correction/reconfirmation preserving Ready, stable rows and compact layouts. CSS body widths are distinguishable from viewport emulation. Physical phones, reliable 320/390/430 native viewport emulation, OS reduced-motion and cross-instance push are not verified here; push is absent by design. Existing motion/focus/navigation regressions still run. Test auth, network injection, seed tools and DOM measurement harness live only in a separate `/private/tmp` checkout and are excluded from deployment.

## Release and recovery

No data migration. Preserve 29 application tables, current audience revision 4, original calendar targets, Track/round assignment, recipes/reviews and local outbox format. Back up production before and after deployment; compare rows by stable IDs and original values. Never restore the earlier backup over legitimate concurrent work.

For an incident, prefer a forward fix retaining both endpoints and receipts. Pause the read timer independently of the batch writer if necessary; do not delete pending browser records. A v47 UI can still use single writes against the new server. Reverting the whole backend is not the default remedy because already-open new clients may still call `/batch` and `/sync`. Push has no release dependency and cannot block writes.
