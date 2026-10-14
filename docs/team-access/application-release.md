# Application allowlist — 2026-10-04

## Implementation
Team & access permits a ChatGPT sign-in email with one form (optional kitchen name, Cook default), first verified login binds the Site-specific account ID, and Disable / Restore retain profile identity and history. New access_enabled is independent of historical active stock-edit restrictions. Wen remains Cook. Only three previously verified production identities are initialized by migration0018; unknown visitors never auto-enrol.

All38 API handlers have central identity/membership/action checks. Sensitive narrower reads escalate the final permission recheck. SQL mutation batches include an in-transaction access barrier; role/access changes during an in-flight request roll back new writes. ID receipts, author attribution and sync remain intact. Client revocation stops retry, hides private UI and preserves account-scoped drafts. A revoked pending Finish requires an explicit review after restoration.

Private review catalog IDs and old measurements are delivered only through authorized server source metadata. Persisted answers/option values/hashes remain compatible; metadata is retained across in-memory clones using per-Draft source context and is never serialized as chef answers.

## Checks before publication
89 regression scripts, TypeScript and lint pass. Independent full API coverage, access migration, client revocation/account switch, and retained source context tests pass. Actual predeployment backup:302 unique stored answer states,31710 entity fingerprints,272 task hashes,575 topic dependencies/statuses and quick review hashes compared to prior HEAD without difference.

Synthetic paired performance (5runs, HTTP60ms, SQL2ms/roundtrip, poll2500ms):80 answers allACK median201.5→223.0ms;30Ready136.6→146.9ms; winning Finish88.7→94.9ms; passive peer publication→received2538.7→2541.9ms. These are controlled synthetic timings, not production latency.

Real ChatGPT login verified on isolated owner-private QA Site with explicitly approved owner identity and synthetic application data. Identity first link retained same preallowed profile and Manager role; service requests with absent or forged identity returned401/403, no private data. No actual production test accounts/answers/settings were changed.

## Deployment stages / rollback
First publish the guarded code and additive migration under the existing custom Sites audience. The UI honestly indicates that Sites invitations remain required. Final public login shell requires explicit owner approval; then set TEAM_ACCESS_MODE=application using native runtime configuration and apply the supported public audience, retaining ownership/editors. Public reachability is not application access: only allowlisted verified accounts receive private data.

On rollback, first restore restricted entry for currently legitimately allowed accounts. Never run old unguarded code under public audience, restore an old DB, erase pending queues, or silently resurrect disabled profiles.

## Limits
Already downloaded/displayed data cannot be remotely erased. User must sign in with the exact allowed ChatGPT email. Legacy active stock restrictions remain separate. Existing Chef devices need a small pilot after publication; tests do not fabricate production shifts. Deployment/version/after-backup and browser evidence are maintained outside the published project in team-access-jednoduse-release-2026-10-04.
