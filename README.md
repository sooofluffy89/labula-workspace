# Lá Bù Lá kitchen recipe notebook

Private English-language recipe collection app for the restaurant owner and chef.

## Included scope
- 19 menu listings from https://www.labula.cz/menu, captured 2026-09-12.
- 24 starter recipe records, including the explicit menu variants; no ingredients or safety durations invented.
- First-version form: only named ingredients or house-made preparations directly used in each dish, without amounts, notes or work details.
- Shared catalog entries can be reused across dishes and renamed consistently.
- Dish status is visible in the desktop list, mobile picker, variant selector and summary: Not started, In progress, Completed, or Inactive. Completion requires the chef’s explicit confirmation for every active variant; ingredient edits reopen the list. Inactive dishes do not inflate the progress denominator. No schema or recipe-data migration is needed.
- Overview counts direct use in distinct active menu dishes, across variants; catalog totals shown in statistics include directly used items only.
- Nested preparation recipes, quantities, finishing, methods, times, storage, shelf life and equipment are deferred. All previously saved fields remain intact in storage and the complete JSON export.
- Bulk entry keeps text and confirmed choices separate from the notebook until a server-confirmed atomic save. Editing/reordering the list preserves decisions, repeated names share one decision, and suggestions cover both catalog entries and new rows. Similarity checks run in a cancellable background worker.
- Copied numbered/bulleted text and likely inline lists require explicit cleanup, splitting or confirmation of the original name. Transformations show the proposed names, recheck limits and require affected name/type decisions again; ordinary restored drafts use the same check. Names such as `5-spice powder` remain intact.
- Bulk review uses one explicit decision per similar pair, persistent dish context/actions, direct type choices and managed keyboard focus. Long names wrap at mobile widths.
- Versioned ingredient drafts can be restored with preserved choices and current-catalog validation. Unfinished saves retain their original receipt when restored; older files without save provenance open for reference only.
- Draft export preserves stored Keep separate decisions independently of an in-progress suggestion worker; restore validates endpoint identities. All-existing lists finish with Done without writing or marking a dish complete; excluded new items keep discard protection.
- Requests have a 30-second deadline covering both fetch and response-body completion. Late responses do not update application state. Earlier ordinary-save timeouts also freeze edits, including already-open item dialogs, and provide an in-dialog retry.
- Bulk and ordinary saves use actor-bound request receipts for safe retries after lost responses. An uncertain bulk request stays frozen until resolved; conflicts keep the draft for re-review. Closing/reloading warns about unsubmitted text and a draft download is available.
- Ingredient drafts can also carry an earlier ordinary-save receipt and additional local edits. Recovery replays the exact PUT, reads the current shared notebook, and protects newer edits; conflicting extra local edits stay in the downloadable recovery until the user explicitly chooses the shared version. Ordinary drafts retain their 750 KB cap; recovery envelopes allow 5 MB, with each notebook payload capped at 750 KB.
- Owner-only alternative names, duplicate review, atomic audited merges and conservative undo; protected fields cannot be changed through ordinary notebook saves. Conflicting hidden metadata or input amounts/notes block merges. Undo is available only before another saved change.
- List/matrix overview with direct-use counts, variant details, all/shared/single filters and three-state CSV matrix export.
- Recipe CSV exports only the direct dish-to-item list. Internal nested calculations and historical export helpers remain available for a later phase.
- Durable D1 storage, automatic saves and optimistic concurrency; conflicts retain local changes for export.
- CSV tables and a complete JSON export. No automatic safety validation or batch recommendation.

## Source caveats retained for the chef
The two children’s listings are not silently merged. The changing Green Market entry repeats another description on the source site. The Xiao Mian source calls a chicken-broth option vegan. These entries are flagged for confirmation, not treated as dietary facts.

## Development
Use Node 22.13+ and the committed npm lockfile. `npm run dev` serves the local preview. The bundled development-only sign-in is `/signin-with-chatgpt?return_to=/`; production uses Sites access control and forwarded identity headers.

`npm run db:generate` generates schema-only Drizzle migrations. Production migrations are applied by Sites. Local D1 must use the generated Worker config with `.wrangler/state` as its persistence directory.

## Validation
- `node scripts/check-bulk-input.mjs`: copied-text detection, explicit transformations, meaningful names, duplicate lines and limits without truncation.
- `node scripts/check-save-recovery.mjs`: exact earlier PUT serialization, current local snapshot, optional legacy-compatible schema and bounded file/payload sizes.
- `node scripts/check-catalog-dialogs.mjs`: open portals retain inputs through pending saves, block actions, catch callback failures and retry without closing.
- `node scripts/check-recipe-progress.mjs`: explicit completion, bulk reopening, no-op preservation, partial active variants, inactive exclusion and empty totals.
- `node scripts/check-model.mjs`: nested yields, deduplicated dish usage, graph integrity, missing quantities, evidence metadata, composition-only completion, numeric-data preservation and safe CSV cells.
- `node scripts/check-bulk.mjs`: draft reconciliation, within-list matches, original data, limits, authenticated bulk/save receipts, atomic rollback, races and newer-write preservation.
- `node scripts/check-bulk-ux.mjs`: pair identity/canonical reuse, file validation, restored choices, changed/missing matches, legacy restrictions and immutable pending drafts.
- `node scripts/check-bulk-client.mjs`: actual save hook transitions, staged data, network loss,401, preflush, double submission and conflict recovery with a controlled request adapter; includes export during first in-flight save, restore after reload, account mismatch and dirty-state refusal.
- `node scripts/check-bulk-dialog.mjs`: actual dialog handlers with isolated hook/primitive adapters; edit/reorder decisions, failure/retry, close warning, worker reuse and stale result cancellation; actual File handlers validate before replacement, preserve current text on invalid/wrong-dish files and enforce legacy reference-only mode.
- Remaining-four-findings regressions cover suspended fetch and response bodies, delayed stale replies, same-ID retry, earlier-save recovery across page loss, fresh shared reads, conflicts before/after follow-up writes, copied-text restore, pending commands with zero additions, worker-pending exports and the three zero-add states.
- TypeScript no-emit check and Sites production build.
- Local API roundtrip, anonymous denial, origin validation, invalid payload rejection, optimistic concurrency and restoration of test changes.
- `node scripts/check-catalog.mjs`: bulk and aliases, merge preservation/conflicts, migration, matrix/export agreement, server authorization, CAS, atomic audit, idempotent retries and undo.
- Targeted desktop and mobile browser QA on local test data: bulk preview/save, alias reuse, suggestions, dismissed pairs, merge/history/undo, matrix details and filters. Bulk fixes also verified through a temporary local proxy simulating rejection before saving and a lost reply after commit, including mobile retry. Test data is restored afterward; no fault injection is shipped and production test data is never inserted.
- UI/UX browser QA: 1280×900, 390×844, 320×568, 390×300; 15 and 150 input lines, long names, explicit pair decisions and keyboard navigation. A local-only response fixture also verified 200% text at 640×450 (not native browser zoom). Chrome downloaded ordinary and pending draft files with expected contents. Automated chooser upload was blocked by the extension’s local-file permission; restoration itself passed the actual component/File-handler and save-hook regressions. No physical phone, software keyboard or screen reader was used.
- Latest four-fix browser checks used 1280×900, 390×844, 320×640 and 320×420. Verified copied-text cleanup/split and type confirmation, header/action visibility and keyboard focus, Done without a new write, excluded-new discard protection, and a deliberately unfinished response body after a committed bulk save. Retrying produced exactly one receipt and five distinct ingredients. An ordinary autosave was also interrupted after commit; its downloaded ingredient draft contained the original receipt and notebook payload, and retry returned the new ingredient to separate review. Production data was not used. Actual file-picker upload remains unverified because of the previously observed Chrome local-file permission block; real File-handler, hook and schema restoration tests passed.
- WebMCP tools are feature-detected and optional. No supported WebMCP validation context was available; their browser contracts are not claimed verified. The ordinary form does not depend on them.

## Access and data
The entire notebook is shared with visitors permitted by the Site access policy. All permitted visitors can fill recipes; no private-per-user split is intended. The access policy must remain private/custom for these internal recipe records. The client never receives source credentials. Server writes require identity and a matching origin; a stale revision is rejected atomically. Catalog management binds the configured owner’s verified email to the stable site identity in D1. The local development identity is accepted only in development builds. Persisted schema v1 upgrades on load; writes from old clients must reload before saving.
