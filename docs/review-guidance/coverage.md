# Self-guided review — requirement coverage

Scope: `master-prompt-samostatne-vyplneni.md`. This release changes presentation and explanation only. Review answers, schema, save protocol, permissions, approval and apply boundaries remain unchanged.

| Requirement | Implementation | Verification |
|---|---|---|
| First-use orientation without a second gateway | `WelcomeGuidance` replaces the old three-card welcome explanation. Existing reviews receive the same controlled `ReviewGuide`; `Help & examples` stays in the header. | Handler test: first visit, remembered visit and second user. Browser: fresh and returning user. |
| User- and guide-version-scoped preference | `guidePreferenceKey` uses guide version + authenticated user ID and a prefix outside all review recovery keys. Storage failure is ignored. | Pure tests with two users and throwing storage. |
| Examples never become answers | `guideExamples` contains plain display-only data. Guide components receive no draft, save queue, campaign or workflow callback. | Handler test asserts open/close sends no review request; before/after data comparison. |
| Product / stage / local-work explanation | Coriander flow in `guideExamples.coriander`; `ITEM-01`–`ITEM-03` topic and field guidance. | Content-map test; browser context links. |
| One process / multiple outputs | Generic Example cooking → Example meat + Example broth; shared and output-specific work, full run and top-up, evidence types. | Content-map test; browser example navigation. |
| Context help | `guidance.ts` is the central topic/stable-field-path map. `TopicGuidance` and `FieldGuidance` resolve the current active branch; production help is suppressed for outside-scope production. | Mapping and four-exclusion regressions; browser current-topic checks. |
| SET-01 self-entry | Visible label is “Person recording these answers”; inline help tells a self-filling cook to enter their own name. No identity, date, role or whose-work default is added. | Type/model regression plus browser SET-01 inspection. |
| Specific reconfirmation reason | `confirmationChanges` compares the trusted current confirmation value and dependency snapshot, maps stable dependencies to current records, and returns concise field changes. | Current answer, linked stage/source/process and unrelated-change tests. |
| Honest legacy/missing context | `legacy-context`, absent snapshots and unparsable snapshots use explicit generic explanations and never invent a historic value. | Legacy and missing-baseline tests. |
| Safe navigation and accessibility | Existing stable targets drive “Open the related current field”. Archived/removed targets have no link. Radix dialog provides title, focus containment, Escape, close and trigger return. | Field-anchor regressions; keyboard, mobile and enlarged-text browser checks. |
| Existing boundaries | No schema/API/migration change. Confirm, preview, approve and apply logic is untouched; production exclusions still run through `activeGroups`, `excluded` and `outOfScope`. | Full regression suite, typecheck, lint, build, data and access comparisons. |

## Human pilot after release

Use one simple product and one shared production with two outputs. The cook should distinguish product from stage, avoid duplicating shared labour, distinguish an estimate from a measurement, create an actionable CHECK and resume after interruption without an owner explanation. Record help requests, corrections, follow-up questions and active time separately from kitchen measurement time.
