# Operating calendar, History and Operations overview

Baseline: production v46, commit `e239be0ea94272e46c4a41fa90919941649da63d`.
The exact published version, commit, deployment result and private backup comparison are recorded outside the checkout in `/Users/johnny/Documents/LABULA/provozni-kalendar-release-2026-09-27`.

## Scope and data preservation

- The versioned Prague calendar initializes Tuesday–Sunday open, Monday closed, with all deadlines unset. Sunday defaults to Tuesday. Date exceptions, future effective revisions, DST and after-midnight evening deadlines are explicit. Saved checks and recovery commands keep their original dates and payloads; a now-closed saved target is flagged for explicit review.
- Daily rounds accrue no new closed-day debt. Unfinished open-day obligations remain due. Less frequent rounds on a closed weekday carry to the next opening and show Schedule needs review. Configuration rejects duplicate days; no production membership, Track or schedule is moved automatically.
- History reads drafts, all evening answers including No action needed, immutable confirmation versions, Ready/Undo, automatic plan consequences, original actors and server/device times. Links use stable IDs and retain list/filter state while nested ingredient details are open. New hash links avoid route remounts on Back.
- Operations overview has a short summary plus Handover, Readiness and Recurring issues, bounded paging, date/person/phase/item/type/group/round/status/state filters and owner CSV export. Historical and current groups/names are labelled; documented merges are linked, not silently combined into one identity.
- Every accepted Ready/Undo is durable locally before optimistic feedback. The existing serial controller retains every intermediate intent and exact sent payload. Ordinary network errors allow safe further clicks, with three bounded background retry attempts. A conflicting item blocks only its own dependencies. Auth, storage and plan errors remain protected. History loading does not replace or dispose the operational controller.
- Clarify outcome is independent, owner-managed, append-only and optional: on time but forgotten click, prepared late, not prepared, no longer needed, not sure. Original Ready, timestamps, confirmation payload and notebook remain unchanged. A later correction explicitly references the prior explanation.
- Cook remains restricted to operational checks/prep and existing allowed source details. Full History, owner analytics, exports and configuration enforce server permissions. Legacy wider profiles retain History. Account changes, paused accounts and stale responses are checked. Private audience and team roles are preserved.

## Metric definitions

The reporting range refers to morning dates. The default overview covers the last seven open days; History also includes the next open morning so a newly confirmed Sunday handover is visible.

`Ready recorded by deadline` uses the server-confirmed boolean state at the applicable morning cutoff and the published task set effective then. Ready followed by Undo before cutoff is not on time; an Undo after cutoff does not change the earlier result. Late synchronization and self-reported preparation time cannot backdate server readiness. Later added tasks are marked unknown against the old cutoff; removed tasks remain in its denominator.

Handover uses the first saved confirmation against that check's effective evening cutoff. A check expected from the recorded round timeline but never created is computed on read; no scheduler or open browser is required. A missing confirmed plan is distinct from a confirmed plan without tasks. Future cutoffs are pending. Missing deadline/history coverage is not evaluable, never a fabricated 0% or 100%.

Recurring counts one task per plan, not clicks or confirmation versions. It shows evaluable opportunity counts, Ready by deadline, missing Ready, independently reported late/not prepared outcomes and additions/removals after cutoff. Small samples are labelled. Missing Ready alone is not proof that food was unprepared. Selecting a person retrieves days with their actions and does not rank staff or remove other tasks from that day's denominator. First/last clicks are event times, never measured cooking duration.

Historical cutoff coverage begins only where a configured effective deadline and sufficient immutable version/event evidence exist. Older gaps stay unknown. Source IDs, server and unverified device times, operation/session/sequence IDs and the capture boundary are included in the consistent export.

## Schema and recovery

Additive migration `0014_brown_brood.sql`: calendar versions, operating commands, immutable outcome explanations; nullable `evening_checks.calendar_revision`. Complete backup expands from 26 to 29 tables; legacy 26/22-table reads remain supported. GET/list/aggregate/export paths do not initialize or write data. Calendar activation is an explicit idempotent owner command.

No production answers, Ready, outcomes, recipe corrections, Track changes or round moves are part of deployment. New local draft and recovery keys are account/scope-specific. Existing evening command keys and resolution journal remain compatible. Original uncertain requests retry with the same identity and payload; a reviewed reapplication is a new recorded intent.

Prefer a forward fix on this additive schema. Do not restore an old full database, delete new tables/events or clear device pending queues. A blind rollback to pre-calendar v46 is unsafe for new closed-day starts; any rollback must retain the new server calendar guard and 29-table backup support. Reconcile an uncertain original receipt before creating a replacement request.

## Verification

The full dynamically discovered runner contains 56 regression scripts (55 existing plus `check-operations.mjs`). It exercises actual SQLite migrations, API routes and the Ready controller. New coverage includes calendar/DST/exceptions, old-client rejection, round debt, 30 rapid tasks plus Undo/Ready, identical-millisecond order, offline additional intents, reload, exact retries/lost acknowledgements, cutoff reconstruction, additions/removals, all five outcomes, concurrent revisions and rollback, permissions, 25-record paging, full export and unchanged database snapshots on reads. Existing controller/API/identity/round/motion/information tests cover storage failures, request/body timeouts, multi-client conflicts, notebook transition safety and prior recovery compatibility. TypeScript, lint and production build are release gates.

Browser QA uses `/private/tmp/labula-operations-qa` with its own SQLite database, synthetic owner/Cook identities and a clearly labelled fault simulator. None of the QA auth, fixture, routes or fault controls is part of the source checkout or deployment archive.

Observed: Sunday check with 32 answers → Tuesday confirmed plan; 30 different Ready plus Undo and Ready on the first task; history read during queued saves; all 32 events persisted in order. With each POST delayed three seconds, 32 click-to-first-animation-frame DOM updates measured 32.1–89.3 ms in desktop Chrome at 390 px. This measures the first rendering opportunity observing the new checked state, not physical screen latency. It is not a universal performance guarantee.

Offline: two further clicks were accepted and visibly pending, reload restored both, Retry saved both without loss. Owner and Cook were exercised separately. A future synthetic calendar revision flagged the existing plan while preserving its target. History retained all answers and versions. An on-time-but-forgotten explanation left the task unready and its original Ready history unchanged. Shared ingredient drilldown and Back restored the history context. At 320 px the page had no horizontal overflow and Ready controls measured 56 × 48 px. Additional responsive checks and deployment smoke details are in the external release report.

## Owner follow-up and limits

Choose the actual evening and morning deadlines in Calendar & deadlines; none is invented. Review any flagged closed-day existing plan or less-frequent round explicitly. In the initial production backup the 27 September draft still targeted Monday 28 September; deployment must preserve it and offer Dates review, not retarget it silently.

Device times are unverified; offline guarantees depend on retained local browser storage and the original account. Server history cannot recreate unrecorded old events. This release has no quantities, cooking timer or staff-performance ranking. Large history requests are bounded to one year and bounded row counts; oversized requests fail clearly rather than silently truncate. Physical-phone touch scrolling, screen readers, OS reduced-motion and long-running multi-user load tests are not represented as verified by desktop emulation.
