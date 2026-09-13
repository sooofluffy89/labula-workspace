# Preparation and storage release — 2026-09-13

The notebook payload moves from version 2 to 3. D1 table structure is unchanged. The versioned migration adds empty `prepProfile` values to catalog items; it does not infer any chef answers, copy legacy quality estimates into rules, or change recipes, IDs, aliases, menu membership or legacy quantities/storage fields. Those legacy fields remain preserved and protected. The new structured profile is the editable source for this collection flow.

The migration is an optimistic, revision-checked update on the first authenticated notebook read. An old whole-notebook client is rejected before writing. Existing v2 ordinary-save receipts are checked before rejecting a new old-client write, so an acknowledged old request remains recoverable without reapplying it.

Profile saves use `/api/prep-profile`, the existing atomic command receipt table, original account, revision and request ID. Receipts record server time and stable author identity. The notebook records the server author email and update time. No per-item author claim is derived from a browser clock. Conflict resolution requires loading and comparing shared answers before replacing them. Source references are reported evidence, not safety certification.

## Pre-release backup

The complete authenticated live notebook was compared to the existing full snapshot by recursively sorting object keys and hashing UTF-8 JSON without whitespace. Both were 55,981 characters with SHA-256 `ec766a547ff08f4e5e93b4f1350fc7fa2aec62541840afd71650044bb0561cc1`. Live revision: 181; 79 catalog items and 24 recipes. Backup and verification record are outside the source repository in `../nasazeni-prep-storage-2026-09-13/`. No production recipes or sample operational answers are bundled in the release.

## Safe rollback

Do **not** deploy the unmodified version-2 server over a version-3 notebook or restore the pre-release payload over newer chef edits. That would either reject the current payload or lose new answers.

For a UI regression, keep this release's version-3 schema, migration, validation, command receipts, JSON export/restore and server handlers. Disable the `prep-launch` entry and the `PrepWorkflow` mount in `KitchenApp`, and the preparation edit button in `ItemEditor`; keep the saved profile summary and JSON export available. Build, validate and publish that compatibility release with the same project and access. Existing profiles, recipes, drafts and receipts remain intact. Re-enable the UI in a subsequent fixed release. Pending saves from already-open pages remain accepted and idempotent.

For a data incident, first export the current complete notebook and keep all current revisions, receipts and catalog history. Reconcile the pre-release backup with current data using the notebook restore comparison; historical v2 files do not clear v3 profiles. Do not perform a blind database replacement. If the current data is unreadable, prepare a maintenance recovery that validates a copy, preserves the current payload as evidence, and updates with a revision guard. Obtain specific approval for any destructive replacement rather than erasing later chef input.

## Verification

Run all regression scripts, TypeScript checking, lint and the Sites production build. New regression scripts exercise profile branches, exclusive food states, independent units/anchors/sources, migration, old clients and receipts, protected fields, exports, restores, merges/undo, account/origin checks, rollback, lost responses, concurrent writes and real React workflow handlers with controlled request deadlines. These are automated simulations, separate from the browser checks.

Browser checks use only the localhost D1 notebook and clearly labelled test items. They cover the real bulk entry, two-step flow, saved summary, conditional preparation questions, independent durations, multiple setups, remove/undo, immediate use, close/reload/resume and mobile layout. Do not claim validation by the chef or a physical phone; responsive viewport testing is a browser check.

The 360 × 780 browser viewport was also checked with a temporary local 200% text stylesheet. It revealed a cramped fixed-header/footer layout; the mobile dialog now scrolls as one document, keeping large text and keyboard focus visible. The test-only stylesheet was removed before the release build. This was a text enlargement test of the actual application, not a claim about a physical device's settings.
