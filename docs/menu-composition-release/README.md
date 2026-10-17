# Workspace 2.0: Menu composition workspace

17 October 2026. In-place implementation of the approved [composition analysis](../menu-composition-analysis-2026-10-17/README.md) and [interactive prototype](../menu-workspace-prototype-2026-10-17/README.md).

Menu now has three views: **Menu**, **House-made**, and **Ingredients**. They share a compact table, selection, filters, composition editor and persistent detail. The dashboard reports checked composition through all house-made dependencies. Today and Settings use the same shell and control styles; daily operational answers, publication and Ready retain their existing backend contracts.

## Implementation

- `app/composition-workspace.tsx`: shared workspace, nested breadcrumbs, account-scoped durable drafts, multi-pick, creation with stable identities, metadata, impact previews, selection/export and guarded inverse Undo.
- `app/use-composition-form.tsx`: existing independent-writer form recovery, reused by the new editor and retained extended dialogs.
- `lib/menu-composition.ts`: transitive completeness, current/all usage, supplier boundary, issue aggregation, search paths and unique dish/variant counts.
- `lib/composition-fingerprint.ts`: confirmation evidence tied to composition content, entered measurements and referenced identities/types/units. Renaming does not invalidate it. Child composition is checked independently.
- `lib/workspace-menu.ts`: existing authority adapter and write validation, extended with explicit own-list confirmation. Shared production inputs remain separate from product contents.
- `POST /api/menu/reopen`: management-only, atomic, revision-checked bulk reopening with account-bound immutable receipts. Its exact uncertain request survives reload.
- `app/composition-workspace.css`: common shell, controls and responsive menu workspace. Loaded after the existing screen styles in the root layout so screen navigation cannot change the visual system.

The former Recipes Compact component remains in source for historical regression coverage and the prepared UI fallback. The active Menu route renders the new composition workspace. Prototype data, reset controls and its browser-only persistence are not used by the production app.

## Data compatibility and release preflight

The initial production Site and source were verified as version 89, commit `ef752c88d6b4ece594b80ed161754092dc94f820`. The same project `appgprj_6aa56065ff148191bca78164158e3a4c`, public audience, `DB` and `BUCKET` bindings are retained. The GitHub main branch was verified to be an ancestor of the current Site history.

There is no SQL migration, seed, bulk conversion or rewrite on deployment. Notebook schema version stays 4. Optional `compositionCheck` metadata is added to dish variants and explicit product definitions. Existing records stay readable without it. Existing dish-list confirmations remain meaningful; a pre-existing nonempty house-made recipe is not automatically treated as checked.

House-made confirmation is written by the explicit product command, with a server timestamp and content fingerprint. Old product requests still distinguish their shared-write acknowledgement from own-list confirmation. Unchanged content can retain valid existing confirmation; changed content cannot reuse it. Full notebook saves cannot drop current product definitions or existing dish confirmation metadata. Merge/type changes reopen affected direct dish lists; content fingerprints also catch retained evidence after other write paths.

The existing complete private backup format already contains these optional fields inside notebook and operation payloads; no backup inventory table changes are needed. Product operations retain before/after notebook payloads atomically with their receipt. Published checks, operational settings, outside-menu use, source history and photos are preserved by the existing storage paths.

Live D1 table/binding names were inspected through Sites. Restaurant database rows and photos were not copied to the development workspace. Complete private backup export/validation remains covered by the existing synthetic API tests. A fresh complete production backup was not captured or independently verified in this environment; it must not be described as having been taken. This code release does not run a destructive data cutover.

## Verification

`npm run validate` completed: type checking, **123 regression scripts**, and the production Worker build. Relevant final type/build checks are repeated after the final UI changes.

`verify-menu-composition.mjs` exercises the rendered app against loopback-only synthetic records:

1. Nine desktop/mobile widths, shared table/detail, no global horizontal overflow, removed density/hide controls.
2. Nested composition, explicit confirmation and transitive dashboard.
3. All house-made, unused entries and the bought supplier boundary.
4. Local draft across tabs/reload and exact measurement preservation.
5. Uncertain product save: same payload and revision after reload.
6. Hidden bulk selection, exact preview, on/off menu and inverse Undo.
7. Confirmation of an off-menu variant and keyboard search.
8. New shared item with durable text, stable ID and saved parent link.
9. Uncertain house-made bulk reopening with exact retry after reload.
10. Category changes deduplicate selected variants to whole dishes.
11. Mobile detail, Back, modal focus and document overflow.
12. Today/Settings navigation and matching shared styles.
13. Actual local Evening publication, Morning Ready and unchanged published tasks after a menu dependency is removed.
14. Low-height 720 × 450 reflow corresponding to the CSS workspace available at 200% on 1440 × 900.

The final results are in [evidence/results.json](evidence/results.json). Layout measurements are in [evidence/layout.json](evidence/layout.json). The 200% check is viewport/reflow emulation, not an independently observed browser toolbar or OS zoom setting. Production authenticated write smoke tests are distinct from these local tests and must not be claimed from them.

Reproduce with the existing project setup and a synthetic local fixture:

```sh
npm run validate
PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs node scripts/verify-menu-composition.mjs
```

The UI verifier refuses a non-loopback URL and checks the synthetic account/data before writes. It never seeds or resets production.

## Publication and rollback

Publish the exact tested source commit through the existing Site repository and native Sites save/deploy operations. Package the unchanged `dist/` build, including its generated `.openai/hosting.json`, Worker/client files and retained migrations. Keep the version 89 source/archive identity available as the pre-release reference.

A plain downgrade to unmodified version 89 after new confirmations are saved could discard optional metadata when an old validator saves a notebook. The prepared branch `menu-composition-ui-rollback` restores the version 89 UI while retaining the new schema, current product API, content checks and write-preservation rules. It is a descendant of the release commit, so it can be pushed to the Site source branch without force. New house-made URLs are mapped to the previous catalog with the prep filter.

For rollback, use that compatible branch/commit, build it, synchronize its exact source and publish through Sites with the same project, audience and storage bindings. Retain live data and audit history. No database restore, plan republication or bulk re-confirmation is part of the UI rollback.
