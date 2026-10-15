# Compatible maintenance stage with read-only diagnostics

The temporary v86 diagnostics application selected the previously live v84
source tree `93eab5d471c3af35de72a2b2278b96c66d788ad6` plus Owner-only read-only
diagnostics. Its successful authenticated report established the actual state:
all 121 trigger objects from migration 0023 and migration-ledger entries through
0023 exist; all six schema objects belonging to 0024 and its ledger entry are
absent. The private report is retained outside this repository.

The current source restores the reviewed compatible maintenance stage from
`e9770e024d160f6db429da34f5a20e6d44d9dc08` and retains the additive diagnostics.
The v84 product UI/client protocol, Site identity, audience and DB/R2 bindings
remain. Native source ancestry is retained; no force push or schema rollback is
used. Migrations 0000–0023 and their existing snapshots/journal entries remain
immutable. Only the identified, wholly unapplied 0024 may receive a formatting
repair for the hosting execution boundary; no 0025 migration is introduced.
Existing database data and applied schema objects are not removed or rebuilt.

`/workspace-diagnostics` and GET `/api/workspace-diagnostics` verify the existing
enabled Owner without linking an account or recording sign-in. The endpoint
reads actual `sqlite_schema` definitions and bounded, discovered migration ledger
rows. It accepts no SQL or query parameters and has no mutation method. Missing,
truncated or protected metadata is reported explicitly. Diagnostics remain
available alongside the separate audited Owner maintenance control. The report
is private, not a complete database backup, migration repair or proof of a write
freeze. The real freeze, protected full backup, preservation comparison and
Workspace 2.0 release gates still require verification before writes resume.
