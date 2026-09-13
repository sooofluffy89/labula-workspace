# Preparation entry on the home page

Coverage is derived by `profileCompletion` and `preparationProgress` from the confirmed notebook returned by `getSavedBase`. It is not an approval, storage safety judgement, or a new persisted status. No schema migration or new database table is needed. The same coverage powers counts, missing-answer descriptions, first unanswered step, and the remaining-only queue.

The recipe tab offers start/resume and a paged list of missing answers. Drafts and uncertain receipts remain separate from confirmed progress. Completed and zero-scope states hide the main prompt; local changes and pending requests still have a recovery entry. A per-account device preference remembers a previously completed active scope only to label newly introduced items. It never determines coverage.

All original form fields, profile version, receipt format, account isolation and server authorization are retained. Explicitly added empty storage setups are now preserved by normalization; otherwise a partial setup could silently disappear and make an item look complete. The automatic untouched initial setup still stays outside the profile until edited. Unreadable local drafts are retained and downloadable, with editing blocked until a valid draft is restored.

Verification includes the existing regression suite plus coverage and home-prompt handlers. Remaining-only actual workflow handlers cover completion, partial save, storage resume, and receipt replay after item deletion. Browser checks use localhost and its separate D1 store; production data is read only for backup and comparison.

Rollback: no database migration is applied. For a UI rollback, retain the current profile normalizer (which preserves explicit blank setups), schema v3, receipt APIs and recovery/export support; disable the home prompt and remaining-only entry, then build and publish a compatibility release. Do not restore an old notebook backup over subsequent chef changes, or redeploy an older normalizer that rejects profiles with explicit blank setups. Take a fresh live backup before any data reconciliation.

Pre-release source: 9bc8fffb4e535686977ecee8346144962baaa3d4 (version 12).
The recoverable notebook backup and release record are outside the site checkout in ../nasazeni-home-completion-2026-09-13/ and are never packaged.
