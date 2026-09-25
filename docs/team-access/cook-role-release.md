# Restricted Cook role — 25 September 2026

New profiles created through Add cook profile receive the fixed Cook role. Their application access is limited to Evening check and Morning prep. Existing profiles and the previously invited cook retain existing workspace access, as explicitly requested by the owner. The owner remains unrestricted.

## Enforcement

- Migration 0010 adds `kitchen_team.access_role`, defaulting existing rows to `legacy`. Only explicit new profile creation sets `cook`; role is not editable through profile commands.
- The default server identity guard denies Cook requests to notebook, catalog, stock management, preparation profiles, review, backup, activity and Team mutations. Only Evening/Morning operations and the existing self-profile lookup use the operations scope. Management lookup remains owner-only.
- Cook receives a separate root component containing only Evening check and Morning prep. It does not instantiate notebook loading or notebook WebMCP tools. Direct review and archive page navigation redirects to the operations root. Management links, Activity and Track selection are absent. Empty states direct the cook to the owner.
- Stable account linkage, active-profile enforcement, command replay, actor attribution, check history and local recovery remain unchanged.

## Adding a new cook

Create their Cook profile in Team & access **before** granting their real Sites invitation, using the same email they use for ChatGPT. Sites sharing still controls entry to the private application and is a separate action. Profile creation alone does not send an invitation. Existing invited accounts without a profile retain legacy behavior on automatic self-registration; this is deliberate backward compatibility, not a default restriction for arbitrary Sites invitees.

## Verification

All 48 regression scripts passed. The new Cook suite runs real API handlers against SQLite with all migrations and verifies allowed Evening/Morning writes, denied workspace reads/writes before and after account linkage, preserved legacy access, owner access, paused profiles, anonymous denial, actor history and unchanged notebook data. Existing fixtures now load current migrations.

TypeScript and full ESLint passed. Official Sites publication builds the exact final source. In an isolated local database with synthetic accounts, the owner created a Cook profile, that identity saw only the two operations views, completed an evening check with confirmation and marked its morning task Ready. Direct `/review` navigation returned to the operations root. No real profiles, checks, Track choices or morning tasks were changed.

## Deployment evidence and recovery

Private backups, access-policy comparisons, build output and the exact deployed version are recorded outside the source repository in `/Users/johnny/Documents/LABULA/nasazeni-cook-role-2026-09-25/`. Compare all 21 table contents before and after, allowing only the additive `access_role: legacy` field on existing team rows and separately assessing any legitimate concurrent user changes. Do not restore an old backup over new user work.

Do not roll back to a version without the server role guards after creating restricted Cook profiles: old code would ignore the role and restore broader access. Prefer a forward fix retaining these authorization checks. No Sites audience or authentication configuration change is part of this release.
