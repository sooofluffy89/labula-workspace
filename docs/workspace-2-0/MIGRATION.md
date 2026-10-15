# Workspace 2.0 — preservation, cutover and rollback

This is an in-place application upgrade, not a replacement restaurant database.
The current menu, original LABULA logo/favicon, Sites identity, D1 `DB`, R2
`BUCKET`, URL and repository remain. No production import or deployment is part
of the implementation run. The production menu has **not** been verified from
this development environment. A seed or the static menu in Git cannot establish
what the restaurant currently serves.

## What changes in storage

The Menu adapter reads existing dish/variant IDs, catalog IDs, quantities and
legacy/process/approved evidence. Opening Menu does not migrate or rewrite them.
One explicit, revision-checked product edit can add `Notebook.workspaceRecipes`
for that item. Its source token, source label, revision and timestamp preserve
the decision; raw `item.inputs`, production processes and approved records stay
retained. A supplier composition is not a local production dependency. Shared
batch inputs remain distinct from confirmed ingredients in each output.

An incomplete or unavailable approved source stays incomplete or unavailable.
It cannot silently reactivate superseded `item.inputs`. The preflight uses the
same `workspaceComposition` adapter as the application to describe authority.
It does not guess quantities, yield or allocation among several outputs.

Migration `0021_published_plan_policy.sql` adds policy version 1 to historical
checks. New explicit publication uses policy 2: its published roster is stable
against later changes to the active menu. Historical version 1 behavior remains
until an explicit correction. **Do not bulk change existing rows to policy 2**:
doing so could resurrect previously suspended work without a kitchen decision.
For every active legacy plan, decide whether to finish it under its old policy
or use the correction preview and publish its intended roster explicitly.
Workspace 2.0 additionally refuses a menu-scope change that would change visible
tasks in a current or future legacy plan. `legacy_plan_scope` identifies the
affected date and directs the manager to Evening → Correct check → Finish.
The guard also participates in the atomic write condition, so a legacy plan
published after the initial preview cannot bypass it. Historical plans are
retained; no migration silently republishes them. After an explicit correction,
policy 2 permits later menu changes without changing that published roster.

Migration `0022_workspace_product_sources.sql` extends the existing menu-scope
snapshot triggers so explicit product definitions participate in future scope
evidence. It does not rewrite current recipes. Verify the actual committed
migration filename and trigger definition during release preflight.

Migration `0023_workspace_runtime_policy.sql` adds the release control row
(default: writes enabled, minimum client version 1), the client version on the
existing transaction guard, and freeze triggers for every business table. It
does not freeze production automatically or reject existing clients before an
explicit policy change. The backup inventory includes this new control table.

Applied migrations are not edited. Production data is not copied into a local
D1 or a test fixture. Local migration commands keep `--local` and
`.wrangler/state`; tests create only synthetic records.

## Read-only manifest and comparison

`scripts/workspace2-preflight.mjs` consumes the existing complete private backup
format. It makes no network request, opens no database connection, performs no
SQL and writes only a **new**, private report directory. Inputs are never
overwritten. The report directory is created with mode `0700`; JSON files use
`0600`. The source backup, report and hashes still contain private information:
keep production copies in the original protected production environment, never
in this repository, a development workspace, CI artifacts or a PR attachment.

The report checks:

- All current and extra table rows, revisions, command receipts, history and
  legacy review/draft/import records, using counts and SHA-256 digests.
- Every dish ID/state, variant ID/menu membership/active flag, item ID/type,
  aliases, units, yield and original record digest.
- Ordered dish, legacy item, product definition and shared-process input edges;
  exact amounts, nulls, units, piece meanings, conversions, notes and output edges.
- Canonical effective composition authority, status, references and exceptions;
  it does not flatten multi-output process dependencies into product contents.
- Complete photo metadata **and actual embedded R2 photo byte checksums**.
- Current/future published legacy plan policy and unfinished task counts, with
  the cutover date explicitly supplied in the kitchen calendar.

Every restaurant-data table must match. The automatically permitted row-schema
difference is the absence of historical `evening_checks.plan_policy_version`
becoming `1`. The known new `workspace_runtime_policy` control table and its
freeze/minimum-version changes are reported separately in `runtimePolicy`;
they never disappear from the report or count as deployment approval.
Capture timestamps and database SELECT row ordering do not represent changes.
Changing quantities while preserving item counts still fails. An unexpected new empty
table, a deleted history row, a changed receipt or `Ready` reset also fails.
Review the comparator explicitly for a future schema migration; never broaden
its ignore list just to obtain a green report.

For local synthetic files:

```sh
node scripts/workspace2-preflight.mjs \
  --before /tmp/synthetic-before.json \
  --after /tmp/synthetic-after.json \
  --environment synthetic-local \
  --cutover-day 2026-10-15 \
  --out /tmp/workspace2-preservation-report
```

For a real cutover, run the same reviewed script **inside the existing protected
production environment**, with files retained there, and declare
`--environment protected-production`. This flag is provenance declared by the
operator; it neither grants access nor proves the files came from a live system.
Supply the actual planned cutover date. Do not use `--remote` in a development
command or transfer private backups here to satisfy a test.

Omit `--after` to create the initial manifest. Each invocation requires a new
output directory. Comparison exit codes: `0` = preservation matches, `2` =
preservation differs, `1` = invalid/incomplete input or failed execution. A
successful comparison always reports `releaseApproved: false`: matching data
is one release gate, not deployment authorization or proof of production QA.

The table comparison preserves raw stored payloads; the projected manifest
explains the new reader's interpretation. It does **not** independently prove
that all historical screens presented the same meaning, or that no writes
occurred after capture. Reconcile listed source exceptions with their retained
evidence and confirm the live write freeze separately.

## Browser drafts and old clients

A server backup cannot read browser local storage. Before cutover, inventory
every used device/account, including suspended tabs. For each, retain an
existing recovery export where unsaved work exists, record the account and
device acknowledgement privately, and preserve the browser storage. Do not
rename `labula-*` keys, clear local storage or replace recovery files with a
server export. Existing notebook, review and pending command recovery formats
remain compatible. Never associate an old account's draft with a new account.

Stop edits and confirm pending requests before collecting the final snapshot.
Close/reload old tabs only after their recoveries are saved. A stale client must
remain subject to the existing identity, access and revision checks; these
checks are essential, but they are **not** a global maintenance lock. A delayed
request could still be valid if its revision has not changed.

The implemented **server-side write freeze** uses
`workspace_runtime_policy(id='kitchen')`. `write_paused=1` rejects mutations with
recoverable HTTP 503 / `workspace_write_paused`. `min_client_version=2` rejects
old mutation requests with HTTP 428 / `workspace_update_required`. The common
client sends `X-Labula-Workspace-Version: 2`; this is a compatibility declaration,
never identity or authorization. These responses preserve account identity and
do not trigger the access-loss sign-out latch. The new client retains the exact
pending save/catalog/bulk command ID, expected revision and payload on both
responses; its recovery export can restore that same command after reload.
Already downloaded old JavaScript cannot be retroactively fixed. Some old
clients treated 428 as a definite rejection and may clear an in-memory receipt;
therefore device recovery exports and closing/reloading old tabs are mandatory
pre-cutover gates, not a promise that the server can preserve every old UI state.

New Menu form drafts use independent page-writer keys. Loading a saved copy
forks a new writable copy while preserving both the source and any current
draft. Completion/discard writes only the owned copy's closed marker. An open
second tab therefore cannot have its newer edit overwritten or deleted by
another tab's recovery. Account and form identity are checked before reading;
malformed copies stay retained, and a storage failure is surfaced before the
edit is accepted. The original single-key form format remains recoverable.

The policy is checked before a write handler and again by an SQL trigger inside
the existing receipt/data transaction. A pause or version change racing request
admission rolls back the entire transaction. Old deployed code inserts the guard
without a version, so its SQL default is 1 and it cannot bypass a minimum of 2.
All business-table INSERT/UPDATE/DELETE operations also have freeze triggers,
covering legacy initialization outside the guarded transaction. The policy
control table is changed only through the protected operational database access;
there is no public HTTP toggle or unrestricted restore route. New persistent
tables must extend both backup coverage and freeze trigger coverage.

Mature Today, Menu, notebook, settings and complete-backup reads stay usable;
read-time initialization now returns existing data without writes. A missing
initial dataset cannot be initialized during the freeze and may return the
maintenance response. A session visit skips its last-sign-in stamp while frozen;
a first account link waits until writes resume. In-flight R2 photo staging may
finish writing an immutable unreferenced object, but the guarded database cannot
publish a new photo pointer. The backup verifies referenced object bytes.

The helper below is deliberately **local-only** and never accepts `--remote`, a
database override, arbitrary SQL or credentials. Do not pause a shared local QA
server while another tester is using it. Rehearse in an isolated local database:

```sh
npm run db:migrate:local
node scripts/workspace2-runtime-local.mjs status
node scripts/workspace2-runtime-local.mjs pause
# Verify reads work and attempted writes leave no receipt or data change.
node scripts/workspace2-runtime-local.mjs resume --min-client-version 2
```

Production uses the same reviewed state transitions through separately authorized
protected hosting/database tools. Installing migration 0023 is required before
its freeze can protect the old deployment; its default stays unpaused/minimum 1.
Record the policy row and revision at each transition. After reload, reconcile
pending work with the current source and preserve exact retries where still
applicable. No dual writer is used.

## Ordered cutover gates — production execution remains pending

1. Identify the actual deployed commit, current sources, Site audience and
   bindings. Resolve drift from the reviewed branch. Complete `npm run validate`
   and browser evidence for the exact candidate commit using synthetic data.
2. Have Owner/Manager inventory browser recoveries, active legacy plans and
   unresolved composition sources. Record explicit decisions; do not change the
   menu just to eliminate a warning. Keep historical review access for recovery.
3. Retain a protected pre-change backup, then install the reviewed additive
   migrations, including 0023 with its compatible default. Set the runtime policy
   to paused in the protected environment and verify its row/revision. Probe
   delayed old-client writes and ensure no applied receipt or data change.
   Confirm the atomic guard prevents in-flight commands from committing after
   the freeze boundary; all browser recoveries must remain available.
4. Capture a complete private backup from the existing protected environment.
   Verify table coverage, counts, photo bytes, notebook identities and revisions.
   Retain the previous deployable artifact and its source SHA as well as the
   protected backup. Record the freeze boundary and audit/receipt high-water marks.
5. Run the preflight initial manifest there. Confirm every reviewed additive
   migration is applied to the existing DB. Do not run seeds, truncate tables
   or populate a second production database. Compare the pre-change backup too:
   only the explicitly reported additive policy/control changes may differ.
6. Deploy the exact tested artifact to the same Site, keeping audience and
   bindings. Capture the post-migration backup while writes remain frozen. Run
   strict before/after comparison and examine all exceptions. A mismatch blocks
   reopening writes until explained and corrected without discarding evidence.
7. Verify authenticated Owner/Manager/Cook access, the unchanged menu and deep
   compositions, read-only Cook projection, existing historical links, draft
   recovery, plan versions, and the original logo/favicon on the deployed build.
   Verify all old clients must reload before resuming work. If access to physical
   kitchen devices is unavailable, record that limitation and schedule that gate.
8. Decide each currently active legacy plan explicitly before daily use. Resume
   writes with minimum client version **2**, only after all preceding gates pass
   and deployment is authorized. Probe a queued old-client command: it must get
   recoverable 428 without a receipt. Run a designated, auditable operational
   smoke check with the new client; any writes
   now count as new production data and change the rollback procedure below.

## Rollback boundaries

**Before reopening writes:** an in-place additive column is compatible with the
old code; restore the previously verified application artifact and leave the
column in place. Do not delete the applied migration record. Compare the frozen
snapshot to ensure no content changed. A backup restore should be unnecessary
for an adapter-only UI upgrade and is not an automatic response to a UI defect.

**After new writes:** first freeze writes again and take a new complete protected
backup, including receipts, history, product definitions and policy 2 plans.
Rolling back only the frontend/backend may drop optional product definitions on
an old whole-notebook save or reintroduce the old derived-roster behavior. This
is not a safe rollback, even if the old code can parse the additive SQL column.

Prefer a forward fix that preserves the new data. If a rollback is essential,
keep the current version read-only while preparing a tested compatibility patch
for the old version. It must preserve `workspaceRecipes`, enforce policy 2
published-roster semantics, retain exact receipts/revisions and support current
draft formats. Rehearse it on synthetic post-release commands, compare all
preservation records, and review the private delta between the freeze boundary
and the latest snapshot. Reconcile every committed command; never restore the
old snapshot over newer orders, `Ready` states, edits or accounts. Only then
deploy the compatibility build and reopen writes. No data-loss rollback is
authorized by this document.

## Evidence and limitations

`node scripts/check-workspace2-preflight.mjs` exercises the actual adapter and
CLI against synthetic sources: legacy single-source, production/shared outputs,
incomplete approved review, explicit product recipe, supplier composition,
unavailable approval, current/past legacy plans, retained review drafts,
commands, task state and embedded photo bytes. It checks deterministic reruns,
read-only inputs, file permissions, refusal to overwrite evidence, failure exit
codes and detection of changed data despite equal counts. It runs in
`npm run check` via the existing `check-*.mjs` discovery.

`node scripts/check-workspace-runtime-policy.mjs` additionally executes the
actual protected API/guard layer over synthetic SQLite: all-table freeze,
transactional pause/version races, legacy SQL guard defaults, same-origin checks,
retained browser recovery, exact retries and no sign-out. It freezes a mature
published plan and reads real Morning/Evening, Menu, notebook, stock, rounds,
calendar, team, instructions and complete backup without changing the database.
It also checks that the operational helper is permanently local-only.

`node scripts/check-workspace-policy-notebook-recovery.mjs` exercises the actual
notebook hook for save, catalog and bulk operations with both 428 and 503. It
checks exact bytes/revisions/IDs, blocked replacement edits, device export,
page reload, restored pending command, one successful retry and no duplicate
receipt. Definite input rejection still returns the form to an editable state.
`node scripts/check-workspace-form-draft.mjs` checks independent live writers,
forking and own-copy closure, legacy/malformed copies, account isolation,
storage failure and a duplicated/reloaded page. These are automated state
tests; browser dialog behavior is verified separately.

Not yet established by these tests: actual production menu equality, protected
backup restore capability, deployment of the freeze to the real D1, old physical
device inventory, completed production migration, deployment or a live restaurant
pilot. These remain explicit release gates; they are not simulated successes.
