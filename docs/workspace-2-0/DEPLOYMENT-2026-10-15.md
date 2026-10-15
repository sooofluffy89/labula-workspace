# Production cutover — 15 October 2026

Status: **compatible maintenance stage v87 is deployed; the final Workspace 2.0
cutover is in progress and is not yet reported as successful**.

The existing Site remains `appgprj_6aa56065ff148191bca78164158e3a4c`, with its
public audience, original DB/R2 bindings and URL. The live compatible stage uses
source `ec800d83458434435464ef99aa0cca335a0c2d46`. No production seed or synthetic
business write was made. Production backups, device recoveries, identities and
private manifest digests remain outside this repository.

## Native release history and migration diagnosis

The first compatible stage retained the v84 product UI and protocol-1 browser
client, adding freeze-safe reads, audited Owner maintenance and device recovery.
Its Node 24 typecheck, 111 regression scripts and synthetic local browser checks
passed. The official Sites source helper built, pushed and packaged this source:

- Source: `e9770e024d160f6db429da34f5a20e6d44d9dc08`.
- Saved version: 85 (`appgprj_6aa56065ff148191bca78164158e3a4c~appgver_eece70d9eab4819189cd93fdfb681cdf`).
- Archive: `sha256:c51acdce7f654fd6e34b30d20d3f7eb971c2fd791c619975b27f6ace02f951f4`.
- Deployment: `appgdep_6ad1217b2cfc819196225540c5f29c20`.
- Terminal result: failed with `incomplete input: SQLITE_ERROR` at
  `2026-10-15T18:55:03.665188+00:00`; the v84 Worker remained live.

Initial user-table observations alone could not establish migration-ledger or
trigger state. No migration was changed on that incomplete evidence. A temporary
code-only diagnostic release selected the exact live v84 source and original
0000–0020 migration set, plus Owner-only read-only diagnostics and device export.
The newer source remained in Git history, with native ancestry and no force
push. Selecting this compatible application version did not roll back schema.

That diagnostic release succeeded as **v86**, source
`23f678605636bc3c4ec9cc1ab04b4e53fea6799a`. Its authenticated Owner GET read actual
`sqlite_schema` and discovered migration-ledger rows. The report established:

- Applied migration-ledger entries through **0023**.
- All **121 trigger objects belonging to 0023** present.
- All **six objects belonging to 0024**, and its ledger entry, absent.

Thus 0023 was complete; the earlier uncertainty was not evidence of a partial
0023. Only the identified, wholly unapplied **0024** received a formatting-only
repair. Existing SQL semantics were preserved and compound statements were
placed on single physical lines for the hosting execution boundary. No 0025,
HTTP schema-repair endpoint, database restore or schema rebuild was introduced.

The compatible maintenance stage was restored with diagnostics retained. All
112 regressions, typecheck and build passed. Native deployment then succeeded as
**v87**, source `ec800d83458434435464ef99aa0cca335a0c2d46`. The formatted 0024 is now
applied and immutable, alongside 0000–0023, snapshots and journal history. The
final Workspace 2.0 candidate merges that exact stage source while preserving
the full Workspace 2.0 UI and client protocol.

The isolated synthetic D1 diagnostic remains useful for execution-boundary
checks: multiline trigger SQL fails through the installed `exec()` path but
succeeds on one physical line or through prepared execution. This does not
identify Sites' private executor or change the observed applied state above.
[D1 documents newline-separated exec queries and stopping on an error](https://developers.cloudflare.com/d1/worker-api/d1-database/#exec).
`scripts/diagnose-sites-d1-trigger-format.mjs` uses temporary synthetic D1 only.

## Data and device preservation

Authenticated v84 exports were retained privately before and after the initial
attempt. Strict preservation comparison passed with zero changed sections for
all 41 restaurant/history/receipt/photo tables, including exact notebook
identities, values, revisions and effective composition. The sole historical
column normalization is the additive plan-policy default of 1. That manifest
reported no composition exceptions or active legacy-plan warnings for the
cutover date.

The v84 backup format omitted the newly created runtime policy; its separately
observed state was retained privately. That export was not described as a full
dump of the newer schema. The compatible v87 complete backup additionally
includes runtime policy and immutable maintenance audit, with referenced photo
bytes verified. Its frozen capture and before/after comparison belong to the
ongoing final cutover gates below.

All five available Chrome notebook copies and the open review recovery were
downloaded. **Raw device recovery exports for all five Chrome contexts are now
complete.** The owner confirmed no other device contains unsent work. Existing
browser storage and recovery copies are retained; no account's drafts were
assigned to another account.

## Final cutover gates in progress

The merged final candidate passed Node 24.19.0 `npm run validate`: typecheck,
all **121 regression scripts**, and the production Worker build before the
subsequent Owner probe-form addition. That native form submits an invalid legacy
request to the existing catalog API, without changing its backend or the shared
client protocol. Focused post-form checks verify its rendered fields and actual
415/503/428 responses with no changed row or receipt, plus client authorization
and type checks. Tests use synthetic data; live cutover verification is recorded
separately below.

The audited production Owner control and read-only diagnostics are now
available. The final candidate contains the original Workspace 2.0 behavior plus
the exact applied maintenance/diagnostic history. Before reporting the final
release as complete, the operator must verify the real server-side freeze,
retain the complete frozen private backup and manifest, deploy the exact tested
candidate through the native Sites helper/workflow, and compare every preserved
restaurant record while still frozen. Required production role, menu, deep
composition, Today, historical-link and recovery checks remain release gates.

Only after those checks pass may the Owner resume writes with minimum client
version **2** and verify that a legacy client cannot create a receipt. Any
subsequent operational write changes the rollback boundary described in
MIGRATION.md. This report records v86/v87 success and final-cutover preparation;
it does not claim that the final Workspace 2.0 release or reopening is complete.
