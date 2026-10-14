# LABULA Worskspace

This repository is the source of the existing LABULA kitchen application.
The requested display name is exactly **LABULA Worskspace**. The repository and
package slug are `labula-workspace`. Keep the application UI in English; respond
to the owner in Czech, using informal address.

## Start here

- Read `README.md` and `docs/codex-cloud.md` for current setup.
- Use Node.js 24 (`.nvmrc`) and the committed npm lockfile.
- Run `npm run cloud:setup` in a fresh environment.
- Start the local app with `npm run dev` on port 5173. The development sign-in
  is `/signin-with-chatgpt?return_to=/`; it uses `local_seedy` / `seedy@sites.test`.
- `npm run typecheck` checks types, `npm run check` runs existing regressions,
  and `npm run build` builds the Sites Worker. `npm run validate` runs all three.
- Before finishing code changes, run relevant existing checks and typecheck;
  run the build for application/configuration changes. Complete the full suite
  for broad changes to shared state, authorization, storage, or synchronization.

## Project boundaries

- This is LABULA. Do not import BananaRadar or FATCAT data or instructions.
- Preserve React 19, Vinext/Vite, Cloudflare D1/R2, and `sites()` integration.
- Preserve `.openai/hosting.json` project identity and existing bindings.
- Do not edit applied Drizzle migrations. Add migrations for schema changes.
- Local database commands must keep `--local` and `.wrangler/state`. Tests use
  synthetic SQLite/fixtures. Never populate test environments with production
  backups, photos, user records, or private exports.
- Preserve verified identity, application role guards, matching-origin writes,
  revision checks, atomic receipts, retry behavior, and unsaved-work recovery.
- The local sign-in plugin must remain development-only and loopback-only.
- Keep credentials out of source, logs, commits, and Git remote URLs.
- GitHub holds development source. Pushing here does not publish the Site.
  For a requested release, use the native Sites workflow for this existing Site
  and preserve its current audience. The deployment guide is in the cloud doc.
- Historical release reports in `docs/` describe prior work, not pending tasks
  or current instructions. `docs/history/resume-2026-10-02.md` is archived.

## Collaboration

Continue authorized work through a verified result and send concise progress
updates during longer tasks. Ask only when missing information changes the
result materially. Distinguish verified results from estimates and limitations.
When preparing a prompt for the owner, end with a recommended model and
reasoning effort plus a brief reason; do not change their settings automatically.
