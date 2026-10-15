# Production deployment attempt — 15 October 2026

Status: **blocked during the compatible maintenance stage; Workspace 2.0 is not deployed**.

The existing Site remains `appgprj_6aa56065ff148191bca78164158e3a4c`, with its
public audience and original DB/R2 bindings. The last successful application is
v84, source `93eab5d471c3af35de72a2b2278b96c66d788ad6`. No production pause or
resume operation was performed. No production seed or test write was made.

## Prepared maintenance stage

The stage preserves the v84 product UI and protocol-1 browser client. It adds
the reviewed additive schema, freeze-safe mature reads, an audited Owner-only
maintenance page, and a read-only account-scoped device recovery download.
The stage passes typecheck and all 111 regression scripts. Browser QA on a
synthetic local account verified pause, recovery-page reads while paused, and
resume with minimum client version 2. The official Sites source helper built,
pushed and packaged exactly this source:

- Source: `e9770e024d160f6db429da34f5a20e6d44d9dc08`.
- Saved version: 85 (`appgprj_6aa56065ff148191bca78164158e3a4c~appgver_eece70d9eab4819189cd93fdfb681cdf`).
- Archive: `sha256:c51acdce7f654fd6e34b30d20d3f7eb971c2fd791c619975b27f6ace02f951f4`.
- Deployment: `appgdep_6ad1217b2cfc819196225540c5f29c20`.
- Terminal result: `failed`, `incomplete input: SQLITE_ERROR`, at
  `2026-10-15T18:55:03.665188+00:00`.

The live maintenance route still returns 404, consistent with the original
Worker being retained. No second deployment was attempted after this failure.

## Observed partial database state

Native read-only tools establish that `workspace_runtime_policy` exists with
`write_paused=0`, `min_client_version=1`, `revision=0`, and
`updated_at='initial-policy'`. `access_write_guards.client_version` also exists.
The audit table `workspace_runtime_policy_commands` is absent from the complete
native user-table inventory.

These observations do not establish migration-ledger entries or trigger
definitions. The exposed Sites table tools cannot read that authoritative
state. No applied SQL, snapshot or journal entry was changed to guess a repair.
No schema object was deleted and no database rollback was attempted.

## Data preservation

Authenticated v84 exports were retained privately before and after the attempt.
The strict Workspace 2.0 preservation comparator reports **PASS, zero changed
sections** for all 41 restaurant/history/receipt/photo tables, including exact
notebook identities, values, revisions and effective composition. Its only
documented historical-column normalization is the additive plan-policy default
of 1. The menu manifest reports no composition exceptions or current legacy-plan
warnings for the cutover date.

The old v84 export does not include the newly created runtime-policy table. Its
separately observed native state is retained with the private release evidence;
the old endpoint is not claimed to be a full dump of the partial schema.
No production backup, photo, raw device recovery, identity or manifest digest is
committed here.

All five available Chrome notebook copies and the open review recovery were
downloaded. The owner confirmed that no other device contains unsent work.
Raw browser-journal exports remain pending because the compatible export page
could not be installed. Existing browser storage and open tabs were preserved.

## Reproduction and supported next step

The uploaded SQL is byte-identical to the built source. Synthetic Miniflare D1
reproduces the same `incomplete input` error when a multiline
`workspace_request_policy` trigger is passed to `db.exec()`. The identical SQL
on one physical line succeeds. The multiline statement also succeeds through
`prepare().run()` or a prepared batch. This supports an execution-boundary
incompatibility; it does not prove Sites' internal implementation.
[D1 documents newline-separated exec queries and stopping on an error](https://developers.cloudflare.com/d1/worker-api/d1-database/#exec).
Run `node scripts/diagnose-sites-d1-trigger-format.mjs` with Node 24 and the
locked dependencies to reproduce using synthetic temporary D1 databases only.

The Sites hosting operator must inspect the actual migration ledger and
`sqlite_schema`, reconcile the partial 0023 without rewriting applied history or
losing data, and execute complete trigger statements correctly for both 0023
and 0024. Merely flattening and redeploying could replay already-created tables,
columns or control rows. A later repair migration cannot be assumed to bypass
the earlier incomplete migration. An HTTP schema-repair endpoint is not used.

After that infrastructure repair, resume with the compatible maintenance stage,
export raw journals in each original browser tab, verify the real write freeze,
take the frozen complete backup, compare preservation, deploy the final tested
Workspace 2.0 artifact, and only then resume writes with minimum client version
2. The rollback restrictions in MIGRATION.md still apply.

The final candidate passed the original 119-script full validation and build.
The subsequent stage-history merge adds only the cutover regression script;
that script, the expanded recovery exporter checks, and typecheck pass against
the final candidate. No successful production release is claimed.
