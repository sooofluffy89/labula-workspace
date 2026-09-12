# Lá Bù Lá kitchen recipe notebook

Private English-language recipe collection app for the restaurant owner and chef.

## Included scope
- 19 menu listings from https://www.labula.cz/menu, captured 2026-09-12.
- 24 starter recipe records, including the explicit menu variants; no ingredients or safety durations invented.
- Shared catalog of bought ingredients and house-made preparations, including nested preparations.
- Composition-first forms: recipes can be marked recorded after listing ingredients, without amounts or portion yields.
- Distinct active menu-dish usage across all variants, including ingredients nested inside preparations.
- Preparation active/passive time, frequency and equipment notes.
- Ingredient quantities, units, batch output, capacity, sales estimates and the per-portion calculator are deferred. Existing numeric data and calculation helpers remain intact for the next phase; new recipe yields stay unknown. The complete JSON export preserves all data, while the CSV focuses on composition.
- Separate quality estimates, reported safety limits, supporting references, cooling, opening and thawing notes.
- Durable D1 storage, automatic saves and optimistic concurrency; conflicts retain local changes for export.
- CSV tables and a complete JSON export. No automatic safety validation or batch recommendation.

## Source caveats retained for the chef
The two children’s listings are not silently merged. The changing Green Market entry repeats another description on the source site. The Xiao Mian source calls a chicken-broth option vegan. These entries are flagged for confirmation, not treated as dietary facts.

## Development
Use Node 22.13+ and the committed npm lockfile. `npm run dev` serves the local preview. The bundled development-only sign-in is `/signin-with-chatgpt?return_to=/`; production uses Sites access control and forwarded identity headers.

`npm run db:generate` generates schema-only Drizzle migrations. Production migrations are applied by Sites. Local D1 must use the generated Worker config with `.wrangler/state` as its persistence directory.

## Validation
- `node scripts/check-model.mjs`: nested yields, deduplicated dish usage, graph integrity, missing quantities, evidence metadata, composition-only completion, numeric-data preservation and safe CSV cells.
- TypeScript no-emit check and Sites production build.
- Local API roundtrip, anonymous denial, origin validation, invalid payload rejection, optimistic concurrency and restoration of test changes.
- No broad browser UI testing requested or performed.
- WebMCP tools are feature-detected and optional. No supported WebMCP validation context was available; their browser contracts are not claimed verified. The ordinary form does not depend on them.

## Access and data
The entire notebook is shared with visitors permitted by the Site access policy. All permitted visitors can fill recipes; no private-per-user split is intended. The access policy must remain private/custom for these internal recipe records. The client never receives source credentials. Server writes require identity and a matching origin; a stale revision is rejected atomically.
