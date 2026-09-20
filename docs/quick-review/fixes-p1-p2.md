# Quick review: P1 + nine P2 fixes, 20 September 2026

Scope: audit findings 1–10, based on v27 / 7a6e30af2ff15c9c8fd046c36c8ed4759feac25a. P3 finding 11 remains out of scope. Eight cases, three steps, private access and separate owner preview / approval / apply are retained.

## Coverage

| Finding | Cause and correction | Source | Regression and observed result | Compatibility |
|---|---|---|---|---|
| 1 P1 | Whole process JSON exceeded its own confirmation limit. New SHA-256 stamps have bounded length. Every draft mutation validates final shape and history size before writing; awaited save errors produce HTTP errors. | quick-review/stamp.ts, schema.ts, model.ts; api/review-workflow/route.ts | check-quick-fixes-api: 35 long outputs, close, repeated GET/SAVE; 40 accepted / 41 rejected; history budget rejection with no writes; original oversized stamp recovery and malformed rejection. PASS. | Bounded recovery accepts only the exact former serialized shape. Read conversion does not write; the next revision-protected save keeps original raw before_payload in history. Existing valid short legacy confirmations are compared by relevant facts. |
| 2 P2 | Temporary pack fields created permanent unknown checks. Draft-gap checks now become unnecessary when completed; explicit uncertainty / assigned checks stay. Owner may withdraw an obsolete check with a reason, separately from verified completion. | model.ts, schema.ts, quick.tsx, workflow route | check-quick-fixes + UI handlers: packs, portions, kg, explicit promotion; API owner/chef permissions. Browser: 4 packs → bag → 0.5 kg, count returns to baseline; explicit unknown assigned and genuinely recorded on test data. PASS. | Uncertain legacy origins are not guessed or silently deleted. |
| 3 P2 | Already-counted work still required local minutes. Active linked inclusion chains now establish scope without fictitious minutes or double counting. | model.ts, quick.tsx | Included work closes with evidence; missing/changed work scope reopens relevant check. Browser drying included in washing with no numeric work fields. PASS. | Stored numeric/historical branches retained but inactive. No complete total is claimed for unknown work. |
| 4 P2 | All confirmations depended on the whole process/week. Case and topic stamps now select actual active dependencies. | model.ts, quick.tsx, stamp.ts | check-quick-fixes: legacy 8/8 survives week change, context/trigger do not reopen weighing, changed weight does, independent checks. Browser context preserves completed case; detach/reconnect reevaluates it. PASS. | Valid legacy short stamps remain recognized without bulk migration. Original evidence retained. |
| 5 P2 | Matching item IDs created false cycles across physical states. Later steps now identify a precise upstream task/output, or explicitly external/unrecorded input or unknown. | schema.ts, model.ts, quick.tsx | Model real cycle/self-use rejects; actual UI handlers choose input. Browser washing → drying → cutting same coriander finishes. PASS. | Old ambiguous linkage asks for clarification, never infers a parent. |
| 6 P2 | Hidden historical countedIn/inputId affected cycles and exclusion. Active branch selectors drive validation and topic dependencies. | model.ts, quick.tsx | Both reproductions in check-quick-fixes; branch round trip in UI test. API validates active graph. Browser later/independent branch change preserves answers. PASS. | Historical values retained; actual excluded outputs/shared work still protected. |
| 7 P2 | Unchecking deleted the output. Reversible detached state preserves output ID and content, decisions and checks. | schema.ts, model.ts, quick.tsx | Model serialized recovery retains exact IDs, packs/content and dismissed offers, including distinct outputs sharing itemId. Browser uncheck/check restores 4 × 0.5 kg after reload. PASS. | Detached records excluded from active calculations/proposals, not deleted. |
| 8 P2 | Missing quick was treated as one atomic change. Deterministic empty structure and identity-aware paths allow independent first edits to merge; position is not an answer conflict. | review-v2/save.ts | Real SaveQueue + API + SQLite: absent quick, garlic/rice, conflicts, merge, newer revision, uncertain exact replay, late edit. Browser two first tabs merged both; comparison refreshed after a newer revision; timeout/retry/reload retained latest edit. PASS. | New saves require clientVersion 5; already accepted legacy operations replay before the fence. Old recovery stays available. |
| 9 P2 | Trigger stock level was incorrectly translated into unexpected top-ups. Only affirmative planned production without emergency maps to planned; otherwise preserve old schedule and explain it is not reconfirmed. | quick-review/proposal.ts | All seven triggers × emergency both values; real API preview/approve/apply preserves old schedule and unrelated prep fields. Browser separate owner actions on synthetic limited record. PASS. | Original trigger stored in limited process record; old profile preserved where meaning is not established. |
| 10 P2 | Eligibility used only old source identity. Preview/approve/apply now validate relevant current catalog identities, aliases and exclusions; apply regenerates guarded proposal even for legacy approvals. | quick-review/proposal.ts, review-v2/proposals.ts, workflow route | Actual catalog merge adds each of four excluded aliases: all three stages reject without notebook/actions writes. Legacy approval without guard metadata rejected too. Existing API tests cover atomic rollback and revision races. PASS. | Source snapshot retained; unrelated notebook edits are not replaced. |

## Shared rules

- `outputs(process)` selects attached stable identities; detaching never deletes content.
- Input lineage matters only for a later step. Work inclusion matters only while actively selected, not while work is explicitly unknown.
- Explicit unknown and temporary incomplete pack fields have different origins. Once promoted, an explicit unknown is never demoted automatically.
- An assigned or evidenced check remains distinct from an unnecessary untouched draft suggestion. Withdrawal carries who/when/why and is owner-only; it is not measurement.
- New case/check stamps are deterministic `qr2` SHA-256 values, identical on client and server. Cases depend on active facts and real upstream/included work. Each check depends on its own topic, batch/scope and relevant upstream facts.
- Valid small legacy stamps use selective comparison. The exceptional recovery of an already oversized legacy stamp uses `qr1:sha256` and keeps its original stricter whole-process comparison: a later unrelated edit may request rechecking that recovered legacy check. No false verification is inferred. Freshly recorded checks use qr2.
- No GET writes a migration. The bounded compatibility conversion is repeatable; the original invalid payload is retained by the next successful command history. Unknown malformed oversized data is rejected for assisted repair, not silently accepted.
- Maximum process output count stays 40. Overall draft and history budgets remain enforced; large records may require shorter references or assisted splitting.

## Schedule mapping

| Reported trigger | Emergency false | Emergency true |
|---|---|---|
| A planned prep list | planned | preserve previous |
| A stock level we check | preserve previous | preserve previous |
| The stock looks low | preserve previous | preserve previous |
| We run out during service | preserve previous | preserve previous |
| A customer order | preserve previous | preserve previous |
| Something else | preserve previous | preserve previous |
| Not sure | preserve previous | preserve previous |

This map is applied only when the existing strict flat-profile eligibility is otherwise met. No new mixed/unplanned inference is made. Preserved schedule is explicitly not a new confirmation.

## Test scope and evidence

`check-all.mjs` runs all 38 previous scripts plus `check-quick-fixes.mjs` and `check-quick-fixes-api.mjs` (40 total). Existing security assertions retained. Two old expectations changed for the intended behavior: SaveQueue client version is now 5; the cycle test explicitly activates and links its work-inclusion branches instead of using inactive stale references. The UI harness normalizes incoming saves through the real schema, matching API behavior.

Browser QA used isolated local synthetic data (Test-prefixed catalog, separate local database), never production answers. Observed in real IAB/Chrome: full case, progressive packaging, check assignment/result, inclusion, three physical stages, detach/restore, context and completion, distinct owner actions, reload, 30-second server outage with a newer edit and retry, two first editing tabs, second conflict during comparison, successful merge. Responsive Chrome viewport: 375 px with document width 375 px, no horizontal overflow; case activation by keyboard focused its heading. Browser used the local test owner. Chef authorization failures were tested through actual server routes with isolated test identities, not through a second authenticated production persona. Export/import preservation was exercised through schema/SaveQueue/API and recovery archive paths, not an OS file-upload dialog.

Production checks and exact final deployment/backup hashes are recorded outside the repository in `../opravy-quick-review-2026-09-20/predani.md`. Private backups are never packaged.

## Safe rollback / recovery

Do not restore an old database over new chef work or run the v27 writing server against new quick records. Preserve a fresh complete backup. If a regression is found, retain the current schema, client-version fence and data guards, and deploy a forward-compatible fix or temporarily disable the affected write action. Inspect uncertain operation receipts before retry; use the same operation identity. Content approvals and application remain owner actions.

No storage safety certification, optimal batch calculation or demonstrated labour savings is implied. P3 (invalid top-up text in the incompleteness marker) is intentionally unchanged.
