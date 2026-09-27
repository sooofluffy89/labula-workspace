# Prep instructions and chef feedback — implementation map

Baseline: v50, 1a5731cd8217229eb59cc6b264a3ffe4a2055a41; custom audience revision 4.

- Owner guidance: independent revisioned instruction records and immutable versions; owner-only command and editor in ingredient detail.
- Check provenance: nullable recorded instruction in answers/tasks, captured transactionally on start/add/remap and copied on confirmation; old records stay unknown.
- Service feedback: append-only comments and idempotent receipts, check/item/catalog/instruction context, server actor/time; operational reads for Cook, paged owner ingredient history.
- Calm lists: optional two-line instruction, comments indicator, optional composer in existing evening options and morning detail; no extra checkbox action.
- Recovery: account-scoped durable comment queue and drafts, independent of answer/Ready queue; Finish drains accepted comments; shared status remains truthful.
- Sync: existing incremental cursor publishes comment counts; no per-row GET or new transport. Detail history loads on demand.
- Integrity: additive migration + complete backup inventory; no notebook, Track, rounds, audience or existing answer edits.
- Evidence: real route/SQLite + controller tests, existing dynamic regression runner, type/lint/build, isolated browser and measurements against baseline, pre/post production backup.

Release evidence is stored outside the publish checkout in `../pokyny-feedback-release-2026-09-27/`.
