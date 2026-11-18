# Bugfix verification

This pass covers gameplay, input and screens, local/online saves, radio, map loading,
geometry and STL roads. It repairs existing behavior; deployment and database schemas
are unchanged. Tests use isolated browser profiles or in-memory storage, never a player's
real save. Map data © OpenStreetMap contributors.

## Reproduced cases

| Area | Before | Repair and regression coverage |
| --- | --- | --- |
| Navigation | Approaching a delivery on another street could continue past it and double back: a 140 m route drew 220 m of path. | End the path at the actual target. `roads.test.ts`. |
| Navigation | Two points on a curved street always used that street, even with a shorter connecting road (280 m instead of about 122 m). | Compare the direct path with the network distance. `roads.test.ts`. |
| City changes | Old explosion timers, vehicle markers, velocity, smoke and route state survived a new city. | Clear state belonging to the previous world. `game.test.ts`. |
| Map streaming | A neighbouring square requested in the old city could arrive after the new city and replace it. | Discard and dispose outdated loads without changing the new load state. `game.test.ts`. |
| Water | After a square change, recovery used shore coordinates from the old square. | Reproject both the last dry point and an active sinking car's shore. `game.test.ts`. |
| Getting out | Four blocked exit positions still put the player through a wall or into water. | Keep the player seated and explain why. `game.test.ts`. |
| Bridges | Collision placement treated bridges as water, despite driving over them being allowed. | Use the same bridge-aware water rule as movement. `gameSolids.test.ts`. |
| Police sight | Sampling every four metres missed thin walls and short blocked sightlines. | Intersect the actual building edges, including endpoints inside a building. `gameSolids.test.ts`. |
| Input | Held steering, accelerator or touch brake survived menus, lost focus or lost pointer capture; releasing another finger cleared the brake. | End gestures when controls stop and track the braking pointer. `input.test.ts` and browser check. |
| City guessing | Reopening the choices enabled previously excluded wrong names, allowing repeated penalties and preventing the expected three-wrong-pick ending. | Keep excluded names for the round. Browser check. |
| Screen changes | A delayed run result could interrupt a new run, use its course, or stack over pause/map cards. | Save the original result immediately, discard obsolete presentation and wait for an open card to close. Browser check. |
| Search/links | Repeated Enter started overlapping searches; a malformed percent escape in the URL threw during startup. | Lock the lookup while pending and tolerate malformed escapes. `playerSave.test.ts` and browser check. |
| Player/score storage | A string delivery counter corrupted reward arithmetic; incomplete scores displayed invalid times and names. | Read validated values and keep valid entries. `playerSave.test.ts`, `scores.test.ts` and browser check. |
| Home storage | Invalid rows could discard all homes or produce invalid rent. | Validate each row independently and retain valid legacy/compact homes. `homes.test.ts`. |
| Home upgrades | A building repriced below the original flat purchase produced a negative upgrade price and credited cash. | Clamp the remaining price to zero and retain the amount already paid. `homesUi.test.ts`. |
| Online saves | Concurrent uploads could overwrite a newer snapshot; an older response cleared the dirty flag for newer local changes. | Serialize uploads and clear the flag only for the acknowledged content. `cloud.test.ts`. |
| Save deletion | An upload could recreate a deleted save. Changes made during a failed deletion could remain permanently unsent. | Finish uploads before deletion, retain the dirty flag and retry after failure. `cloud.test.ts`. |
| Save imports | A quota error after clearing local storage left a partial imported game and still reported success. | Restore the original game and save identity if the replacement fails. `cloud.test.ts`. |
| Save errors | An oversized snapshot was not marked unsaved; a failed first upload showed the saved-state UI. | Keep pending state and offer the name form with an error and retry. `cloud.test.ts` and browser check. |
| Radio | Late directory responses played after exiting the car, overwrote a newer station list or switched off a newer session; hidden tabs could restart/skip streams. | Check request generation and current car/visibility state before playback. `radio.test.ts`. |
| Vector tiles | Requests near the international date line used negative or out-of-range tile columns. | Wrap request columns while preserving unwrapped local geometry. `engineTiles.test.ts`. |
| Map cache | Refused Cache Storage skipped IndexedDB; blocked IndexedDB opening hung; clearing the fallback targeted the wrong store. | Fall back correctly, bypass blocked opening and clear the active backend. `engineMapCache.test.ts`. |
| Cancellation | Cached tiles were returned even after their request was aborted. | Honor cancellation before and after cache operations. `engineMapCache.test.ts`. |
| Polygons | A hole inside a nested outer ring was assigned to the first enclosing ring. | Choose the smallest containing outer ring. `engineGeometry.test.ts`. |
| Terrain | Deep water touching the mosaic edge was treated as an enclosed bad-data patch and raised. | Fill only enclosed patches. `engineGeometry.test.ts`. |
| STL roads | Clipping a bridge or raised road at the print boundary used a nearby original corner's height, creating the wrong slope. | Interpolate distance along the road at the new clipped vertex. `engineGeometry.test.ts`, including closed-edge and normal checks. |

## Checks

- `npm test`: 59 tests across 14 files, including the original 11 tests.
- `npm run build`: TypeScript checks and Vite production build.
- `git diff --check`: no whitespace errors.
- `node tools/ui-test.mjs`: actual Chromium app, real Berlin map tiles, keyboard and
  form interactions. Search responses and cloud failures are simulated; cloud requests
  are intercepted. The script starts and stops its own Vite server. It also checks for
  uncaught browser exceptions.
- Production self-driving smoke: eight simulated minutes per city. Berlin completed
  3 deliveries with 5 square changes; London 4 with 5 changes; San Francisco 5 with
  9 changes. No uncaught browser exceptions. Random traffic means counts are not
  deterministic pass/fail thresholds.
- Focused regressions were checked against the original code before their fixes.
  A separate original-code run confirmed all four input regressions and nine gameplay
  regressions fail there while control cases still pass.

The GitHub checks workflow runs unit tests and the production build on pushes and PRs.
The existing manual Pages deployment is unchanged.

## Limits

No claim that every bug is found. The independent code reviews covered the remaining
game, rendering, data and export modules without speculative changes. Automated
geometry, cache, save and audio failure cases use synthetic data or test doubles.
Actual Safari/iPad multitouch, perceived audio quality, real device performance,
long sessions and every city are not covered. Cloud writes and deletes were tested
with mocked requests; no live save or database schema was modified. If storage becomes
completely unavailable during both import and rollback, the browser cannot guarantee
restoration, and the import is not reported as successful.

`npm audit` also reports a pre-existing picomatch ReDoS advisory propagated through
the development tooling (five high entries). The installed 4.0.7 is the latest version
the registry returned during this pass; the suggested forced fix downgrades Vite and
Vitest across major versions. Dependencies were left unchanged. This does not establish
that the application or its toolchain is free of other security issues.
