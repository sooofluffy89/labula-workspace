# Workspace 2.0 production release — 15 October 2026

Status: **resolved — Workspace 2.0 v88 is deployed and verified; writes are
resumed with minimum client version 2**.

- URL: https://labula-kitchen-recipes.jan984079.chatgpt.site/
- Site: `appgprj_6aa56065ff148191bca78164158e3a4c`; existing public audience and
  original DB/R2 bindings retained.
- **Deployed application SHA:** `947ceee047bd9441900d7be714d90b0d89e53739`.
- Exact source tree: `404a9b52c87a8cab59659f58b857127839970308`.
- Saved version: **88** (`appgprj_6aa56065ff148191bca78164158e3a4c~appgver_eb9a7cd7535481918d9e631f3dc1c6f9`).
- Native deployment: `appgdep_6ad13450fdcc8191826242788af1ac68`, succeeded at
  `2026-10-15T20:15:36.589539Z`.
- Native archive: `sha256:34762a8418440014c01baffd1062c834024b0d81e08dffa1748d813602ec943b`.
- GitHub feature-branch source copy:
  `957515b3e7574b5b168f7dbf17d34e79a63c4f44`, published by normal fast-forward
  with the same exact release tree. Later documentation-only commits do not
  change the deployed application SHA above and require no Site redeployment.

No production seed or business test write was made. Production backups, device
recoveries, identities and private manifest digests remain outside this
repository.

## Completed cutover and preservation

The real audited Owner control paused writes at policy revision 1 before the
final deployment. Complete private backups covered all **43 application tables**
and referenced photo bytes. The frozen v87/v88 comparison passed with **zero
changes across all 41 restaurant/history/receipt/photo tables**. Runtime policy
was identical and no maintenance audit action was appended during deployment.
The exact notebook identities, values, revisions, compositions, receipts,
history and Ready state remained preserved.

After the successful deployment and live checks, the Owner resumed writes at
`2026-10-15T20:19:53.298Z`. The verified policy is `write_paused=0`,
`min_client_version=2`, `revision=2`, with **two immutable maintenance audit
rows**. Another complete backup after resume again passed preservation with
zero restaurant-data changes. The explicit control comparison reported the one
expected appended resume action and a valid policy/audit chain.

The Owner's native HTML probe submitted a deliberately invalid legacy form body
to the existing catalog route. Actual Worker logs and JSON responses verified
HTTP **503 / workspace_write_paused** while frozen at `20:17:47Z`, then HTTP
**428 / workspace_update_required** after resume at `20:20:12Z`. No business row
or receipt was created. The form remains invalid independently of policy; its
synthetic open-policy check returns 415 because the route requires JSON.

All five original Chrome contexts completed raw device recovery downloads
without storage errors. Their notebook copies and the open review recovery were
also downloaded. The owner confirmed no other device contains unsent work.
Existing browser storage and recovery copies were retained; drafts were not
assigned to another account.

## Verification and limits

Live authenticated Owner checks passed for current and archived Menu rosters,
variant detail, ingredient expansion, Today, historical Review, CSV export and
complete private exports. Anonymous requests to the Menu, maintenance and
diagnostics APIs returned 401. The full Workspace 2.0 UI, original LABULA logo
and existing Site identity remain in place.

The merged candidate passed Node 24.19.0 `npm run validate`: typecheck, all
**121 regression scripts**, and the production Worker build before the native
probe-form addition. After that UI-only addition, focused maintenance-client,
runtime-policy, 13-case access-client and 47-method API authorization tests plus
typecheck passed. The official source helper then built and packaged the exact
final deployed source. Tests used synthetic data; the production comparisons and
read-only checks above are separate evidence.

Manager and Cook authorization were verified by synthetic tests, not live
sessions for those roles. Physical kitchen devices, Safari and Firefox were not
verified live. Existing Chrome contexts were used for the live checks. No
business mutation was used as a production smoke test. Future operational writes
remain subject to the post-write rollback restrictions in MIGRATION.md; an old
snapshot must not replace newer work.

## Earlier v85 failure and its resolved diagnosis

The first compatible stage retained the v84 product UI and protocol-1 browser
client, adding freeze-safe reads, audited Owner maintenance and device recovery.
Its Node 24 typecheck, 111 regressions and synthetic local browser checks passed.
The official Sites helper built, pushed and packaged this source:

- Source: `e9770e024d160f6db429da34f5a20e6d44d9dc08`.
- Saved version: 85 (`appgprj_6aa56065ff148191bca78164158e3a4c~appgver_eece70d9eab4819189cd93fdfb681cdf`).
- Archive: `sha256:c51acdce7f654fd6e34b30d20d3f7eb971c2fd791c619975b27f6ace02f951f4`.
- Deployment: `appgdep_6ad1217b2cfc819196225540c5f29c20`.
- Terminal result: failed with `incomplete input: SQLITE_ERROR` at
  `2026-10-15T18:55:03.665188+00:00`; the v84 Worker remained live.

Initial user-table observations alone could not establish migration-ledger or
trigger state. No migration was changed on that incomplete evidence. A temporary
code-only diagnostic release selected the exact live v84 source and its original
0000–0020 migration set, plus Owner-only read-only diagnostics and device export.
Newer source remained in native Git ancestry; no force push, database restore or
schema rollback was used.

That release succeeded as **v86**, source
`23f678605636bc3c4ec9cc1ab04b4e53fea6799a`. An authenticated Owner GET read actual
`sqlite_schema` and discovered ledger rows, establishing entries through **0023**,
all **121 trigger objects belonging to 0023** present, and all **six objects of
0024** plus its ledger entry absent. Thus 0023 was complete; earlier uncertainty
was not evidence of a partial 0023.

Only the identified, wholly unapplied **0024** received a formatting-only repair.
SQL semantics were preserved, with compound statements placed on single physical
lines. No 0025 or HTTP schema-repair endpoint was introduced. The compatible
maintenance stage then passed all 112 regressions, typecheck and build and
successfully deployed as **v87**, source
`ec800d83458434435464ef99aa0cca335a0c2d46`. Applied SQL 0000–0024, snapshots and
journal history are now immutable. The final v88 source merges that exact applied
history while retaining the full Workspace 2.0 product UI and client protocol.

The precise internal cause of Sites' earlier parsing failure remains unknown.
The isolated synthetic D1 diagnostic demonstrates an execution-path difference
for multiline trigger SQL; it does not identify the private hosting executor or
prove that 0023 failed. The formatting repair resolved the observed deployment
failure, as confirmed by v87 and v88 native successes.
[D1 documents newline-separated exec queries and stopping on an error](https://developers.cloudflare.com/d1/worker-api/d1-database/#exec).
`scripts/diagnose-sites-d1-trigger-format.mjs` uses temporary synthetic D1 only.

Authenticated v84 exports retained privately before and after the initial attempt
also passed strict preservation with zero changed sections across all 41
restaurant tables. The only historical-column normalization was the additive
plan-policy default of 1, with no composition exceptions or active legacy-plan
warnings for the cutover date. The old v84 export omitted the newer policy table
and was never described as a full dump of that newer schema. The final frozen
and resumed 43-table captures supersede that inventory limitation.
