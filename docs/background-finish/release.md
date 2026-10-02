# Background Finish: one final approval

Evening check opens an immediate local summary, including the safe pending overlay. The final **Finish check** persists an immutable, account-bound approval before dismissing the dialog. It then sends accepted dependencies, checks the exact shared content and calls the existing atomic publication endpoint. No second confirmation is required unless the approved content has changed or a real error requires a decision.

## Durable boundary and recovery

Sites exposes the current atomic database publication endpoint; this release does not introduce or assume a supported durable worker queue. **The app must remain open until the atomic publication receipt is confirmed.** The server transaction commits the check version, tasks, audit and original operation receipt together. This is the safe boundary for closing the phone, even if loading Morning prep details subsequently fails. Browser promises, animations and locally persisted intent do not constitute server receipt.

The additional `labula-finish-v1:<account-id>:<intent-id>` journal retains the exact approved snapshot/fingerprint, dependencies, generation, dates, actor and stable confirm command including its original metadata. Existing answer and note journals are unchanged. Offline, reload and a lost post-commit reply replay the original immutable command; they never generate a fresh publication identity. Corrupt approval or receipt records block recovery and remain preserved. A later explicit approval retains and links the previous intent through `supersedes`.

Pending controllers stay alive across React unmount/navigation using an account-scoped pool. A real dispose/phone close stops client work; reopening restores it from the journal. Accepted feedback is flushed by a separate dependency controller; unsubmitted drafts are never sent. Retry is bounded by the existing recovery policy and remains available manually. Shared changes require a new summary; author/time and old/new values are shown where the snapshot supplies them. Server authorization and CAS protections remain authoritative.

## Scope and UX

Pending Finish locks conflicting handlers, not independent navigation. Deferred date navigation respects the latest request and never labels old rows as a new date. Completion does not redirect the user. Network progress is truthful, compact and tied to the check/date. Animations only represent actual work; reduced motion retains all information. A commit receipt is not a fresh Morning snapshot or proof that every task is Ready.

Cook navigation omits History; Manager and Owner retain it. Direct-route authorization, recipes, profiles, reviews, Track, rounds, calendar and Morning Ready/Undo are unchanged. There is no schema migration and no new server transport.

## Validation

`scripts/check-background-finish.mjs` and `scripts/check-background-finish-recovery.mjs` exercise the actual controller → API → SQLite transactions: pending answers, immediate summary, durable approval, duplicate click, unmount, reload, offline, lost ACK, two-account simultaneous Finish, explicit replacement approval, relevant existing Ready changes, accepted notes versus drafts, empty plan, correction, authentication recovery, foreign-account isolation, changed target and corrupt journals/receipts. The existing regression suite also covers legacy protocol, CAS, calendar Sunday → Tuesday, mapping, old ACK, permissions and queue recovery.

The release evidence is outside the deployable repository in `/Users/johnny/Documents/LABULA/finish-na-pozadi-release-2026-10-02/`. It includes logs, controlled baseline comparisons, desktop/mobile screenshots and private before/after exports. No synthetic identities, injected network delay, QA tools or backup data are included in the production archive.

The controlled benchmark distinguishes foreground approval latency from actual database publication. Backend request counts and atomic publication are preserved; this release primarily eliminates waiting before the summary and a second required click. Desktop viewport emulation is not a physical phone test. Interrupted/private browsing storage remains subject to browser retention; do not clear local data while pending work exists.
