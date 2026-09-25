# Team & access — step 1 (25 September 2026)

## Scope

Owner-only Team & access is directly available in the main workspace tabs. It manages existing kitchen profiles and stock pause state. Real entry to the private application remains controlled by Sites sharing. No audience, authentication, owner definition, real membership, schema, or migration changes are included.

The new view supports adding a cook profile, immutable sign-in email, kitchen-name edits, confirmed stock pause/resume, search and status filters, production-link copying, and actor-ID-filtered activity. Owner pause remains rejected server-side. Unlinked profiles are not assigned another person's activity. Historical actor names and CSV/pagination semantics are unchanged.

## Components and safety

- `app/team-workspace.tsx` is the only profile editor. The former stock dialog now opens this same view; StockPeople retains its own identity and stock-pause checks and Activity.
- `lib/team-client.ts` coordinates the actual API and browser recovery. Each command is persisted before sending and retried with its original ID. Commands from the old `labula-team-v1:<accountId>` key are read compatibly. New per-command v2 keys avoid collisions between tabs. Corrupt records are retained for download; clearing them requires explicit confirmation. Storage failure prevents an unbacked mutation.
- `/api/team?management=1` reads the owner directory without `ensureMember` or owner bootstrap. Non-owner/anonymous requests fail; ordinary GET still supplies the current stock identity. Existing POST, CAS, atomic history and idempotency remain in use.
- Recipe, catalog, stock and Team workspaces stay mounted when changing tabs. Team does not receive a notebook setter or accept another notebook snapshot. Preparation transitions retain their existing guards; review stays on its separate route.
- Unsent Team form text is retained in per-account, per-tab sessionStorage and guarded on unload. Pending submitted commands remain in account-scoped localStorage. Deliberately closing a tab after accepting the browser's unload warning can discard an unsent session-only form; export is available if browser storage fails.
- No production answers, Track values, evening checks, morning tasks or review approvals were entered by this release.

## Verification

All 47 scripts in `scripts/check-all.mjs` passed, including the new real TeamController-to-route-to-SQLite integration suite and expanded KitchenApp/useNotebook navigation test. TypeScript, full ESLint and production build passed. Final publication also builds the exact source via the official Sites workflow.

Coverage includes read-only management, unauthorized access, normalized duplicate email, lost response after commit, exact replay, legacy recovery, two separate pending records, corrupt/blocked storage, double-click, disposal, login/account change, stale revisions, protected owner, and retained in-flight notebook edits. Existing stock/activity tests verify atomic history, immutable names, pause enforcement, CSV, stable paging and unchanged recipe data.

Browser checks used only `/private/tmp/labula-team-ui-qa` with a newly initialized SQLite database and synthetic `example.test` identities. Owner add/edit/pause/resume, duplicate rejection, form preservation across tabs, protected email/owner, linked/unlinked activity, keyboard dialog focus, copied-link feedback, Cook stock identity/pause, and anonymous sign-in boundary were exercised. 320, 390 and 430 px mobile layouts and 1280 px desktop were visually checked. The 320 and 430 px widths were additionally checked against DOM scroll width. Enlarged base text (32 px) was checked through QA-only CSS at desktop width; native mobile browser zoom was not certified. Direct API navigation in the browser was blocked by its client; the actual API permission cases passed in the integration tests.

## Deployment and data verification

Fresh complete production backups and policy snapshots live outside this repository in `/Users/johnny/Documents/LABULA/nasazeni-team-ui-2026-09-25/`. The pre-deployment backup has all 21 required tables. Compare all table contents after deployment, separately from capture timestamps; preserve legitimate concurrent changes rather than restoring an older snapshot. Exact release, hashes and post-deployment results are recorded in that directory's handoff.

## Limits and next step

This list is a kitchen-profile directory, not the complete Sites audience. Profile creation is not an invitation; pause affects stock mutations and does not revoke recipe access. Last recorded stock activity is intentionally omitted from the directory; View activity provides the actual history without expanding backend scope.

For the later Delivery-style step, extend the existing owner-controlled operations and enforce an application allowlist across every protected API before considering any audience transition. Do not infer such permission from this release. Preserve `TeamController` recovery on rollback/forward fixes: v38 understands v1 keys but cannot display new v2 pending commands. Keep all local recovery records until this client can verify them.
