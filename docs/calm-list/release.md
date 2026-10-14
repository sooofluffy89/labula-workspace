# Calm list — Evening check and Morning prep

Baseline: published v48, commit 422abd2ea3eb6d0f1c719745852a730a10cecbac. The v47 audit's batching, full-response cost, incremental reads, Finish queue drain and offline continuation were already addressed by v48. This change preserves those endpoints and command formats.

## Behaviour

- Navigation renders its target immediately, hides a mismatched cached date, and applies only the latest valid read. Manage, History and exit invalidate pending navigation. Stale fast/legacy read errors and account checks cannot block the next date. Refused navigation explains the reason even outside the operational list.
- User Refresh and Retry have an explicit verifying state for their entire GET, recovery drain and final read, regardless of fresh cache. The same operation supports legacy transport. Background reads retain their separate quiet state.
- Ready sets a verification requirement independently of per-item ACK. A read proves finality only if started with an empty outbox and no accepted intent has appeared since. Restored Ready invalidates earlier read evidence as well. The final Ready immediately requests a whole-plan check; errors retain the requirement and offer Retry. A successful item ACK alone cannot declare the whole morning complete.
- Answer and Ready choices still occur only after durable local storage succeeds. A reserved row label distinguishes waiting, sending, offline, verification, conflict and a matching server receipt. Saved feedback remains visible for 1.5 seconds without moving the row. The top sticky status is offset from sticky column headings and occupies layout space.
- Start, date save, correction, Add and mapping show concrete progress. Failed Add retains its selection and inline error, including on a new check. Retrying reuses the original durable command. Modal controls and dismissal are guarded through original-save verification; keyboard focus returns to the opener. Conflicts retain the existing own/shared comparison and explicit resolution choices.
- Finish still drains pending writes, checks a current shared summary, then requires explicit Confirm. Atomic publication remains unchanged. No animation timer controls network success.
- Press/choice transitions are 120 ms, saved marker 140 ms with 1500 ms display, progress 180 ms, dialogs 170 ms open / 120 ms close. Reduced-motion removes movement without removing the static saved marker or label. No spinner, confetti, per-answer toast or synthetic network percentage.

## Verification

Added `check-calm-sync.mjs` (actual controller/routes/SQLite) and `check-calm-ui.mjs` (actual StockWorkflow hook state and event handlers backed by the real routes). These cover latest navigation and dates; cancellation; obsolete fast/legacy errors and identity replies; fresh-cache held Retry; manual Refresh in both protocols; Finish while queued; final and restored Ready verification; failed new Add retaining choices and error; exact retry, modal guard, and visible refusal outside the list. Existing fast-sync tests cover rapid Ready–Undo–Ready, two actors, conflicts, stale ACK, lost committed response, offline restoration, auth, timeouts and disposal.

Run the complete 59-script suite, TypeScript, lint and production build. Browser verification and release evidence live outside the checkout in `/Users/johnny/Documents/LABULA/klidny-seznam-release-2026-09-27/`.

## Preservation and limitations

No migration, server endpoint, permission, actor, revision, operation-ID, storage-key, calendar, Track or round changes. Production verification is read-only, with complete 29-table backups before/after and unchanged custom audience. Test responses and fault injection exist only in the isolated local QA copy.

The existing incremental polling transport remains (2.5 s active / 10 s idle, bounded backoff). It is not server push. Offline devices cannot know other unpublished work; “all ready” means the latest successfully verified shared plan, with its existing freshness limit. Device storage remains necessary for unshared changes. No claim of a new backend speed increase is made by this presentation/navigation release. Physical-device and assistive-technology user testing remain advisable; browser reduced-motion validation uses the same CSS rules forced by a QA-only control, without changing the user's OS settings.
