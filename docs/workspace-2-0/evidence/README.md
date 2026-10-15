# Synthetic browser verification — Workspace 2.0

All **24 scenarios have a passing final result**. The final evidence includes **48 loaded viewport states**, **7 settled editor widths**, and **9 compiled Worker rendering checks**. Node.js 24 was used. The full source regression/build validation is recorded separately by the implementation report.

`browser-results.json` is the consolidated result. Each scenario names its actual source run in `raw/`. Earlier failures remain in `diagnostics` with their causes and successful rechecks; they are not silently removed. There are no final browser page exceptions. The screenshots are original browser captures, not edited mockups.

## Matching data and measured change

The detached baseline is commit `93eab5d471c3af35de72a2b2278b96c66d788ad6`. Both versions use synthetic local identity `local_seedy` / `seedy@sites.test` and the same notebook: 100 items, 19 dishes and 24 variants, revision 4. JSON data SHA256 is unchanged:

`7930e503a232b5731edacaeb2554cf33447b37d66f34be1e0308a50fcec94343`

Read-only local D1 queries also matched the two Morning tasks, order, Ready state and instruction snapshots. `fixture-comparison.json` records the exact comparison. Synthetic Ready/Undo tests intentionally add activity/revision metadata; new full-flow checks use separate February 2027 dates.

| 390 × 844 CSS px | Before | After |
| --- | ---: | ---: |
| First Morning task top | 562.48 px | **351.09 px** |
| First dish row top | 571.38 px | 560.19 px |

Morning work starts **211.39 px higher (37.58%)**. Its complete first row ends at 458.09 px, safely above navigation at 783 px; both ordinary tasks fit without scrolling. Menu still uses a larger filtering area; its reduction is only 11.19 px and is not presented as an 80% measured layout reduction.

Settled recipe-editor widths are 296 / 366 / 744 / 760 / 760 / 760 / 760 px at viewport widths 320 / 390 / 768 / 1024 / 1100 / 1280 / 1440. Each dialog lies inside the viewport; its scroll width equals its client width, and visible controls lie inside the dialog. These measurements include compiled CSS and explicitly wait for the opening/resize transition to finish.

## What was exercised

- Real local API: URL selection, Back/Forward/Refresh, focus/Tab order, 100-item search and reset, separate browser-tab drafts, Escape/close/reload recovery, ingredient-removal Undo preserving a later field edit, field validation, bulk-station default and intentional Unassign, settings and exports, retained routes, review in the same tab, active history filters, and complete Evening → publish → Morning → Ready → Undo.
- Roles: Owner, Manager, Cook and legacy via local SQLite role changes; Owner restored in `finally` and confirmed through the API. Cook's direct private endpoints/canonical writes are denied. Legacy retains ordinary ingredient/name/storage editing while privileged fields and canonical writes remain denied.
- Explicit response fixtures: deep long-name preparation chain, loading/empty/error reads, calendar change preview, and editor endpoint outage while Today remains available. No fixture is presented as current restaurant data.
- Creation fault: all three notebook PUTs were intercepted with 503. A stable creation intent existed before the first request. Retry and recovery after reload reused the exact operation ID, revision and payload; the form could not discard its pending creation. No shared notebook write occurred.
- Keyboard/accessibility: first Tab reaches Skip to content, Enter moves focus to main; Back restores a row without removing its Tab stop; dialog Escape/Cancel and successful Finish return focus. Computed field boundary contrast is 3.64:1 normal, 6.24:1 invalid, 3.18:1 disabled; focus outline is 6.31:1. Close targets are at least 44 × 44 px. Reduced motion disables the shared dialog animation.
- Emulation: 320, 360, 390, 767, 768, 1023, 1024, 1100, 1119, 1120, 1280 and 1440 CSS px; 390 × 480 short window; touch/coarse pointer at tablet width; 200% equivalent reflow.
- Compiled Worker: Today, Menu detail and recipe editor on local port 5175; direct Correct type entry opened the existing safe nested preview on the selected ingredient with affected recipes, without saving.

Representative captures were visually inspected after measurement: mobile Morning and Menu, desktop Menu, deep long-name detail, field error, and compiled editor. The full 48-state geometry matrix is automated browser verification, not a claim of manual visual review of every state.

## Representative evidence

| View | Before | After |
| --- | --- | --- |
| Morning, mobile | [Before](before-morning-390.png) | [After](after-morning-390.png) |
| Morning, desktop | [Before](before-morning-1440.png) | [After](after-morning-1440.png) |
| Menu, mobile | [Before](before-menu-390.png) | [After](after-menu-390.png) |
| Menu, desktop | [Before](before-menu-1440.png) | [After](after-menu-1440.png) |
| Catalog, mobile | [Before](before-catalog-390.png) | [After](after-catalog-390.png) |
| Evening, mobile | [Before](before-evening-390.png) | [After](after-evening-390.png) |

Additional captures: [deep detail](after-deep-recipe-390.png), [Ready/Undo](after-ready-undo.png), [validation](after-recipe-validation.png), [creation recovery](after-creation-recovery.png), [calendar preview](after-calendar-preview.png), [Correct type preview](after-correct-type-preview.png), [compiled editor at 1100](after-compiled-editor-1100.png).

## Limits

This is Linux headless Chromium verification, not a physical phone/tablet, Safari/Firefox, real mobile keyboard, physical hybrid input or kitchen pilot. The 200% case is a 720 × 422 CSS viewport at deviceScaleFactor 2, representing 1440 × 844 at 200%; native browser zoom and OS text enlargement were not exercised. Faults are deliberately emulated where marked.

Compiled preview used explicit synthetic identity headers on loopback to exercise the built Worker; it is not a production authentication test. No production menu equality, production migration/cutover or deployment is claimed. All database commands used local state; no production data was imported.

## Reproduce

Run the local application with the project's Node.js 24 workflow and a synthetic dataset matching `fixture-summary.json`. `scripts/verify-workspace2-browser.mjs` requires a Playwright module and Chromium binary. Set `PLAYWRIGHT_MODULE`, `UX_CHROMIUM` and `UX_EVIDENCE_DIR`; the default base URL is loopback port 5173. `UX_TEST_PATTERN` selects scenario names. Optional `WORKSPACE2_LOCAL_ROLE_TESTS=1` performs coordinated local role changes and restores the original role. `UX_COMPILED_PREVIEW=1` is only for the local built Worker and explicit synthetic headers; it never targets a remote host.
