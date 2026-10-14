# Shared check rounds — implementation invariants

Baseline: edf5ea603863915748c69d5d18739079473c2a33; deployed v43.

1. Add independent schedule, membership and append-only timeline metadata. Never rewrite notebook payload or stock revision during initialization. Existing tracked items default to Daily only.
2. Derive obligations from effective timeline intervals and explicitly published check versions. Keep original dates, with Prague 04:00 operational boundary. Membership/schedule changes preserve previously due dates; inactive intervals create none.
3. Snapshot each new check atomically behind catalog and planning revision guards. Existing checks, pending commands and published morning tasks remain unchanged.
4. Owner-only rounds editor, grouped filtered selection and explicit review/commit. Stable request receipts; ambiguous retries use original bytes and identity.
5. Synthetic API/domain/browser verification, complete existing regression runner, fresh complete production backups and private access comparison before publishing.

Calendar examples to test: Mon/Thu missed Monday remains due Tuesday; Tuesday confirmation does not cover Thursday; Sunday weekly moved to Friday Monday still owes Sunday; off Tuesday–Saturday creates no obligations during that interval; old Monday draft confirmed Friday covers Monday only; published version remains authoritative while a correction is unconfirmed. No obligations before feature activation. Historical pre-activation checks preserve the legacy daily roster and are explicitly marked as legacy.
