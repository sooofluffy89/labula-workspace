# Track On/Off in Check rounds → Edit items

Baseline: v57, source 905d6c053d2ded4e46c745e12236ae0528db29e2. No migrations or runtime data conversion.

## Delivered

- Accessible Track On/Off on desktop and mobile, separate from membership move and quantity instructions.
- Off requires named confirmation with the saved round and explicit future-check/derived-morning impact. Cancel, Escape and Close do not write. On is immediate without a confirmation, but the displayed value changes only after the server reply and shared read.
- Default first-entry view is In this round + Tracked. Existing personal views and saved filters are preserved intentionally. Tracking is visible above the list; Not tracked finds retained inactive membership. Clear filters still means all items.
- Cards and selected-round summary distinguish active, tracking off, and retained assignments outside the stock list. Current round means stored assignment, even while tracking is off.
- Off retains round_id, group, instructions and list membership. On returns to that same round; only an unassigned item defaults to Daily. All actual schedules, Track selections and chef workflows are untouched by deployment.
- Success moves focus to a stable heading if the item disappears. Cancel restores its trigger. Brief 400 ms post-ack click protection prevents a rapid second toggle landing on the next row; it does not delay the write or determine success.

## Persistence

An additive `track` command on the existing `/api/check-rounds` route uses its original durable actor-scoped queue and receipts. Existing day/member payloads remain valid. The transactional receipt checks manager permission, active member, shared planning revision, item revision, catalog existence and included status. Activity contains old/new Track, round and authenticated actor; a single timeline transition is emitted. No-op and exact replay cannot duplicate history or overwrite a later choice.

Unknown outcomes retain the original immutable operation for Retry, including reload and navigation/unmount. A definite 400/403/409 rejection needs a fresh shared read and explicit dismissal/review. An unacknowledged local intent never optimistically deletes a row. Cook permissions, fast-sync endpoints, answers, Ready, recorded checks/tasks and prep instructions are unchanged.

## Verification

- 69 regression scripts, TypeScript and lint passed. Final production build is run by the official Sites workflow.
- New `check-round-tracking.mjs`: actual SQLite/routes/controller; all three rounds, remembered/default membership, no-op and replay, filter/counts, timeline and actor, CAS conflict/rollback, Manager/Owner/Cook/anonymous, future exclusion and frozen draft/published tasks/Ready, pre-send failure, lost committed ACK, restored queue, duplicate click and unmount.
- Extended actual CheckRounds handler test: Cancel/close no request, Off removes after success, Not tracked recovery and confirmation-free On. Existing instruction draft, filters and bulk selection checks remain.
- Browser QA used `/private/tmp/labula-frequency-qa` with independent synthetic DB/auth, two managers and no production writes. Verified Off/On, Cancel/Escape/focus, stale confirmation conflict and shared-review recovery, widths 320/390/430 without horizontal overflow, and desktop.
- Screenshot/test/backup evidence is outside source in `../track-v-kole-release-2026-09-30/`.

## Safeguards and limits

Full private pre-release backup: all 33 tables, SHA256 e1c6cb5768141ef16c7dabe28e25bd5434e13c0e2b2e317fc54751d21975f750. Custom access rev 5, owner plus two existing visitors. Compare final backup by table/row; preserve concurrent legitimate work and never restore over it. Existing device drafts are not enumerated or modified.

Round settings retain their existing Refresh/re-entry update behavior; this does not introduce a live manager-settings transport. Saved views may deliberately show all or inactive items. Browser QA is viewport emulation, not physical device or screen-reader certification. Build/version/data comparison are recorded in the external release report.
