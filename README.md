# Drive it 3D

**Borrow a car in any city.** A small top-down driving game on the real 3D map of any place on Earth:
the streets, buildings, water and hills come from the same map squares as
[Your Place](https://github.com/yourplace3d/3d-city) and [Walk it 3D](https://github.com/yourplace3d/3d-walking-app).

## How it plays

- You start on foot beside a parked car. Walk up to any car and get in: parked ones are free, taking one
  with a driver in it is an offence.
- **Blue rings** are packages. Drive through one and a **yellow ring** appears somewhere a few hundred
  metres away: get there before the clock runs out for cash, with a bonus for time left. Jobs pay more
  the more you have delivered.
- **Heat.** Knocking people over, taking someone's car and ramming traffic or the police raise it (up to
  four badges). More heat brings more police cars. Stay out of their sight and it cools off; stop next to
  one and you're caught and fined.
- A line on the road shows the way to the drop-off (yellow), or to the nearest package (blue).
- Cars dent: below a third they smoke and slow down, at zero they're wrecked. The water's edge stops you.
  The car you left has a white ring around it.
- The map loads one 1.5 km square at a time on a fixed grid, and the next square loads as you near the
  edge, so you can keep driving.

| | Keys | Touch |
| --- | --- | --- |
| Walk, drive | `W` `A` `S` `D` or arrows | drag on the left of the screen, towards where you want to go |
| In and out of cars | `E` | **In / out** |
| Brake, reverse | `S` | **Brake** |
| Handbrake | `Space` | |
| Back onto the road when stuck | `R` | |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (relative paths, host it anywhere)
```

Add a place to the link to start there: `#52.5163,13.3777`.

**Publishing.** `.github/workflows/pages.yml` builds the game and publishes `dist/` to GitHub Pages, but only
when run by hand from the Actions tab: the game is not public yet. One-time setup: **Settings → Pages → Build
and deployment → Source: GitHub Actions**.

**Without outside requests.** `VITE_BAKED_AT="52.5170,13.3889" npx vite build` makes a build that plays in the
nine squares around that point and reads its map from `./map/` beside the page instead of the tile servers:
terrain tiles as `t-{z}-{x}-{y}.png`, vector tiles as base64 text in `v-{z}-{x}-{y}.txt`.

## Code

- `src/game/world.ts`: one square: loads the model, builds the road network, walls and water.
- `src/game/roads.ts`: the road lines as a network that cars and people follow.
- `src/game/solids.ts`: building walls (circles are pushed out of them) and the water raster.
- `src/game/roadMesh.ts`: roads as ribbons on the terrain, sharp from close up.
- `src/game/cars.ts`: the car: how it looks, moves and collides.
- `src/game/game.ts`: you, traffic, people, police, jobs, camera.
- `src/game/input.ts`, `src/main.ts`: keys and touch, the start screen and the numbers on screen.
- `src/geo/`, `src/scene/`, `src/export/`, `src/data/`: the 3D engine, copied from Walk it 3D / Your Place
  (MIT). Changed here: the tile cache's name only.

Heights of tall buildings are squashed (above 18 m only 30 % counts) so the camera can stay close.
Traffic drives on the right everywhere, and there are no traffic lights or one-way streets. Buildings that
stand over a street (gateways, passages) aren't walls.

`game.auto = true` in the browser console makes the game drive the jobs itself: for tests and for filming.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), vector tiles by
[OpenFreeMap](https://openfreemap.org). Terrain: Mapzen Terrain Tiles on AWS Open Data. Place search:
[Photon](https://photon.komoot.io) by komoot. Built on the Your Place 3D engine (MIT, see LICENSE).
