# Team & access: feasibility of automatic Sites sharing

Checked 2026-09-24 against the current Labula source (`322a2ff6159e46d7185c5971b1c6546773bb1d27`), Sites v37, the installed Sites connector and current official Sites documentation.

## Result

The required one-action **Add cook & grant access / Remove access** cannot currently be implemented as a supported, independently running feature of this Site. This is a missing platform integration, not a missing Kitchen Team UI field. Do not ship a button that claims to grant or revoke site access when it only updates `kitchen_team`.

Evidence:

- [Sites documentation](https://learn.chatgpt.com/docs/sites#invite-people-outside-your-workspace) documents owner sharing through the Sites Share controls and through ChatGPT. It documents sign-in with the invited account and the fact that removing a direct invitation may leave group/workspace/public access. It does not document a Sites management API, Worker binding, service credential or OAuth scope by which a hosted Site can manage its own audience.
- The installed Sites connector offers `get_site` and `update_site_access` **to Codex**, not to the deployed Worker. Its current update contract uses a complete `allowed_user_emails` replacement for external visitors; it exposes no expected-revision/compare-and-swap input. The read response has a monotonic `revision`, but a read-then-replace from the app could overwrite an external change made between those calls. The connector may also send an invitation email. These properties prevent treating a copied connector call as a safe server integration.
- The [Sites authentication guidance](https://learn.chatgpt.com/docs/sites) supplies verified visitor identity headers; those identify the visitor and do not grant site-owner administration. The installed `sites-building/references/authentication.md` likewise distinguishes authentication from authorization and says to use Sites access policy controls. No supported admin capability is exposed to the Worker.
- Fresh read-only project inspection returned Sites v37, `custom` access, policy revision 2, owner plus one external viewer, external visitor invites enabled. Hosted runtime environment has no configured values (revision 0). No new account or policy change was made during this check. A server secret could be provisioned, but no documented Sites API/service identity for such a secret has been found.
- `lib/activity-server.ts` shows that `ensureMember()` automatically registers a signed-in visitor, `teamCommand()` manages only the database profile, and `activeMember()` blocks stock/evening/morning writes only. The existing UI explicitly says that adding a profile does not invite anyone and stock pause does not revoke notebook access. Changing its label would not satisfy the requested security semantics.

The absence of a published API is not a claim that OpenAI cannot add one. It means that no supported runtime mechanism was found in the current official documentation, installed capabilities, project configuration or code. A successful Codex connector operation would not prove that the hosted application can repeat it without this task or an owner session.

## Answers to the requested feasibility checks

1. **Runtime read/write:** Unsupported by the available documented Sites runtime. Read/write through the Codex connector is an assistant action outside the deployed app.
2. **Service credential, scope, rotation, invitations:** No supported Sites administration credential/scope/refresh flow is documented for a hosted Worker. External invitations are supported in the owner sharing flow and may send email; their delivery cannot be inferred from a kitchen profile save.
3. **Single-person safe update:** Same-workspace viewer IDs have a connector delta action, but external visitors use complete email allowlist replacement. No exposed conditional revision for that write. The real Labula cook is an external viewer, so the desired safe concurrent update is not established. Existing editors/groups/owner must be preserved.
4. **Verification and old sessions:** The connector can read current policy, but there is no supported in-app call or documented revocation timing for an already open session. Application-side denial could stop its own APIs, but it cannot confirm that Sites' sharing was removed.
5. **Sandbox:** A separate test Site and authorized test account could exercise the Codex connector. It would test an assistant operation, not a callable production backend interface. No real invitations were sent.

## Smallest paths forward

1. **Keep current private Sites hosting:** Maintain one truthful Kitchen Team profile flow and a separate owner action in Sites Share. This preserves the current identity and privacy model, but it cannot satisfy the requested single confirmation. A guided UI could explain the two steps, yet it must label the access state as unverified until the owner checks sharing; it is not the requested release.
2. **Supported Sites administration integration:** If OpenAI publishes a server-side Sites access-management API with a project-scoped service identity, a stable external-visitor grant/revoke operation or revision-guarded changes, read-back and documented session behavior, implement the requested durable coordination then. Verify it against a test Site before touching production.
3. **Alternative hosting/identity:** Move the app and its private data to a provider with a documented server-side user provisioning API and compatible sign-in. This entails a new hosting, identity, data migration and privacy decision; it must not be inferred from the current request. Keep the existing Site private until the owner expressly chooses this path.

No Team & access interface claiming automatic grant/revoke, access migration, audience change or real invitation should be deployed before one of paths 2 or 3 is validated. Existing Site sharing and kitchen records remain unchanged by this feasibility work.
