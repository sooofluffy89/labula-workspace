# Functional motion — Evening check → Morning prep

Baseline: v44, a7acf7d50579c80e5057657b2dc8a7872eef7c28. Release date: 2026-09-26.

## Coverage

| Proposal | Implementation and evidence |
|---|---|
| A · Tap response | 120 ms fill/border transition and .97 inner-glyph press; native click/keyboard handlers and 48 px targets retained. No touch/pointer handler writes an answer. |
| B · Saving feedback | Static waiting stripe + accessible waiting/error text; 180 ms fade only from a validated operation receipt. Account, check, item, revision/value and later intents gate eligibility. Explicit discard, polling, reload and historical data never mint receipts. |
| C · Finish guidance | Uses fresh summary, visual group order, expands first relevant group, focuses the answer or catalog-repair button, 260 ms highlight plus static outline. Navigation, account, visibility, subsequent pointer/keyboard intent and unmount cancel scheduled focus. Scrolling is deliberately immediate in both motion modes to avoid a scroll finishing after a later user action. |
| D · Confirmation | Local composition of existing Radix primitives, one 170/120 ms fade for content/overlay, preserved centering, focus trap, Back/Escape and guarded Confirm. Focus returns to Finish or the successful View morning prep button. Confirm receipt gates the local completion pulse; explicit View morning prep has a 150 ms fade. |
| E · Ready/Undo and progress | 120 ms row fill, stable rows/native checkbox, truthful waiting indicator. Thin 180 ms progress bars count all relevant groups; remount keyed to account/check avoids historical 0-to-current animation. Existing morningProgress guards final completion; new settled receipt gates a one-off pulse. |

No API, database schema, saved command format, authorization, role, round schedule, Track, recipe, review or production answer changes. All receipt metadata and pulse timers are memory-only. Visual timers only clear a pulse; no writes, retries, navigation or unlocks depend on animation events.

## Automated verification

Dynamic runner: 51 existing scripts plus `check-stock-motion.mjs` and `check-stock-motion-hooks.mjs` (53 total). New integration exercises the real controller, real API and SQLite: older ACK versus later intent, same-value no-op, lost post-commit reply/exact replay, 401, 409/discard, local quota, other actor/shared revision, account mismatch, dispose/reload recovery, fresh/stale completion, progress/zero. Actual pulse hook lifecycle is exercised with deterministic React-hook scheduling and visual timers.

The existing root preparation integration harness was extended with presentation-only Radix/overlay stubs; its actual notebook saving and preparation transition assertions remain intact. Existing tests cover transaction failure, body timeout, confirmation conflict, plan correction, empty plans, account isolation and concurrent operation IDs.

Final runner, TypeScript, lint and Sites production build results are recorded in the external deployment report.

## Browser verification

Separate checkout `/private/tmp/labula-motion-qa`, separate synthetic D1 database, 10 invented items with grouped long names. Two browser sessions used distinct synthetic Cook/owner identities. All fixture auth, delayed/lost replies, motion observation, CSS media-rule and zoom emulation stay outside the release checkout.

Observed: fast and 4.5-second saves; queued answer toggles and Ready/Undo; lost reply after commit and exact safe retry; shared changes from a second user with zero local saved pulse; collapsed unchecked group expands to the correct answer; invalid catalog type focuses item options; normal and corrected confirmation, Back/Escape, duplicate Confirm, retained Ready on unchanged tasks, proper target morning date and saved completion.

Runtime DOM event observations include actual animation/transition start/end and intermediate computed opacity/transform samples, not only screenshots. `stock-saved` opacity was observed decreasing from .85 to .71 to 0; progress moved through intermediate transform values to the final exact count.

320, 390 and 430 px plus desktop were inspected. Minimum evening answer targets remained 48 px; long names wrapped without horizontal overflow. 200% layout scaling was emulated with CSS zoom in the isolated harness. Reduced motion was emulated by dynamically activating the actual CSS reduced-motion rules: transitions became 0s, highlight/dialog/overlay animation became none, correct focus and modal center remained intact. No device/OS preference was changed. The app currently fixes light color-scheme, so a separate dark theme is not supported or introduced.

## Limits and rollback

No physical iOS/Android device or screen-reader session was available. Native touch cancellation was not physically tested; no touch/pointerdown writes were added, and native activation semantics remain unchanged. Reduced motion and 200% zoom were browser harness emulations, not OS-level/native zoom tests. The in-app test tab crashed after harness hot reload; verification continued in Chrome with persisted synthetic responses intact. This is not evidence of a production app crash.

No migration: a compatible frontend rollback can remove receipt presentation and scoped styles without restoring or modifying any data. Keep the current backend, rounds and Cook protections. Do not restore the pre-release notebook over later kitchen edits.
