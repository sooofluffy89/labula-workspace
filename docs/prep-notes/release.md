# Prep instructions and chef feedback — variant A

Baseline: production v50, commit `1a5731cd8217229eb59cc6b264a3ffe4a2055a41`, custom audience revision 4. Implementation and isolated verification are complete. Publication is gated on a newly downloaded, verified complete production backup; no production migration or test content has been applied during development.

## Use

The owner opens an ingredient from Manage list or the shared ingredient detail and chooses **Edit prep instruction**. Save is explicit, at most 500 plain-text characters; an empty saved revision clears the default without deleting history. Cancel keeps the draft. The editor explains that changes apply to future checks only. Cook and legacy collaborators cannot change instructions through either the UI or API.

Evening and Morning show the recorded instruction under the item name, at most two lines plus Show more when clipped. Empty instructions add no placeholder. A confirmed service comment count opens feedback directly; opening the name keeps feedback collapsed. Comments are optional and submitted only with Add feedback. A comment on an unchecked or No action needed item never creates a morning task.

Evening and Morning share one check/item/catalog conversation, with each entry's authenticated author, phase, server time, known plan version and instruction revision. The owner can find paged cross-service comments and immutable instruction history in the ingredient detail and recorded feedback from the source/history surfaces. Cook retains only the existing operational access.

## Persistence and recovery

- Additive migration `0015_melodic_ted_forrester.sql`: four new tables, two nullable recorded-instruction columns, indexes and append-only history triggers. No default instructions or comments are seeded. Legacy rows remain null.
- Start and Add capture the instruction inside the operation transaction. Original command replay keeps the original snapshot. Confirm copies it to Morning. Unchanged reconfirmed tasks preserve Ready. Remapping captures the new identity's instruction; previous comments stay attached to their original catalog identity and historic source. Cancelled and superseded tasks retain history.
- Owner edits use CAS revisions. Comments use immutable operation IDs/payloads, transactional receipts and append-only audit events. A lost reply, reload or retry from another tab does not duplicate a comment or event. A comment does not increment answer or Ready revisions.
- Durable notes and drafts use a separate account-scoped local-storage namespace. They never rewrite the existing answer/Ready queue. Submission is accepted only after safe local persistence; storage failures retain text in the open tab and explicitly warn to copy it. Definitively rejected text can be retained locally for review. Uncertain commands keep their original identity.
- Finish verifies note capability and recovery even before the initial notes handshake completes, drains accepted comments for its check, then uses the existing fresh-summary / explicit-Confirm process. Optional unsubmitted drafts do not block Finish. An old server can retain the old Finish only when no undiscovered accepted note queue exists for the verified account.
- Existing incremental polling carries counts; full history is loaded on demand. No per-row GET, new transport, external provider or serial answer write loop was introduced. Comments cannot block local Ready/Undo.

## Verification

All **61 dynamically discovered regression scripts** passed, including fast-sync, calm-sync, actual calm-list handlers, roles, information links, operating calendar and complete private backup. TypeScript without emit, ESLint and a Sites production build passed. Raw logs are outside the source checkout in `../pokyny-feedback-release-2026-09-27/`.

New `check-prep-notes.mjs` exercises real controllers, routes, migrated SQLite transactions and authorization. It covers create/edit/clear/CAS; owner/Cook/legacy permissions; captured Start/Add snapshots and exact replay; Sunday→Tuesday; comments on unchecked/No action needed items; no task creation; Ready independence; lost committed ACK; reload and two-tab retry; additional queued comments; account isolation and changes; storage failure; paused members; pagination; legacy nulls; transaction rollback; instruction changes during a check; reconfirm with existing Ready; remap; cancellation; retired/merged catalog identity; historical lookup and append-only enforcement. It also covers Finish while the notes identity read is held and unsupported-server recovery.

`check-prep-notes-ui.mjs` executes actual editor/composer hooks and handlers: collapsed disclosure, restored unsubmitted drafts, explicit submission, literal text, limits, pending guard, owner Save/Cancel and non-owner hiding. `check-calm-ui.mjs` additionally connects actual StockWorkflow Finish to the real notes queue/routes and verifies that failed feedback sharing prevents the summary until Retry. Existing request/fast-sync tests cover body timeouts, stale replies, legacy transport, concurrent actors, partial conflicts, authentication and disposal. Private-backup tests compare the explicit inventory with migrated SQLite and reject a 29-table export as current-complete while recognizing it as legacy.

Browser verification used **only** an isolated synthetic SQLite copy at port 5199, with separate owner and Cook origins. It covered owner edit → new Evening → comments → Finish/Confirm → Morning → Ready/Undo/Ready → morning comment → owner History. Checked: no retroactive instruction on the older check; feedback on a No action needed item yields no task; offline accepted feedback blocks Finish and retries; a draft survives close/reopen; another client's incoming comment does not replace a typed draft; both authors remain visible; HTML-like text is literal; Cook has no management controls; keyboard Escape and focus return; desktop and real 320/390/430 px viewports with no horizontal overflow. Evening choices were 48×48 px, Morning Ready 56×48 px. Reduced-motion CSS was forced through a QA-only control: dialog/overlay animation none and Ready transition 0 s. No user OS setting was changed.

Evidence screenshots: `evening-390.png`, `morning-390.png`, `morning-feedback-390.png`, `owner-feedback-history.png`, plus 320/430 layouts and the two-client detail. All are synthetic examples, not restaurant data.

## Measured performance

Actual controllers, API routes and SQLite transactions; synthetic 60 ms HTTP round trip and 2 ms database round trip; three repetitions, medians; 80 items, 30 rapid Ready actions; peer polling starts 2.5 s after the burst. Initial page load/authentication transport is excluded. Transfer figures are uncompressed JSON request/response bytes, not TLS/compressed network traffic. The matched baseline is the original v50 source snapshot.

| Scenario | v50 | New, no comment | New, one comment |
|---|---:|---:|---:|
| 80 answers + summary + Confirm, all acknowledgements | 544 ms | 548 ms | 603 ms |
| HTTP writes/summary requests for that flow | 7 | 7 | 8 |
| JSON bytes for that flow | 183,732 | 208,986 | 209,450 |
| SQL round trips for that flow | 30 | 30 | 34 |
| 30 Ready, all acknowledgements | 217 ms | 224 ms | 218 ms |
| HTTP requests for Ready | 3 | 3 | 4 |
| JSON bytes for Ready | 30,182 | 34,902 | 35,366 |
| SQL round trips for Ready | 6 | 6 | 10 |
| Final confirmed plan visible to polling peer | 2,675 ms | 2,675 ms | 2,682 ms |
| Ready visible to polling peer | 2,571 ms | 2,568 ms | 2,571 ms |

The first real server commit was 37–39 ms after the burst began. The new comment committed at about 40 ms. Last flow commits were 467/472/518 ms for baseline/no-comment/comment Finish respectively. Durable local acceptance remained about 0.6–1.0 ms for the median worst tap in a run. In the browser, Ready → Undo → Ready painted in 12.7/10.2/10.3 ms while comment and Ready writes were delayed by 3 s. This is local feedback timing, not server confirmation.

The extra snapshots/counts increase payload size, but the batched protocol and request count for binary answers are preserved. These are controlled local results, not a production latency guarantee or evidence of server push. Raw matched results, peer measurements and browser logs are in the release evidence folder.

## Release gate and preservation

Production remains v50 until a fresh complete backup has been verified. Audience mode, allowlist and revision were re-read and matched the initial configuration exactly. No production instructions, comments, answers, Ready actions, Track, round, account or calendar changes were made.

Before publishing: obtain the full owner export, verify all 29 baseline tables/counts and untruncated values, store its hash outside this checkout, and recheck that production/source/audience have not changed. Use the existing Sites source/commit/archive workflow and unchanged custom audience. After deployment: obtain the full 33-table export, compare stable IDs and every original field, permitting only new nullable columns and legitimate concurrent user writes. Report the deployed version/commit and any such differences. Never restore the older export over later kitchen work.

Recovery: preserve all new tables, immutable receipts and both old/new local queues. Prefer a forward repair with the notes endpoints and compatibility contract intact. If the UI must be withdrawn, keep the compatible backend able to replay original note commands. Do not roll back to a backend that discards notes, drop new columns/tables, or replay an old backup over live data. Any actual database recovery must first use a separate restored copy and reconcile work recorded after the backup.

## Limits

- Instruction changes intentionally apply only to future checks; there is no in-place rewrite of an open check.
- Notes are free text, not measured quantities, production norms or automatic analytical corrections. Manifesto production exclusions and owner approval/apply separation are unchanged.
- Sharing still uses existing active/idle polling (2.5/10 seconds with backoff); offline work cannot appear on another device until shared. Each explicit comment has its own bounded save, independent from batched answer/Ready writes.
- Browser storage may be cleared by the user/device. Without working local storage the app cannot promise durable drafts; it warns and rejects unsafe optimistic submission. Confirmed server history remains separate.
- Browser simulation does not replace a test on the kitchen's actual phones, virtual keyboard and network. No physical-device or screen-reader certification is claimed.
