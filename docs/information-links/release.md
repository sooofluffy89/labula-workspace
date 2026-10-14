# Information links — implementation and verification

Baseline: production v45, source `a89c30dcae02129993731cfa81b87f8eb8cd0906`.
Release record (exact deployed version, commit, backup comparison) is kept outside the published checkout at `/Users/johnny/Documents/LABULA/propojeni-release-2026-09-26`.

## Coverage

- F01: Direct-use links carry stable ingredient/menu/recipe IDs. A matching single variant opens directly; multiple matches offer named variants. Inactive and unfinished variants are explicit, dish totals deduplicate variants. Matrix cells pass their actual variant ID.
- F02: One read-only information dialog with a single scrolling area is shared by catalog, recipe rows, usage links, overview/matrix, menu simulator, dashboards, Manage list and round selection. A separate Edit action enters the existing editor. Recorded inputs are linked; missing composition and storage are explicit.
- F03: Morning source and row links read the exact confirmed `evening_versions` snapshot, preserving historical names, group, round, answer author/time and confirmation author/time. A draft correction is labelled and never started by viewing. Historical version links remain explicit when a newer version exists.
- F04: Related quick cases and legacy records use saved ID relationships, including shared outputs and storage records. Read-only review shows answers, outstanding checks, approvals and application separately. Current versus stale approval is checked against its proposal fingerprint. No review component with autosave or shared-position writes is mounted.
- F05: Source list stays mounted. Nested information frames retain local disclosure/filter/pagination state and scroll; browser Back/Forward and stable hash links work. Account-keyed provider clears foreign-account history. Stock returns retain the selected section and Manage list state.
- F06: Contextual Activity filters by original item ID and optionally source check. Server save time is primary, device click time remains explicitly unverified. Historical source links distinguish latest from exact confirmation. Merged IDs offer an explicit recorded target and original history rather than silently combining identities.
- F07: Catalog search, filter and results precede preparation collection; batch lists start collapsed. Existing drafts, resume and editor flows are preserved.
- F08: Detail shows Track, inclusion and current check round; check cadence is explicitly distinct from production cadence.
- F09: Overview name/alias search; matrix opens its actual variant, not an arbitrary active variant.
- F10: Shared ProfileSummary already renders conditions/reference for every documented storage rule; dashboard fallback now does too. Quality estimate and rule source stay separate. No safety duration is inferred.
- F11: Help distinguishes routine estimates, collected evening/Ready choices, and still-unmeasured quantities.

Production exclusions for the four Manifesto-linked preparations remain in force. The detail omits their production batch/frequency/work; review uses existing active-scope projection. Cook receives only allowlisted operational source data; catalog, recipes, review and full Activity stay forbidden on the server and in the UI. Existing wider collaborators retain access. No schema migration, scope/Track change or data backfill is introduced.

## Automated verification

The dynamically discovered regression runner passed **55 scripts** (53 existing plus `check-information.mjs` and `check-information-ui.mjs`). TypeScript no-emit and ESLint pass. Build and final deployment outcome are recorded in the external release record.

New tests exercise the real GET route and SQLite with all migrations: exact/multiple/inactive variants, shared review cases, pending checks, approved versus applied and stale approval, published answers during correction, later versions, original authors and names, malformed links, missing targets, anonymous/paused/Cook/legacy/owner boundaries. All application tables are compared before/after reads, including review position and drafts.

Actual client effects/handlers are tested for aborted/late replies, account mismatch, timeout, 401/403/404 and retry, Cook no-fetch, selected-ingredient highlight, Back/Forward/close, invalid links and foreign-account history. Existing actual notebook/preparation integration tests verify that read-only entry does not enter editing and retain the autosave/flush regression scenarios.

## Browser verification on isolated data

Separate checkout/database: `/private/tmp/labula-information-qa`, test identities only. QA authentication route and fixture are absent from the published checkout.

Verified:
- Manage list: alias search + Starters/Main dishes OR selection → ingredient → variant chooser → exact variant with highlight → browser Back → review with open verification → Close. Filters preserved.
- Morning row → confirmed version 2 while correction draft exists → original chef answer versus owner confirmation → filtered item/check history → return, with Ready unchanged.
- Round picker: an unsaved selected checkbox survives Details/Close; selection was cleared without saving. Focus returns to the Details button.
- Catalog search is first; empty storage/inputs explicitly say Not recorded. Escape returns focus to the source card. Stable ingredient link survives page reload.
- Cook direct ingredient URL is denied; operational source is available without catalog/review/history links.
- Responsive emulation at 320, 390, 430 and 1280 px; no page horizontal overflow; one scrolling detail surface. Long ingredient names wrap. Keyboard Escape and focus restoration were exercised.

After standard fixture initialization, **all 26 application tables remained identical** across browser reads. Only Cloudflare's internal `_cf_METADATA` changed. Before/after snapshots are in the external release directory.

## Limits and follow-up

Responsive checks used desktop browser viewport emulation, not physical phones. Reduced-motion support is implemented in CSS; OS-level reduced-motion and device screen-reader testing were not exercised. Database round trips and client races are covered by deterministic tests; this is not a multi-hour load or concurrent live-user test. List state persists in the current workspace session; reloading a direct link opens its authorized target with a default workspace return, not a serialized copy of every prior filter.

History covers recorded events only. Old missing metadata remains missing. Unrecorded inputs and unresolved review are never treated as a complete recipe or approved production specification. A read-only snapshot intentionally shows saved notebook data, not local unsaved edits.

## Deployment and rollback

Use existing Sites project/address and custom audience unchanged. No schema migration is required. Verify full private backup of all 26 relevant tables, source/production commit, private audience revision and post-release table comparison. Rollback means redeploying the previously saved compatible v45 (or a later verified compatible version), **not restoring old data over current chef work**.
