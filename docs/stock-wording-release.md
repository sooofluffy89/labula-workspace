# Planning labels for the evening check

The evening check selects preparation and restocking tasks for a dated morning plan. `No action needed` selects no task; `For tomorrow` selects a task. Other target dates use `For [date]`. Unchecked stays a separate unanswered state. The arrow is blue rather than an error-coloured cross. Compact rows retain their original touch targets.

Confirmation still creates or updates Morning prep; selecting an answer alone does not confirm a plan. Morning groups explicitly say Prepare and Restock. A confirmed empty plan says No tasks planned, independently of absent plans, unfinished checks and load errors. Ready/Undo and quantity limitations remain unchanged.

History describes the original planning effect (Selected / Not selected for Morning prep), with original dated details, actor and timestamps. It does not claim that a historical Have it guaranteed sufficient stock for service. Automatic catalog effects stay automatic.

Internal `have`, `missing`, `null`, database schema, serialized commands, receipt IDs and CSV columns/raw JSON are unchanged. In exports, `missing` means selected for the morning plan; it is not evidence of a stockout, error or cook performance. There is no data migration or historical rewrite.

Verification: existing 44 regression scripts plus targeted stock wording/date/legacy payload tests, TypeScript, lint, production build and isolated browser checks. Operational data and sharing are verified separately before/after publication; no test stock actions are submitted to production.
