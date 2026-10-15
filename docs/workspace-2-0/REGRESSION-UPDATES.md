# Regression updates for Workspace 2.0

Existing domain, authorization, receipt, concurrency, recovery and data checks
remain enabled by `scripts/check-all.mjs`. The runner still discovers every
`check-*.mjs`; no checks were excluded to accommodate the new interface.

## Deliberate UI changes

| Script | Previous assumption | Current behavioral protection |
| --- | --- | --- |
| `check-kitchen-preparation-integration.mjs` | The root mounted separate dish/catalog editors, a preparation prompt, tab controls and a root-level recovery workflow. | Mounts the real `KitchenApp`, `useNotebook` and `WorkspaceData`. Exercises preparation archival recovery through Data & backup, its synchronous edit guard, in-flight autosave, cancellation, ignored late completion, snapshot lifetime, imported-draft retry and wrong-account rejection. Tests current Today/Menu/Settings/People navigation while a real save is pending, retained mounted editor state, peer refresh behavior, inactive Today callbacks and same-tab review archive. Adds a notebook-503 regression proving Today remains mounted independently. Removed assertions concerned only deleted entry points and their presentation; the underlying handoff and state protection remain tested at the new boundary. |
| `check-calm-ui.mjs` | A permanently visible `Checklist settings` navigation button with `aria-pressed`, and a button labelled `Dates`. The hook harness had no DOM element class. | Uses the current `Manage checklist` action and `Date` control. Supplies the fixture's actual Manager capability through the stubbed access component callback; asserts the managed list is active instead of expecting a retired navigation button. Provides an element fixture and invokes the real Finish close-focus handler, asserting focus returns to the captured trigger. Keeps real StockWorkflow/controller/API tests for request races, incomplete Finish, retry, conflicts, preserved selection, blocked navigation and published answer truth. |
| `check-ux-behavior.mjs` | Invalid routes defaulted to the removed insights view; operations links retained the old destination ID. | Asserts Morning as the default and canonical history routing. Adds legacy insights/overview/manage mappings, nested item-path URL roundtrip and checked-catalog roundtrip. Retains information hash/unrelated parameter compatibility, valid dates, inverse Undo preserving later edits, station defaults, calendar diff and field-validation tests. |

The former preparation entry points and dish creation callbacks are no longer
root responsibilities. The new Menu behavior is independently covered by the
Workspace menu checks and browser suite. Retained legacy modules continue to
have their existing direct component and service checks; passing those does
not mean they remain primary product destinations.

`check-history-read-race.mjs` now also exercises persisted collapsed history
filters through actual component callbacks: visible filter chips and exact
More count, individual removal, reset from zero results, and a subsequent
request with cleared filters. Its original stale-response race assertion stays.

`check-morning-layout.mjs` additionally invokes the missing-plan actions with a
closed weekday and a date exception, verifies the exact recorded draft evening,
and distinguishes Cook/Manager checklist actions. Loading and request failure
never expose a provisional no-plan action. Existing reflow, held pointer/Space,
account isolation and conditional Ready/Undo checks remain.

## Standards-compliant request fixtures

The new runtime version header means `accessFetch` always constructs a browser
`Headers` object. Earlier fake fetch functions accessed header properties as a
plain object, incorrectly treating valid revision and operation-ID headers as
missing. `check-bulk-client`, `check-preparation-transition`,
`check-prep-workflow`, `check-kitchen-preparation-integration`,
`check-menu-scenarios-ui` and `check-review-ui` now read via
`new Headers(...).get(...)`. Their exact receipt, revision and conflict
assertions are unchanged.

`sync-harness.mjs` and `check-team-workspace.mjs` now merge request headers using
`Headers.set`, retaining account, protocol and version headers regardless of
whether callers supply a record, entries or `Headers`. The fallback scenario
in `check-sync-recovery.mjs` explicitly removes only `X-Labula-Confirm` using
`Headers.delete`; it no longer accidentally drops all headers. These changes
make the synthetic transport match actual Fetch semantics rather than relaxing
server authorization or optimistic concurrency.

`check-checking-stations.mjs` previously asserted a fixed backup table count of
41. It now compares the complete exported table-name inventory with SQLite's
actual schema, including the new runtime-policy table. Missing or extra tables
fail this stronger assertion; legacy/incomplete station-backup checks remain.

`check-fast-sync.mjs` accounts for one additional authoritative runtime-policy
read per write request (five database roundtrips instead of four). It still
asserts the exact count and bounded history reads, and now compares single-
and two-command batches to prove the guard does not add per-item roundtrips.

## Scope and verification

All data is synthetic and all databases used by these scripts are local SQLite
fixtures. No production menu or backup was imported. Hook tests emulate React
state/effects and selected DOM contracts; they are not screenshots or a claim
of testing a physical device. Browser layout and interaction evidence is kept
separately by the integrated Workspace 2.0 verification.

As of 2026-10-15, all **116 of 116** discovered regression scripts have a
passing result across the staged integration runs on Node.js 24.19.0. The
per-script ledger and seven source logs are preserved at
`/workspace/workspace-2-0-verification-2026-10-15/regression/regression-results.json`.
Earlier segments stopped at failures; later passing reruns are linked for the
repaired tests. This is not a claim that one uninterrupted final validation
command passed. The integration owner records the final `npm run validate`
result separately after all changes settle.
