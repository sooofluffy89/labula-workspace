# Edit items implementation map

Baseline: 78f45d4 source; production v50 verified 29 September 2026; custom audience revision 4. Prep notes migration remains unpublished at baseline.

- Rename and navigation: CheckRounds, per-account/per-round view recovery, first scope this round.
- Filters: preserve six existing dimensions, add confirmed instruction presence; retain editing/pending rows during presence updates.
- Owner text: shared PrepInstructionEditor inline, same controller/draft keys/history as ingredient detail; independent round and instruction commands.
- List loading: owner-only bulk instruction read, latest-request guard, no per-row history request.
- Recovery: local durable draft, server CAS and original retry; storage failure blocks hiding the active edit.
- Evidence: actual routes/controllers and UI handlers, full dynamic regression suite, type/lint/build, synthetic browser flow and responsive screenshots, matched sync benchmark.
- Release: fresh verified full backup, same private audience, new exact source package, post-release data comparison. No operational seed/write on production.
