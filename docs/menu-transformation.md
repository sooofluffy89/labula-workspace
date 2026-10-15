# Menu transformation — local implementation

This change is local development for **LABULA Worskspace**. It does not publish
or modify the production Site. The application remains in English.

## Working paths

1. **Dish recipes** is a searchable, filterable working list. Add and duplicate
   create drafts off menu. Edit a dish in the side panel; rename it, manage its
   variants, change its category or note, and explicitly enable the dish or a
   variant. Selected dishes can be removed from the menu together. Archive keeps
   identity and recipe references; restoring leaves the dish off menu.
2. The recipe picker searches primary and alternative names, filters by item type
   and adds several existing items at once. Replacement affects the current
   variant. Removal keeps the catalog item and offers Undo. Quantities cannot be
   moved between incompatible base units. Manager permissions apply to measured
   inputs, portions, demand and recipe notes.
3. **Ingredients & prep** contains All, Bought, House-made and Needs review views.
   The detail links purchasing, aliases/type/duplicate tools, stock checks and
   storage. **Production** edits existing catalog inputs and one or more outputs,
   their amounts in each item's base unit, method, hands-on person-minutes,
   unattended time and typical batches per week. A task can prepare a bought
   product without reclassifying it. Drafts survive closing the dialog and can be
   exported/imported for the same account. Current production has a separate CSV
   export; earlier batch answers are explicitly labelled as historical when a
   current task replaces them.
4. Needs review gives concrete reasons. A confirmed ingredient list, catalog/team
   verification and approved production/storage evidence are separate states.
   Comparing duplicates shows composition, direct and nested references,
   production, storage and operational/review information. Retaining a different
   preparation profile and retaining different catalog details require separate
   explicit choices. Unit, cycle and co-occurring measured-input conflicts remain
   blocked. A sole current producer can follow the retained identity; two current
   producers require reconciliation. Declared external use is preserved. Audit
   records retain both original payloads; Undo is conditional on no intervening
   notebook or conflicting stock changes.
5. **Kitchen overview → Menu scenarios** saves named selections of dishes and
   variants, including current drafts and inactive variants. Saving a simulation
   leaves the actual menu alone. Counts follow nested preparation/process
   dependencies and external use. Shared outputs share one task. Weekly estimates
   keep retained batches intact and subtract added work from removed work; missing
   facts remain unknown. Changed source records require recalculation.
6. **Review & apply menu** previews actual variant changes, added/retired
   ingredient candidates, co-products, retained tasks and optional future stock
   changes. Suggestions are withheld when composition or approval evidence is
   incomplete. Unselected stock settings stay unchanged. A new item can explicitly
   open stock setup after creation; its catalog detail also has a persistent
   **Set up stock checks** action for group, station and check frequency.

## Evidence and data that require the kitchen

No production backup, photographs or private export was copied to local tests.
The local browser walkthrough uses synthetic `QA` items and dishes. Historical
menu seed names and IDs remain preserved; counts are computed from current data.

The team must confirm ambiguous names and duplicate identity, including audit
leads such as `eggpant`, `sauce box 1–4`, beef-shank variants and the two children's
menu listings. No culinary meaning is inferred or corrected automatically.
Composition, yields, person-minutes, typical weekly batches, external scope and
storage applicability require actual kitchen evidence. Older “Completed” lists
are migrated as listed/unverified. Unknown values are not converted to zero.

Approved/shared production remains controlled by the existing Review workflow.
The ordinary process editor cannot replace an applied or linked Review source,
including by transferring a protected producer during a merge. Preview and approval
show an exact snapshot of notebook tasks superseded by reviewed production. Apply
checks that snapshot again, archives it in catalog history and rejects newer
changes or a partial shared-output scope. This includes Quick Review outputs. Unreconciled
approved composition suppresses retirement suggestions and savings claims. This
conservative boundary deliberately requires Review rather than treating a new
team-verification checkbox as approval. Per-portion raw-input allocation for a
multi-output task is reported unknown until an allocation basis exists; the menu
simulator still deduplicates its dependency graph and work.

## Persistence and safety

The shared notebook JSON payload is schema version 4. Versions 1–3 migrate
idempotently under the existing notebook revision CAS. Initial menu dish and
variant IDs, old ingredient data and preparation profiles remain intact. No D1
schema change is required and no applied Drizzle migration was edited.

Production tasks are the current source for their outputs; earlier per-item
manufacturing fields remain historical. A server-controlled Review source revision invalidates saved scenarios
even when approved structured facts change without a flat-recipe patch. Existing
review approval provenance is not fabricated. Recovery/export includes dishes, variants, processes and named
scenarios, with explicit conflict handling and fresh IDs for reconstructed
concepts. Old clients are prevented from overwriting the newer schema.

Applying a scenario uses the existing durable catalog operation/retry path.
Notebook, stock, check-round, station and group revisions are checked before one
atomic D1 batch writes the receipt, selected settings, human-readable activity and
menu. Already created Evening checks, confirmed versions and Morning prep rows
remain untouched. Identity, role and matching-origin guards are retained.

## Local preview and verification

Use Node.js 24 (`.nvmrc`) and the committed lockfile. In a fresh environment run
`npm run cloud:setup`; then run `npm run dev` and open
<http://localhost:5173/signin-with-chatgpt?return_to=/>. Development uses the
loopback-only synthetic Seedy identity. Production login behavior is unchanged.

Run `npm run validate` for typecheck, all existing/new regression scripts and the
Sites Worker build. New tests cover dynamic dish lifecycle, ingredient-picker
callbacks and role boundaries, managed draft recovery, production/catalog
editors, current/legacy source precedence, nested and multi-output calculations,
scenario staleness/evidence loss, authority guards and actual SQLite menu/stock
transactions with conflicts, rollback, replay and frozen operational history.

Browser QA covers create/rename/copy, variants, multi-add, removal/Undo,
archive/restore, production editing, save/apply/recalculate of a scenario and
stock setup verified in Manage list. Desktop (1440 px) and mobile (390 px) views
were checked; mobile lists, detail and scenario views do not overflow horizontally.
Enter opens a dish detail, Escape returns focus to its trigger, and filters remain.

Final verification: `npm run validate` passed all 99 regression scripts, typecheck
and the Sites Worker build. The final dashboard authority adjustment also passed
its targeted regression, followed by a fresh typecheck and build. Targeted ESLint
of the new workspaces, source projection and handoff modules is clean.
