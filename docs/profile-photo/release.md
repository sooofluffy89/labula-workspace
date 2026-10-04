# Own profile and private photo

## Scope
Shared top-right own profile for Cook, Manager and Owner, plus authorised review/archive/backup pages. Server-derived kitchen name, email and role; explicit My profile and existing ChatGPT sign-out. Neutral hydration placeholder, initials and independently loaded private image. No photo required and no per-answer/Ready request or polling.

JPEG/PNG/WebP input up to 10 MiB, 20 million pixels and 8192 per side. Native chooser, EXIF orientation, keyboard-operable square crop, explicit Save, discard preview and confirmed Remove. Server independently fully decodes and re-encodes bounded 256×256 PNG with CRC/scanline/filter validation; originals and metadata are not stored. HEIC and animation are rejected clearly.

## Storage, access and recovery
Private Sites R2 BUCKET, existing D1 DB. Additive schema-only migration 0019 adds own photo pointer/revision, original command receipts and upload reservations. Identity comes exclusively from trusted access context. Independent photo revisions never change team revisions. Existing membership, active profile, origin and transactional revocation guards protect all writes. Own image responses are private/no-store/nosniff; arbitrary user/key lookup is rejected.

Canonical immutable R2 bytes precede the guarded atomic D1 pointer/receipt commit. Same command ID and fingerprint can be retried after uncertain failure; receipt-first client verification avoids replaying a committed change. Two tabs use CAS and monotonic accepted revisions. Recovery is one account-bound device key per operation, preventing one tab from removing another tab’s request. Access loss and account unmount clear image URLs and refuse late state.

Expired failed reservations and conflicting retired uploads have bounded best-effort cleanup. Previously committed image versions are retained privately to support consistent in-flight snapshot backups. Automatic deletion of historical committed versions is intentionally not scheduled; a future retention policy must coordinate with backup readers. Expired failed work for a revoked user may remain private until that original user regains access and performs a photo operation. No discarded object is published as a profile pointer.

## Sign-out
Existing operational outboxes stay bound to original identity. A warning distinguishes device-only work from shared work. Registered notebook/review drafts are copied with read-back verification before explicit sign-out; downloaded notebook drafts use the existing explicit Restore notebook draft flow. Volatile text blocks sign-out with a clear return-to-editor action. Copies are never automatically submitted or applied. Existing controllers stay mounted and their write/sync protocol is unchanged.

## Backup
Complete export inventory is 40 tables. Atomic D1 snapshot streams JSON one row at a time, followed by one referenced bounded image at a time, with account/revision/object/hash/size/actual base64 bytes. Missing or altered images fail the export. Client validates actual SHA256. Previous complete backups remain readable. Retained immutable objects make concurrent photo replacement/removal consistent with the captured snapshot.

## Verification
92 regression scripts, including actual profile API + real SQLite schema/guarded writes + private bucket failure harness and actual ProfileProvider hook harness. Roles, forged identity/key/origin, anonymous/unlisted/paused/revoked access, R2/metadata failures, timeout/lost receipt, stale replies, CAS race, checksum/missing object/legacy backup, account-bound sign-out recovery and two pending tab commands are covered. Existing application access tests cover switched accounts and stable original operational queues.

Isolated Worker/D1/R2 browser QA uses only synthetic users and images. Cook and Manager/Owner, native JPEG EXIF6 and PNG/WebP previews, keyboard crop, broken file, cancel/remove confirmation, reload, same-account tabs, actual Ready while opening profile, authorised standalone backup, public sign-out page, keyboard focus, desktop and 320/390/430 px without horizontal overflow; reduced-motion reports animation none / transition 0s. A responsive emulator temporarily required native accessibility interaction after its CDP mouse dispatch failed. No real operational answers or photos were changed. Physical iOS/Android devices have not been tested.

Three-run real controller/API/SQLite comparison with synthetic HTTP 60 ms and SQL trip 2 ms: 80 answers + Finish remain 8 requests / 31 SQL trips / 133102 bytes; 30 Ready remain 3 requests / 12 SQL trips / 35411 bytes. Median Finish summary 439.09→436.35 ms; 30 Ready last tap→receipts 186.43→190.26 ms, ordinary timing variation. These are not production latency guarantees. Profile adds one initial own-profile GET, and an image GET only when a photo exists; changes/pageshow/cross-tab notifications can revalidate independently.
