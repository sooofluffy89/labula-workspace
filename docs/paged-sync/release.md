# P1: consistent paged verification

Baseline: Sites v71, source `8091640d31f36f89e6fee73a9f5bff922095a840`.

## Invariant

A terminal delta can verify a selected check or morning plan only when every event through the transaction's current metadata boundary has been consumed. Its header, changed rows and terminal cursor are read in the same D1 batch. Reaching an older captured boundary is insufficient. A write ACK never advances the read cursor or verifies the whole plan. Subsequent writes remain possible; Confirm's existing transaction and revision CAS still protect publication after verification.

## Changes

- Server distinguishes another page inside the captured horizon from commits beyond that horizon. Either keeps `more=true`. At the old horizon, the cursor retains the consumed boundary and captures a new horizon on the next request. Unmodified v71 clients therefore continue before accepting a terminal page.
- A non-reset terminal reply carries additive `verifiedThrough`. The client checks account, selection, cursor version, terminal horizon and consumed sequence against this proof. A missing or inconsistent proof uses one consistent full read, making a new client safe with a v71 server.
- Partial pages merge incremental data but set `needsVerification=true`; they do not stamp `lastVerifiedAt` or clear freshness errors. Terminal verification can clear the flag only when no local intent or pending write appeared during the read. Existing account, scope, read and sync epochs reject late responses.
- Morning displays `Checking shared status…` while whole-plan verification remains outstanding. Local Ready/Undo persistence and immediate counts remain unchanged.

The existing limit of 100 sync pages bounds a catch-up attempt. Continuous traffic preserves the consumed cursor and reports that more changes need refreshing. Retry continues from that cursor after traffic settles. There is no new transport, migration, dependency, per-tap full read or kitchen-wide lock.

Finish fingerprints, original command IDs and payloads, actor identity, journals, dependencies, exact receipt replay, CAS, atomic publication, safe-close conditions, authorization guards and legacy writes are unchanged. Peer content changes require a new explicit approval; ACKs of previously approved local dependencies do not.

## Validation

Both original audit reproductions were rerun against v71 and demonstrated the failures. `check-paged-sync.mjs` exercises real controller/API/SQLite transactions with request-local AsyncLocalStorage identities. Scenarios cover both P1 impacts, unrelated checks in the shared cursor, repeated writes during all 100 pages, own pending dependencies, post-verification CAS, missing/mismatched proof, failed fallback and retry, authorization rejection, stale scope/disposal, structural reset, legacy transport, three actors and simultaneous Finish. An optional archived v71 bundle verifies old-client/new-server and new-client/old-server for both impacts.

The existing fast-sync 5,000-event test now expects consumption of a peer commit beyond the initial horizon, rather than accepting an old terminal boundary. All other assertions remain. The full runner passed 93 scripts; TypeScript, lint and production build passed. The final additional mixed-check regression is checked separately after the full run because only its test file changed.

Separate browser QA used three synthetic Cook identities, desktop and actual emulated widths 320/390/430 px. It verified changed-summary reapproval, shared Ready, slow verification without all-ready, peer Undo, offline local work, reload and retry. Exact inter-page scheduling is established by real controller/API regressions, not claimed as a physical-phone browser reproduction.

## Measured impact

Five repetitions per main scenario; actual local SQLite/API/controllers with synthetic 60 ms HTTP and 2 ms SQL round-trip delays. These are controlled local timings, not production latency or a promised speedup.

| Scenario | v71 median (range), ms | Fixed median (range), ms | Requests before → after |
|---|---:|---:|---:|
| Finish, answers already stored | 187 (172–212) | 182 (172–208) | 3 → 3 |
| Finish with 80 queued answers | 619 (602–662) | 616 (596–643) | 8 → 8 |
| Last Ready through complete verification | 159 (151–162) | 152 (148–155) | 2 → 2 |
| Paged verification plus peer change | 248 (217–260), wrong terminal content | 323 (319–335), peer change received | 2 → 3 |

No extra full reads in these fixed-server scenarios. The additive terminal proof costs 21–22 JSON bytes in the measured normal cases. The paged peer scenario transfers 38,907 → 39,839 bytes. The third GET performs work missing from the old result.

Normal local acceptance remains around 1 ms. Server acknowledgement of 80 answers measured median350 →346 ms; 30 Ready194 →203 ms. With a controlled 2.5 s polling interval, commit-to-peer medians were publication2541 →2541 ms and Ready2371 →2360 ms. Small local differences are measurement variation, not evidence of production speedup. Raw logs and five-run distributions are in the external release folder.

## Data and rollout

Complete private backups are checked against `privateBackupTables`, table counts, current access metadata and photo references. All backups, synthetic fixtures, screenshots and archived bundles remain outside the project and deployment package. Preserve the existing Sites audience, application allowlist and roles. Production verification is read-only; compare post-deployment exports without restoring over intervening kitchen work.

Do not roll back blindly to v71: its server reintroduces P1 for open clients. If a later release fails, repair forward or retain this server horizon fix. A new client falls back to a consistent full read on an older server, but unmodified old clients still require the repaired server. Preserve all browser outboxes/journals and immutable command IDs; do not clear storage or restore older production data.

## Known out-of-scope findings

P2: Morning layout on a new confirmed version can bypass a held-pointer delay; conflict Return to Unchecked lacks immediate explanation; keyboard focus can leave a hidden checkbox. P3: full reads scan historical rosters. The historical woodear correction remains a manager decision. This release fixes P1, not those findings.
