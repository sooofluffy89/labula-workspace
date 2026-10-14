# Preparation dashboards, existing answers only

Adds a read-only starting view with four dashboards: preparation routine, storage and batches, hands-on time/repeated work, and reported service risks. Uses the confirmed notebook snapshot, direct active-menu use (variants count once), current batch estimates, storage setups and reported problems. Existing recipe entry and recovery workflows remain available.

Scope and limits:
- No inventory, daily production log, task assignment or new questionnaire is introduced. No database/schema changes.
- Explicit Manifesto mentions in item notes/method/specification conservatively hold that item's batch quantities, frequency and time aside. Other items are not asserted to have location-verified estimates. Menu activation and shared catalog data are not changed.
- Day, week, service and single-batch time comparisons stay separate; no total across potentially overlapping processes, no invented service counts, portion conversions or savings claim.
- A known fortnight-vs-week discrepancy is detected from the source note and excluded from period calculations. Free text is not a general automated conflict detector.
- Custom units are displayed verbatim, without multiplication or litre/weight conversion. Missing answers remain unknown.
- Storage records retain their own state, packaging, temperature, quality clock and evidence source. Quality estimates are not represented as verified safety limits or permission for larger batches.
- The next-form information is explanatory only. All dashboard interactions are read-only; no recipe/preparation mutations are possible from a dashboard.

Validation:
- All 28 regression scripts passed, including new projection tests on synthetic fixtures and a private snapshot outside the checkout (revision 317).
- Root autosave/preparation-transition tests retain the real notebook hook; the added presentation-only child is stubbed consistently with other read-only children.
- TypeScript, targeted lint and production build passed. Final presentation changes rechecked with the root integration test and build.
- Browser checks on an isolated read-only local proxy using a copy of current answers: four tabs, frozen filter, daily/weekly ranking, unknown values, search/empty state, item detail and Escape, bought ingredient filtering; desktop, 390px and 320px. No horizontal page overflow at 320px. No production test data writes.
- Pre-deploy export and access metadata retained outside the checkout. Existing owner/chef private sharing is preserved.

Future work: Labula-only scope confirmation, normalised units, usable stock, demand target, production deadlines/lead time, assignments, actual output and exception events. These are intentionally deferred to the next agreed form.
