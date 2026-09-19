# Review UX v3 — requirement coverage

Scope: `navrh-dotazniku-2026-09-19/master-prompt-ux-v3.md`, building on all 49 topics, 25 targeted cases and 57 source issues in review v2. Recipe Notebook changes still require owner approval followed by a distinct application action.

## 1. Confirm known facts without inventing new evidence

| Requirement | Implementation / verification |
|---|---|
| Frozen source with revision and capture date | `prefill.ts` derives offers from `ReviewSource`; `PreviousFacts` explains that capture date is not measurement date. Newer notebook revisions have a separate notice and retain three-way application conflict checks. |
| Names and direct links only | Explicit acceptance can fill an item/dish name, a direct plate item or a direct destination to an exact dish variant. It supplies no stage, source, plate role, amount, current-use status or group confirmation. |
| Preserve edits, empty fields and rejection | Offers are read-only until clicked. Decisions, stable target/row IDs, source revision/path/value and action date are stored separately. An own value, cleared list or prior decision prevents replacement/reappearance. |
| Historical batch/labour/storage remain context | Related processes/samples show separate historical fields. New run records inherit only the explicit process link. Storage sources stay separate; no experience-based quality period becomes approved storage. |
| Explicit uncertainty | `Needs changing` invalidates the relevant context; `Not sure` creates a check assignment. Existing answers remain. Old completed checks cannot satisfy a newly recorded doubt. |
| T01–T25 | Specific questions appear in their relevant topics. Matching follows frozen names/aliases and linked source products through renaming. Original ambiguity prompts and required structured follow-up are retained. |
| Excluded preparations | Stable IDs/aliases and excluded shared processes suppress production history/context and production questions; identity, use and storage remain. All four exclusions tested. |

## 2. Honest completion states

`progress.ts` is shared by the home status endpoint and review UI. Counts exclude fieldless redirects, owner-only work in cook mode, STORE-06 authority and inactive branches. Duplicate issues at the same stable field are one missing place. Assigned fields and unassigned fields are disjoint; open check count is a count of tasks, not fields.

Records show Not started, In progress, Waiting for check, or Your answers complete, with a Needs reconfirmation qualifier. Topics show Not started, In progress, Ready to confirm, Confirmed, or Needs reconfirmation. Untouched optional-only topics do not make a record appear started. Context-only parent references do not count as entered answers.

Own edits and relevant transitive stage/source/process changes invalidate confirmations through one shared validity function used by UI, readiness and proposals. Original confirmation values are retained. Source decisions and new check intentions affect approval/applied-data freshness without putting navigation into content fingerprints. The first compatibility upgrade preserves legacy approval fingerprints when facts remain unchanged.

The hub and home offer Continue answering, Measurements and checks and owner follow-up separately. There is no invented overall completion percentage. Lists support search and All / unfinished / waiting / reconfirmation / complete filters, counts, reset and an empty state. Owner follow-up links to concrete storage records. Latest storage authority wins over older verification.

## 3. Guided continuation and durable return

`navigation.ts` handles explicit next-topic labels, confirm-and-continue, continue without confirmation, per-record summaries and stable next-work selection. Related existing records have priority after the current record. Waiting-only and completed records are skipped. The independent resume control preserves the working position while inspecting summary/checks.

Reference selectors offer existing records first. Inline creation/editing is available for products, processes, runs, storage and supported nested stage/source/input/output/component/choice/incident/work-step rows. Where a parent is required, the form asks for that real parent instead of inventing it. Existing shared processes are selected rather than cloned. Unsupported generic record creation is not offered.

Return frames contain stable row IDs and the expected original field value, never a parent-draft copy. The newest SaveQueue state is used on return. A removed row, changed value or inactive topic cannot be overwritten. Return without linking keeps the new record and releases the frame even after a scope change. Double clicks do not create a second related record. Frames, focus target and work position survive save, reload, export and compared import.

Checks first show person, due date, exact method and reason. Result fields are a separate expandable step. Incomplete assignments do not cover a missing fact; overdue assignments remain assigned. Every field uses the existing save/recovery path. Server actions are disabled during in-flight saving or give an explicit retry explanation.

## Data boundaries and compatibility

- Optional typed UX metadata extends schema version 2; no database migration or notebook backfill.
- Existing source records, legacy payloads, checks and histories must remain; old metadata cannot be dropped by newer saves.
- New saves use `clientVersion: 3`. Once UX metadata exists, an old new write receives 426; exact old receipt replays are handled first and still work.
- Pending requests are cloned once and retried unchanged. 401/403/422/426 remain recoverable without losing current edits.
- Import comparison merges independent facts by stable identity and restores navigation separately. It does not silently accept another author's draft or overwrite a newer shared answer.
- Cook cannot verify storage, change owner records, approve or apply. No new access grants, auth changes or production-answer writes.

## Automated verification

- All 33 existing regression scripts plus `check-review-ux-v3.mjs` (34 total).
- Actual UI-handler harness extended with source acceptance and related-phase return during in-flight saving, alongside the existing first/second-save, timeout/auth, rejected draft, remount, compare/import and unmount tests.
- Actual API + SQLite test extended with UX upgrade, old receipt replay, old-client rejection, missing metadata rejection and unchanged notebook proof. Existing explicit approval/application, revision conflict, atomic rollback and archive tests remain.
- New pure-flow tests cover offers, own/empty/deleted answers, deduplication, direct variants, selective/transitive reconfirmation, uncertainty versus old checks, roles, assignments, latest authority, nested row reorder, changed/removed origins, cancellation, double creation, recovery merging and immutable retry.

## Isolated browser verification

Local synthetic notebook only. Verified explicit prior-name acceptance; existing own-name preservation; inline stage creation; reload while away; link/return into the original component; full run and top-up separation; protected sample exposes scope only; conditional check-result fields; check close; role-specific actions; filters and untouched versus in-progress records. Mobile at 375 px exposed a long-button overflow, corrected and rechecked at document width 375 px. No browser console errors during these checks.

Separate owner flow: preview and approval left local notebook at revision 318 with original Test broth. Only explicit Apply changed it to revision 319 / Test broth — UX v3 correction. Production data were not used for test answers or approvals.

## Pilot after release

Run an observed interview with the real cook on one bought item, one preparation, one shared-output process and one ambiguous package unit. Record active completion time, requests for explanation, backtracking, incomplete assignments and accidental duplicate creation. Compare these against the prior form on comparable records. Acceptance: correct parent/phase/source links, no guessed measurement or rule, every remaining uncertainty has a named actionable check, and the cook can leave and resume unaided. No time-saving percentage is claimed before this pilot.

Existing constraints remain: this is one shared interview with revision comparison, not independent simultaneous questionnaires per cook; historic estimates remain estimates; real safety rules and measurements need human evidence. Conflicting current notebook fields require explicit reconciliation before application.
