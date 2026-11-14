# 3DA

**Drive any city.** (Working title was *Drive it 3D*.) A small top-down driving game on the real 3D map of any place on Earth:
the streets, buildings, water and hills come from the same map squares as
[Your Place](https://github.com/yourplace3d/3d-city).

## How it plays

- The first time you play, a short tour walks you through it: get in, pick up, deliver, and what the
  police are about. It moves on as you do each thing, and can be skipped.
- You start on foot beside a parked car. Walk up to any car and get in: parked ones are free, taking one
  with a driver in it is an offence.
- **Blue rings** are packages. Drive through one and a **yellow ring** appears somewhere a few hundred
  metres away: get there before the clock runs out for cash, with a bonus for time left. Jobs pay more
  the more you have delivered.
- **Three deliveries make a run.** Each drop-off is a little farther and the clock a little tighter than
  the one before. What the three earn, less any fines, is the score; it goes on a scoreboard, with your
  name if you care to write one. The board is kept in the browser, so it is the board of one device.
- **The place is announced** across the screen as the game starts there; for a link with nothing but
  coordinates the game asks the place search which town it is (the point rounded to about 100 m).
- **Challenge a friend.** After a run, a button makes a link to it. Whoever opens the link starts where you
  started and plays the same three packages and drop-offs, with your name, score and time to beat, and can
  send their own run back. Traffic and police are not the same twice. The link holds everything, so
  there is no server; it also means the score in a link is only as honest as its sender.
- **Heat.** Knocking people over, taking someone's car and ramming traffic or the police raise it (up to
  four badges). More heat brings more police cars. Stay out of their sight and it cools off; stop next to
  one and you're caught and fined.
- An arrow at the edge of the screen points to the drop-off (yellow), or to the nearest package (blue).
- **The little map** in the corner shows the streets around you, north up, with the way to the next ring
  drawn in, the rings, the subway entrances, and the police while they're after you. Tap it, or press `M`, for
  a big map of all the loaded streets (1.5 km across); the game waits while it is open. Press `G`, or the
  button on the big map, to also draw the way as a line on the road; the game remembers the choice.
- Cars dent: below a third they smoke and slow down, at zero they're wrecked. The water's edge stops you;
  a stream or ditch lets a car through, slowly and with spray.
  The car you left has a white ring around it.
- **Public transport, from the map.** Trams run on the real tram tracks and buses on the bigger streets, and
  both wait at the real stops (red dots for trams, green for buses). Trains run on the railway tracks; they have no stations yet. You can take a bus; trams stay on their rails. A blue disc is
  a subway entrance: walk in on foot and you come up at the station nearest to where you're headed.
- Where the map says so, traffic keeps left (Britain, Japan, Australia, India, parts of Africa: rough boxes).
- **Thin places.** Where OpenStreetMap has few buildings or streets, the start screen says so, links to the
  place on OpenStreetMap and to how to add to it, and lets you play anyway.
- The map loads one 1.5 km square at a time on a fixed grid, and the next square loads as you near the
  edge, so you can keep driving.

| | Keys | Touch |
| --- | --- | --- |
| Walk, drive | `W` `A` `S` `D` or arrows | drag on the left of the screen, towards where you want to go |
| In and out of cars | `E` | **In / out** |
| Brake, reverse | `S` | **Brake** |
| Handbrake | `Space` | |
| Big map of the loaded streets | `M` | tap the little map |
| Route line on the road | `G` | the button on the big map |
| Back onto the road when stuck | `R` | |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (relative paths, host it anywhere)
```

Add a place to the link to start there: `#52.5163,13.3777`, or a name: `#Hamburg`, `#Freiburg_im_Breisgau`.

**How a device copes.** Add `?fps` before the place (`…/?fps#Hamburg`) for a readout at the top: frames a
second, the slowest frame, the size the picture is drawn at, and how much is drawn. It stays on until
`?fps=off`. When frames drop below 48 a second the game draws a coarser picture, a step at a time, and goes
back to the full one when there is room (`Game.tune`).

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
- `src/challenge.ts`: a run as a link (`?c=…`): the places of its deliveries and the score to beat.
- `src/game/input.ts`, `src/main.ts`: keys and touch, the start screen and the numbers on screen.
- `src/geo/`, `src/scene/`, `src/export/`, `src/data/`: the 3D engine, copied from Walk it 3D / Your Place
  (MIT). Changed here: the tile cache's name only.

Heights of tall buildings are squashed (above 18 m only 30 % counts) so the camera can stay close.
There are no traffic lights, level-crossing barriers or one-way streets, and bus and tram lines are not the real routes: vehicles follow
the streets and tracks and mostly carry straight on. Buildings that
stand over a street (gateways, passages) aren't walls.

`game.auto = true` in the browser console makes the game drive the jobs itself: for tests and for filming.

## Tools

- `tools/selfdrive-test.mjs`: the game drives itself for eight game-minutes per place and reports deliveries
  and mishaps. A quick check after changes to roads, traffic or collisions.
- `tools/film.mjs`: films a scene frame by frame at 1080p for trailers.
- `tools/intro.mjs`, `tools/intro-still.mjs`, `tools/intro-cut.mjs`: the "guess the city" intro. The first films the tutorial steps in one place and the rise over the city, the second takes the square picture of the city from above, the third cuts both in the trailer's look (neon opener, pixel titles, the city as a tilted slab). The pixel font (Press Start 2P, OFL) is passed in as a file. `tools/intro-sound.py` writes its sound: a synthwave bed with hits on the cuts.

Both need Playwright (`npm i -D playwright && npx playwright install chromium`) and a preview server
(`npm run build && npx vite preview --port 4173`). `HANDOFF.md` has the project's state and history.

## Brand

`brand/` holds the wordmark, the app icons and the social card as SVG, with the PNGs made from them. The A is a
road running to the horizon. Colours: asphalt `#1c1f24` and `#565b63`, road yellow `#ffd400`, paper `#f4f1ea`,
kerb `#bdb7a8`; in the game, blue `#2bd4e0` is a package and red `#ff5a4d` is the police.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), vector tiles by
[OpenFreeMap](https://openfreemap.org). Terrain: Mapzen Terrain Tiles on AWS Open Data. Place search:
[Photon](https://photon.komoot.io) by komoot, with [Nominatim](https://nominatim.openstreetmap.org) as a fallback;
sixty big cities are built in and need no search at all. Built on the Your Place 3D engine (MIT, see LICENSE).
