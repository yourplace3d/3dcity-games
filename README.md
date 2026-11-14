# 3DA

**Drive any city.** (Working title was *Drive it 3D*.) A small top-down driving game on the real 3D map of any place on Earth:
the streets, buildings, water and hills come from the same map squares as
[Your Place](https://github.com/yourplace3d/3d-city).

**[Play 3DA →](https://yourplace3d.github.io/3dcity-games/)** · start in a city straight away: [Berlin](https://yourplace3d.github.io/3dcity-games/#Berlin) · [Hamburg](https://yourplace3d.github.io/3dcity-games/#Hamburg) · [New York](https://yourplace3d.github.io/3dcity-games/#New_York) · [Tokyo](https://yourplace3d.github.io/3dcity-games/#Tokyo)

## How it plays

- **Two ways to play, chosen on the start screen** and remembered. *Compare with friends*: a run of three
  deliveries against the clock, to send to a friend to beat. *Do jobs*: the open jobs from the stations in
  town, as many as you like. The pause card switches between them. A run a friend sent is always a run.
- The first time you play, a short tour walks you through it: get in, pick up, deliver, and what the
  police are about. It moves on as you do each thing, and can be skipped.
- You start on foot beside a parked car. Walk up to any car and get in: parked ones are free, taking one
  with a driver in it is an offence.
- **Blue rings** are packages. Drive through one and a **yellow ring** appears somewhere a few hundred
  metres away: get there before the clock runs out for cash, with a bonus for time left. Jobs pay more
  the more you have delivered.
- **Open jobs.** A run stays three plain packages from street corners, so that runs compare. The open jobs
  are their own way to play, and a run's result also leads on to them. A short note says how to find them: a
  blue ring waits at the nearest fuel station, fire station and police station, as often as you go there:
  - **Supply run** (fuel station): a heavy load. The car is slower away, slower to stop and slower uphill.
    It pays a quarter more, and a fifth on top for a car without a new dent.
  - **Rush job** (fire station): a short clock, and every second left over pays three times.
  - **Clean run** (police station): pays 70 % more, but any offence on the way and the job is gone.
  The drop-off is a sight or public place where one lies at a fitting distance, otherwise a street.
- **Where a part of town has no such station on the map, one is made up**, at a spot worked out from its
  position on the earth: the same on every visit and for every player. Its symbol has a dashed ring.
- **Three deliveries make a run.** Each drop-off is a little farther and the clock a little tighter than
  the one before. What the three earn, less any fines, is the score; it goes on a scoreboard, with your
  name if you care to write one. The board is kept in the browser, so it is the board of one device.
- **A place opens seen from above:** about a kilometre of it for a second, then the view comes down to you
  in three and a half seconds, so you see where in the town you are. You can move straight away. When a run ends
  the view rises again behind the result, and comes back down when you drive on.
- **The place is announced** across the screen as the game starts there; for a link with nothing but
  coordinates the game asks the place search which town it is (the point rounded to about 100 m).
- **Roofs in the colours of the place.** Where OpenStreetMap records a building's colour or material it gets
  that colour, toned down. A building with nothing recorded takes the colour of one of its nearest recorded
  neighbours (at least 6 within 400 m; common colours spread, odd ones barely; recorded greens and blues are
  shown but never handed on). With too few nearby, the square's own mix is used, and with nothing recorded the
  plain palette. A building keeps its colour on every visit. Hamburg comes out brick, Freiburg sandstone,
  Paris pale stone; central Barcelona has almost nothing recorded and stays plain (`src/game/localColours.ts`).
- **Sound**, made in the browser with no sound files: an engine that rises with the speed and drops back as it
  shifts up, tyres on a handbrake turn, the siren of police on your tail, a train's horn as one comes near,
  and short notes for a package, a delivery, a finished run, a crash, a fine and a splash. The ♪ button turns
  it off; the choice is remembered (`src/sound.ts`).
- **Well-known sights have their names.** About a hundred in the cities the game knows by heart (the Arc de
  Triomphe, the Brandenburg Gate, Tokyo Tower): the name stands over the sight when it is in the picture, at
  the edge of the screen with the distance when it is within 320 m, and beside a gold star on the big map. The
  list is kept by hand in `src/landmarks.ts`. Where a square has none of those, public places from the map
  are named instead, one of each kind and six at most: town hall, railway station, museum, theatre, library,
  stadium, bus station, ferry terminal, cinema, marketplace, swimming pool, sports centre.
- **Fuel, fire and police stations carry a symbol and no name**, on their roof and on both maps. Shops, restaurants, hotels, schools, hospitals, places of worship, courts and post offices
  are neither named nor marked.
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
  both wait at the real stops (red dots for trams, green for buses). Trains run on the railway tracks and
  brake for nothing but another train: keep off the track. At the end of a track a train or tram waits a moment and goes back the way it came. Trains have no stations yet. You can take a bus; trams stay on their rails. A blue disc is
  a subway entrance: walk in on foot and you come up at the station nearest to where you're headed.
- **Hills show and are felt.** The light treats every slope as about three times steeper than it is, so the
  side of a hill away from the sun is clearly darker. Streets that climb more than 1 in 10 carry arrowheads
  pointing uphill. The car you drive is held back uphill and carried downhill (never so much that a hill
  can't be climbed), and stays put when it stands with your foot off. Stairways are striped strips, and a
  street that stops at one has a round end.
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
| Pause | `P` or `Esc` | **❚❚** at the top |
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
when run by hand from the Actions tab, so that nothing goes live before it has been looked at. One-time setup: **Settings → Pages → Build
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
  (MIT). Changed here: the tile cache's name, and `geo/tiles.ts` also hands on the colours mappers recorded for buildings. It also marks which footpaths are stairways.

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
