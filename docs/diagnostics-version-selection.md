# Temporary compatible diagnostics application

This application selects the exact currently live v84 source tree
`93eab5d471c3af35de72a2b2278b96c66d788ad6`, with additive Owner-only read-only
database diagnostics. It preserves Site identity, audience, DB/R2 bindings and
the v84 product UI/client protocol. The native source history retains the newer
maintenance source `e9770e024d160f6db429da34f5a20e6d44d9dc08`; no force push is used.

The selected v84 migrations 0000–0020, snapshots and journal are byte-identical
to the live source. No newer migration is supplied for execution by this
temporary application version. This is compatible application-version selection
before Workspace 2.0 writes, not database or schema rollback. Existing added
schema objects are retained. The newer migration files remain in Git history
and must not be rerun or repaired until their actual database state is known.

`/workspace-diagnostics` and GET `/api/workspace-diagnostics` verify the existing
enabled Owner without linking an account or recording sign-in. The endpoint
reads actual `sqlite_schema` definitions and bounded, discovered migration ledger
rows. It accepts no SQL or query parameters and has no mutation method. Missing,
truncated or protected metadata is reported explicitly. The report is private,
not a complete database backup, migration repair or proof of a write freeze.
