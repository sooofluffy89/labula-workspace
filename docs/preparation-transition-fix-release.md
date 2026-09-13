# Preparation transition data-loss fix

Fixes the P1 audited against release 14: edits made during both ordinary saves could leave `flush()` reporting success while the final edit remained local; the preparation-opening snapshot then replaced it.

The notebook hook now acquires preparation ownership synchronously in the opening handler. It drains earlier ordinary saves while blocking further recipe/catalog/restore mutations. Ownership remains until the form closes, including while waiting for another browser tab. Normal editing during ordinary autosave outside this flow is unchanged.

`flush()` is bounded and only succeeds when the current notebook equals its confirmed base and no write or receipt remains unresolved. Snapshot acceptance independently checks the owning AbortSignal, cancellation, pending work, account and revision before changing state. Cancellation retains any in-flight ordinary request and only releases the cancelled generation. The UI shows a cancellable saving dialog during transition. Notebook imports finalize preparation/alias handoff only after successful opening; failed or cancelled opening retains the imported file.

No schema, server endpoint, dependency, access, draft-format or browser Web Lock protocol changes. Already-open older pages must be refreshed to receive the fix; finish or export outstanding work before refreshing. Rollback should preserve these guards and the release-14 draft coordination rather than restore an older unsafe editor.

## Verification

- All 24 previous regression scripts, plus two new scripts (26 total).
- Actual hook: original two-save reproduction; synchronous mutation rejection; snapshot dirty/in-flight/receipt/account/revision guards; ordinary autosave typing; cancellation, successor ownership, 401/409, controlled pre/post-commit timeouts, exact retry and late replies; imported recovery with additional local edits.
- Actual KitchenApp + useNotebook with effects and the 1,200 ms autosave timer exercised: all entry points, immediate waiting UI, repeated click, cancel, late callbacks, successful handoff and retained imports.
- NotebookRestore handlers: failed preparation handoff keeps the file and aliases; successful retry completes both.
- Local browser with isolated data: immediate opening after a recipe change, item-detail entry, successful profile save and two-tab waiting/handoff with the latest saved note. Production smoke checks only read data and open/close an unedited form.
- Type checking, lint and production build are required before release. Controlled failure timing is tested in isolated harnesses, not injected into production.

Production notebook and access snapshots are kept outside the checkout in `../nasazeni-oprava-prechodu-2026-09-13/`. Compare fresh snapshots around release; never restore a backup over subsequent chef edits.
