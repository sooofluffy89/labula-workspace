# Manager role — 29 September 2026

## Policy

Ownership stays bound to the existing `kitchen_owner.user_id`. `owner()` and response `isOwner` retain their original meaning. `canManage()` separately admits that owner and active `kitchen_team` rows with `access_role=manager` and the authenticated stable user ID. No client email or special account exception grants authority.

| Area | Owner | Manager | Existing legacy | Cook |
|---|---|---|---|---|
| Recipes, catalog read, prep profiles, ordinary review | Existing full access | Full | Preserved | Denied |
| Catalog aliases, classification, merges | Full | Full | Denied | Denied |
| Review verification, approval, explicit application | Full | Full | Denied | Denied |
| Groups, rounds, instructions, service feedback history | Full | Full | Existing limited access | Service feedback only |
| Evening check / Morning prep | Full | Full | Preserved | Preserved |
| History, analytics, calendar, CSV, complete backup | Full | Full | Existing limited access | Existing operational details |
| Other non-owner profiles and roles | Full | Full | Denied | Denied |
| Owner role / deactivation | Protected | Protected | Denied | Denied |
| Own Manager role / activation | Owner controls | Denied | — | — |
| Sites audience, hosting, deployment, ownership transfer | Unchanged external controls | No new permissions | Unchanged | Unchanged |

## Data and compatibility

No migration or automatic role change. The existing text role column stores `manager`; existing `legacy` values remain intact. New profiles still start as Cook. Name/status commands never write the role column. Role commands have a dedicated strict schema, original operation ID, revision precondition, explicit confirmation and account-scoped durable recovery.

Role receipt, audit and target update commit atomically. The receipt rechecks the current actor capability and protected target rules. The audit stores actor ID/email/name, target ID/email/stable user ID, timestamp, old/new role and revision. Exact retry returns the original receipt, including after another update; stale old-client edits cannot replace a new role. Owner and Manager self-protection are enforced server-side, independent of hidden buttons.

Manager access is checked anew on requests. A paused Manager cannot use workspace APIs; operations retain their existing active-member guards. A demoted Cook is blocked from workspace APIs. Denied/recovered commands remain in their originating account's local storage. No drafts are moved between users. Ordinary operational identity checks and fast-sync query count remain unchanged.

`canManage` accompanies factual `isOwner` in relevant API responses. Clients fall back to `isOwner` only for older responses. An already open older client needs refresh to reveal new Manager controls; server permissions apply without waiting for reload.

Review confirmation remains separate from verification, explicit approval, and explicit application. Role assignment does not approve content or alter recipes. Existing legacy `owner` workflow/topic labels and manual-source classifications remain compatibility labels; immutable action actor fields identify the actual Manager.

## Verification

- `check-manager-access.mjs`: actual routes + transactional SQLite; separate identity/ownership, admin reads, catalog/instruction writes, explicit role grants, atomic revocation, owner/self protection, legacy edits, CAS, concurrent changes, old-client edits, double-click, lost ACK, account switch and durable retry.
- `check-manager-review.mjs`: full existing review workflow under Manager identity; verification, approval, separate application, injected rollback, three-way preservation, exact replay and Manager authorship.
- All existing regression scripts retained, including Cook access, fast sync, notebook/prep transitions, backup and Team recovery.
- Browser synthetic owner changed a Cook role through confirmation. Synthetic Manager then saw admin navigation, could create another Cook profile, edit a prep instruction with own authorship, and open the role confirmation for another profile. Own role selector disabled and owner edit blocked. Keyboard Enter, cancel and narrow mobile layout checked.
- Browser data lives only in `/private/tmp/labula-prep-notes-qa`, with synthetic auth confined to that separate copy. Production auth code is unchanged.

## Release procedure

Validate a fresh complete 33-table private backup; preserve the existing Sites custom audience. Publish to the existing project. Then change only the requested existing linked account through Team's audited role operation, and compare a second complete backup. No production recipe, check, Ready, Track, round, instruction, review or content approval is part of this release.

Private backup, screenshots, test logs and deployment receipt are stored outside the published checkout in `../manager-release-2026-09-29/`. A real Manager login is not impersonated; synthetic permission verification is distinct from the person's next sign-in.
