# Edit items — verification and release

Source baseline: `78f45d48cf93010c4b154f8a6b5046bc0e4c3172`. Published baseline verified as Sites v50 (`1a5731cd8217229eb59cc6b264a3ffe4a2055a41`), custom audience revision 4. Includes the previously unpublished compatible prep-notes migration 0015; this UI adds no tables.

## Delivered behavior

- All three rounds use Edit items. First entry filters to In this round; account/round-scoped preferences restore search, six existing filters plus confirmed-instruction filter, collapsed groups and scroll. Selection remains in its original independent recovery namespace.
- A single owner-only bulk read supplies confirmed previews. One inline editor reuses the same controller, draft key, operation queue and CAS backend as ingredient Details. No per-row history fetching.
- Save instruction and membership Review/Confirm are independent. Drafts survive Cancel/navigation; storage failure blocks hiding the text. Empty saves retain revision history.
- Cross-tab completed writes refresh confirmed previews and feedback through the existing storage event, without added polling. Stale editors must explicitly load and review the latest text before a new save.
- Instructions still apply only to future checks. Start/Add capture the version, Morning inherits it, and historical checks are unchanged. No restaurant instructions or feedback were filled in.

## Verification

63 dynamically discovered regression scripts pass, including new real API/controller and CheckRounds handler tests, existing notes UI, roles, rounds, backup, fast-sync/calm-list and operations tests. TypeScript, lint and production build are release gates; final raw results are outside the source tree. Existing information/root test stubs were updated for the shared editor/provider. The operations test’s two-argument SQLite clock stub was corrected so fixtures do not depend on the actual calendar date; no production calendar behavior changed.

Browser checks used only isolated synthetic data at localhost:5199: all three entries, restored filters after reload, shared inline/detail draft, explicit Save, Without instruction retained during offline pending and removed after ACK with heading focus, two-tab stale revision conflict and explicit resolution, membership move preserving instruction/Track, old recorded instruction vs new Evening and Morning. Real viewport widths 320/390/430 and desktop, 500 characters including diacritics, long names/words, keyboard Enter/Escape, focus and QA-forced reduced-motion were checked. Physical phone keyboard and screen-reader certification are not claimed.

The browser instrumentation measured one `/api/prep-instructions` GET (655 bytes in that synthetic sample) and one rounds GET (22,840 bytes) for 80 ingredients. Opening one empty editor added one detail GET (167 bytes). Sizes vary with actual text/history; these are response JSON bytes, not compressed network traffic. No 80 per-item history requests.

## Controlled sync benchmark

Actual controllers, API routes and SQLite transactions; synthetic HTTP RTT 60 ms, SQL RTT 2 ms, peer polling at 2.5 s, three repeats per case. Baseline re-run from an isolated v50 source archive. These local medians are not production latency promises; the timing difference does not establish a speed-up.

| Scenario | v50 ACK | New ACK | HTTP | JSON bytes | Peer visibility |
|---|---:|---:|---:|---:|---:|
| 80 answers + Finish | 635 ms | 552 ms | 7 | 208986 | 2673 ms |
| 80 answers + Finish + comment | 635 ms | 609 ms | 8 | 209450 | 2703 ms |
| 30 Ready | 238 ms | 212 ms | 3 | 34902 | 2569 ms |
| 30 Ready + comment | 238 ms | 227 ms | 4 | 35366 | 2571 ms |

Binary answer/Ready batching and endpoint transport are unchanged. Recorded instructions/comments increase snapshot bytes as already documented by prep-notes; no new polling was added.

## Preservation and publication

Before export validated against the deployed legacy-notes inventory (29 tables). After publication the additive notes schema requires the full 33-table inventory. Compare stable keys and every original field, preserving legitimate concurrent activity. Private exports, hashes, access policy and screenshots are outside the checkout in `../edit-items-release-2026-09-29/`. Never restore a pre-release export over later kitchen work.

Deployment version, exact source SHA and post-release data comparison are recorded in the private release receipt and final delivery after success. Existing custom audience and owner/Cook/legacy boundaries must remain unchanged.

## Limits

Free text is not a measured quantity or stock calculation. Existing checks deliberately retain recorded text. Offline changes stay local until acknowledged. Device storage can be cleared externally; failed persistence is explicit and blocks leaving the editor. Recovery must preserve prep-note tables, receipts and both old/new browser queues; use a forward compatible repair, not a rollback that drops notes.
