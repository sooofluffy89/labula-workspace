# Functional stock motion

Baseline: v44 / a7acf7d. No persistence/API/schema changes.

1. Add transient receipts only after validated command acknowledgements; reuse the existing durable queue.
2. Compose scoped motion, accessible progress and cancellable Finish guidance. Preserve compact rows and native controls.
3. Exercise actual controller/server regressions, isolated browser flows, reduced motion and responsive layouts.
4. Verify complete private backups and audience, publish through Sites, compare all tables and smoke-test by reading.

| Event | Presentation | Data authority |
|---|---|---|
| Accepted click | selected / static waiting marker | existing durable pending intent |
| Valid matching ACK | brief saved marker when no newer intent for this row | matching operation, account, check, item and resulting revision/value |
| Error / rejected / discarded | unconfirmed or shared state, no success pulse | existing recovery workflow |
| Fresh read / polling / mount | current static state | shared snapshot; no local ACK generated |
| Finish incomplete | expand, focus actionable row, highlight | fresh summary |
| Confirm ACK | completed text, one local pulse | successful controller drain |
| Last Ready ACK | completed only if morningProgress permits | fresh, valid tasks; no pending, error or saving |
| Reduced motion | same state and focus without moving effects | unchanged |

Visual timers only clear presentation. They never save, retry, navigate or unlock controls.
