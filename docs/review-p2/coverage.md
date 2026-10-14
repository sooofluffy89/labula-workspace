# Review v24 P2 corrections

Scope: six P2 findings from the 2026-09-20 audit. P3 onboarding timing is excluded. Existing interface and English copy are retained.

| Finding | Root cause / implementation surface | Acceptance |
|---|---|---|
| P2-1 contextual help | `guidance.ts`: topic mismatch and last-key-only field matching | Match actual group and nested field definitions, including RUN-04/05/06/08 and STORE-05; retain exclusions. |
| P2-2 confirmation status | `confirmation.ts`, `ux.tsx`: legacy explanation ignores validity | Valid legacy topic never asks for reconfirmation; genuinely invalid contexts remain invalid. |
| P2-3 readable changes | `confirmation.ts`: counts and opaque references | Concrete choices, field labels, stable row changes and honest historical reference fallback. |
| P2-4 return path | `navigation.ts`, `review.tsx`: explanation links use ordinary navigation | Persist a non-linking return frame and preserve latest work through nested visits and reload. |
| P2-5 blocked storage | `guide.tsx`: getter outside protected code | Mount, skip, close and reopen with throwing storage getter/methods; preserve P3 timing. |
| P2-6 repeated recovery | `review.tsx`, local recovery receipt helper | Exact recovery content is suppressed only when its accepted merge is proven saved; keep archive and newer edits. |

All three audit reproductions confirmed their original failures before source changes. Their unchanged outputs are retained outside the repository in `opravy-review-p2-2026-09-20/baseline-*.log`.

## Verification, 2026-09-20

- All 35 regression scripts pass, including new `scripts/check-review-p2.mjs` and extended `scripts/check-review-ui.mjs`. Existing 34 scripts retained.
- TypeScript, ESLint and production Sites/Vinext build pass. No dependencies, database schema, migrations, API authorization or approval/application protocol changed.
- Actual component tests cover valid/invalid legacy confirmation rendering; getter/method/quota/corrupt/SSR guide storage; immutable recovery retries for 401/403/409/422/timeout; acknowledgement of recovered C while D remains dirty; unmount, changed copy in another tab, and receipt isolation by exact bytes/user/campaign.
- Domain tests cover stable row addition/removal/reorder, historical versus current reference names, missing historical context, nested non-linking return after serialization, removed origin fallback, and unrelated changes.

## Browser evidence (local synthetic database only)

- RUN-04/05/06/08 and STORE-05 questions, actual fields, guidance and optional examples inspected. STORE-05 transition branch remains consistent. Excluded sample exposes only RUN-01 identity/scope, with no excluded production guidance.
- Valid legacy Coriander ITEM-01 shows Confirmed/Facts confirmed without reconfirmation text. Invalid legacy Full test run remains Needs reconfirmation with honest historical limitation.
- Actual rendered differences: `Nothing → Wash`; `Raw → Water … · UX test — washed whole`; removed physical stage `Recorded row: Ready → No row`. Unavailable current reference is explicitly described as unavailable.
- RUN-02 → ITEM-01 opens the stable changed field. Editing then returning during autosave preserves the new answer. Nested ITEM-02 → ITEM-01 visit survives reload; two return actions restore ITEM-02 then the exact original RUN-02.
- Desktop and 375 × 812 checked. Document scroll width is 375 at mobile viewport 375. Help dialog is visible, close is accessible, Enter opens, Escape closes and focus returns to Help & examples. Temporary viewport reset.
- Real local server interruption: C enters an uncertain save, D is edited afterwards, tab closes. After server restart, comparison safely replays C and presents D explicitly. Accepting D saves it, retains the original archive (three chunks), and reload removes only this resolved recovery from the offer. One unrelated legacy recovery remains offered, as required. Network/error matrix and exact interleavings above are controlled component tests, not browser network simulations.

## Corrected guidance map

| Topic | Actual fields / meaning | Optional example |
|---|---|---|
| RUN-04 | Packing, filled packs, net content/unit, coverage/remainder; count is not weight | Evidence versus estimate |
| RUN-05 | Input coverage, output coverage, same-run quantity relationship | Evidence versus estimate |
| RUN-06 | Setup, ingredient preparation, attended cooking, portioning, packing, cleanup, other work; unmeasured is not zero | Short contextual explanation |
| RUN-07 | Shared steps; person-minutes at step mode and nested constant-crew intervals/people | Shared outputs; interval-specific explanation |
| RUN-08 | Waiting steps and time until usable, separate from active work | Shared outputs |
| STORE-05 | Actual transitions, original lot, procedure, responsibility and continuing original limits | Short contextual explanation |

## Data boundaries and limitations

Reviewed final diff specifically for recovery proof, latest-state returns and confirmation validity. Inspection/help never changes confirmation baselines. Non-linking return frames carry no answer snapshot. A local recovery intent alone never proves success: the exact original copy is suppressed only when its archived accepted merge is present in the shared saved imports. Originals are not deleted. If local receipt storage fails, preserve the offer rather than hide uncertain work.

49 groups, 25 targeted cases, 57 mapped points, four Manifesto production exclusions and separate owner approval/application remain covered by existing regressions. No production campaign was started and no production answer, confirmation, approval or correction was submitted during verification.

Historical contexts that did not record a name cannot yield an exact old name; the UI says so. Long values are behind the existing expandable value details; more than eight changes show an explicit additional count. P3 onboarding timing deliberately unchanged. Build retains existing non-blocking Vinext future-config/route-classification warnings.
