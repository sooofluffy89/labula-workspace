# Checking stations — 2026-10-02

Station 1 / Station 2 / Station 3 divide the evening roster by checking location. One stock item has one responsible checking station; Not assigned remains valid. All chefs can help on any station. The check and its Morning prep remain shared.

## Manager workflow

Manage list → select items → Assign station → choose a station → review every original/new value → Save station. The same editor handles individual rows. Cancel does not save. Selection survives filters and includes a count of hidden selected items. Checking station combines with existing filters using AND; menu selections keep OR semantics. Old personal views default to All.

Only Owner/Manager can assign stations, enforced on the server. A new check captures assignments transactionally; later manager changes cannot move rows of an existing check. Explicit Add captures the new row's current assignment. Old rosters are shown as Not assigned with a message that stations were not recorded; historical information says Not recorded. No real items were assigned by this release.

## Safe persistence and compatibility

Independent station revision and account-bound command IDs; atomic all-or-nothing CAS and audit; original request retry after lost ACK, timeout, reload or account change. Conflicts keep the selection, show shared values, require refresh and explicit renewed review. No-op choices do not create fake audit changes. Independent station metadata survives remove/re-add and merge/Undo without overwriting a later target assignment.

Migration 0016 creates two empty metadata/receipt tables and one nullable answer snapshot column. No backfill or operational settings writes. Backup inventory grows from 33 to 35 tables with stations:1 marker. Complete older backups remain explicitly legacy; incomplete current backups fail validation. No new restore tool.

## Evening and Finish

All groups by checking station; a selected station is a flat stable list. Counts include safely accepted local answers and remain distinct from server receipt. Global progress, queued writes and conflicts remain visible across filters. Preferences are local per account/device. Tabs wrap, empty stations allow Show all, keyboard focus and reduced-motion information are retained. Return to first item switches stations and returns focus to the actual answer button.

Finish always includes the entire roster. One final confirmation, durable v61-compatible approval/intent, existing batch/delta sync and background publication stay intact. Safe-close text requires atomic server publication. Checking station is presentation metadata and does not change the approved-content fingerprint. The source detail, history and CSV retain the recorded station; Morning Ready/Undo and grouping are unchanged.

## Verification

76 regression scripts, TypeScript and lint passed after the final source/history and recovery additions. Three new scripts cover real controller/API/SQLite atomic assignment, role/CAS/rollback, durable retry, two identities/delta sync, publication, old v61 Finish recovery, populated additive migration, merge/Undo and real source/history/CSV projections. Browser QA uses an isolated DB with synthetic Owner/Cook/Helper accounts; real 320/390/430 widths, long names, keyboard, reduced-motion CSS, hidden selection, offline reload, global filtered Finish, source authors/stations and Morning Ready/Undo were checked.

Evidence including build/deployment receipt and before/after private backup comparison is outside the source tree: /Users/johnny/Documents/LABULA/stanoviste-release-2026-10-02. Do not publish the private exports, QA identities or temporary QA auth.

## Performance limits

80 synthetic answers; three runs at each added HTTP delay, slow profile adds 5 ms per D1 trip; real routes/controllers and in-memory SQLite. Peer measurement is an explicit fresh read, excluding the poll timer. Values are means in ms, not production latency or a statistically established speedup.

| HTTP delay | All answer ACK before / after | Finish before / after | Fresh peer before / after |
| --- | --- | --- | --- |
| 20 ms | 128.6 / 131.3 | 181.5 / 179.0 | 40.3 / 37.3 |
| 500 ms | 2647.2 / 2638.9 | 3703.4 / 3681.8 | 612.8 / 601.4 |

Finish+peer uses the same 8 HTTP/28 D1 trips; bytes 235419 →239499 (+1.73%). Filters read the already loaded snapshot; no station-specific request. Browser filtering may coincide with the existing incremental poll, which is retained for concurrent chefs. Network receipts remain subject to actual connectivity; stations add no new sync transport.
