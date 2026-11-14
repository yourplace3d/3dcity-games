# Handoff: 3DA, from the cloud session to a local one

Written 12 November 2026 for a Claude Code session running on the owner's Mac. Everything the cloud session
knew that isn't obvious from the code is here. Read `README.md` first for what the game is and where the code
lives.

## Where things stand

- **The game is live** at https://yourplace3d.github.io/3dcity-games/ (public repo, GitHub Pages).
  Any city: search box, city buttons, or a link such as `…/#Hamburg` or `…/#52.5163,13.3777`.
- **Always ask the owner before deploying.** Push freely; publish to the live site only after the owner has
  seen what changed and said yes. This is their standing rule (12 November 2026).
- **Deploys are by hand.** `.github/workflows/pages.yml` runs only from the Actions tab ("Run workflow") or
  through the GitHub API. Pushing to `main` publishes nothing. The owner may want this switched to deploy on
  every push; ask before changing it.
- **The owner has played it** on an iPad and on the Mac, in Berlin, New York and Nuremberg, and likes it.
  They have not yet tried the countryside.
- **Name:** 3DA (working title was "Drive it 3D"). Wordmark, icons and social card are in `brand/`; the brand
  sheet with colours, type and voice is a private Claude artifact the owner has.
- An older copy of the game sits in a private scratch repository of the owner's. It is stale; this repo is
  the one to work in.

## First job for the local session

The owner recorded three play sessions on the Mac: Berlin, then New York, then Nuremberg. They are in a folder
called `3DA` on the desktop (`~/Desktop/3DA`) and were too large to send to the cloud session.

1. **Look through the recordings for bugs.** A way that worked before: pull frames with ffmpeg and read them as
   images, for example one frame a second as a contact sheet:
   `ffmpeg -i clip.mov -vf "fps=1,scale=480:-2,tile=5x4" sheet-%02d.jpg`
   Earlier recordings showed bugs that scripted tests had missed (a target behind a building passage, the
   player driving away from a target they couldn't see), so watch what the player is trying to do and where
   the game gets in the way.
2. **The owner mentioned lag** and thinks the screen recording caused it. If the clips stutter in a way the
   recorder wouldn't explain, measure: frame time in the browser's performance panel, with and without recording.
3. **A new teaser** is to be cut from these recordings, replacing the earlier one. The owner cuts video in
   their own tool; they asked for clips and a director's prompt, not a finished edit. Ask what they need.

## What the owner has asked for, and decided

- **The arrow alone shows the way.** A line on the road existed and was turned off after the owner's first
  real play ("that's pretty much how it worked" in the game that inspired this). It is still in the code:
  `game.showRoute = true`.
- **Bus stops are green**, because yellow read as a delivery target. Tram stops red, subway entrances blue.
- **The owner asked what the blue dots are.** They are subway entrances. Nothing on screen says so until you
  stand on one. A label or a first-time hint was offered and not yet answered.
- **Thin places get a warning** on the start screen, with links to OpenStreetMap and its beginners' guide, and
  a "Play here anyway" button. The owner asked for exactly this wording idea: you can play, but we recommend
  adding map material first, here is how, or play a recommended city.
- **Public transport came first among the data ideas**, without real schedules: "the lines might be set up as
  normal bus traffic". Done from map tiles alone (see below).
- **The long-term idea:** the game built from a city's own open data, using the layers of the sister app
  Your Place · Data (https://yourplace3d.github.io/3dcitydata/, source in `yourplace3d/3d-city`, branch `v2`):
  incomes and rents per area, timetables (GTFS), traffic counts, steepness. "You may be in a rich or poor
  borough, you might take the subway." Not started. One caution raised with the owner and left for them to
  decide: tie wealth data to prices, cars and pay, and keep police behaviour the same everywhere, so the game
  makes no statement about real neighbourhoods.
- **A run is three deliveries (five until 14 November 2026), with a scoreboard** (`RUN_JOBS` and `RUN_STEPS` in `game.ts`, `src/scores.ts`).
  The owner asked for simple missions because cities differ, and a board "where one can write their name
  if they want to". The board is kept in the browser only. A board shared between players needs a
  server; that was put to the owner and not yet decided.
- **Coming back more often (14 November 2026).** The owner asked how to make people return: a comparable
  scoreboard, a chat, leaving the take-a-car frame, a link to their "3D view social idea". Chosen first: the
  challenge link (`src/challenge.ts`, `Game.course`, `Game.newRun(course)`), because it needs no server. A
  shared daily board, home routes with a ghost car, a courier or bus-driver frame without police, and notes
  left at places were laid out and put off; live chat was advised against. A counter of opened links was
  wanted but left out for now, since it needs a service. Which project holds the "social idea" is still open.
- **Pay inside a run counts that run's deliveries** (not every delivery ever made on the device), so two
  players are paid alike for the same run. Fines still take a share of the player's cash, which differs.
- **Decided on 14 November 2026, all live.** A run is three deliveries. The challenge button is the one yellow
  button on the result card. The place's name is shown across the screen at the start. Trains run on the
  railway: one coach, no stations, no braking for cars (the owner: "trains don't brake"), turning back at a
  dead end. Streams slow a car; rivers still stop it. No counter of links for now: the owner will see from
  friends whether links come back; GoatCounter was suggested over Supabase if one is wanted later.
- **The smear on the iPad** (dark streaks of fine lines that stay put on the screen) is most likely the
  pointing arrow, not the 3D picture. The owner saw it appear right after driving over a package ring, which
  is when the arrow jumps from the ring to the edge of the screen. The arrow was a zero-size element moved
  every frame, with an SVG carrying a `drop-shadow` filter hanging outside it; the iPad's browser left the
  shadow behind along the arrow's path. It is now a 120 px box on its own layer with no filter
  (`#arrow` in `styles.css`), live since 14 November. It never showed in the headless test browser, so this
  is not confirmed: the owner says so only if it comes back. Two earlier tries were wrong guesses about
  shadows: the ground casting none (kept, harmless) and hard-edged shadows (taken back). If it returns:
  `?try=noshadow`, `hard`, `nosmoke`, `fullres` in the link each turn one suspect off.
- **Local colours (14 November 2026).** The owner's "3d data app" session found that open data records a
  colour for few buildings (43 % in Midtown Manhattan, 16 % central Hamburg, under 1 % central Barcelona) and
  that unmapped ones can take a neighbour's. Its patch for the 3d-city repo was not reachable from here (it
  sits in a private scratch repo), so the owner asked for the idea to be built in the game directly:
  `src/game/localColours.ts`. Decided here: greens and blues are never guessed, and a square with nothing
  recorded keeps the plain palette instead of turning white. Counted in the game's squares: Hamburg 16 %
  recorded and 58 % from neighbours or the square's mix; Freiburg 2 % and 78 %; Paris (Louvre) 1 % and 70 %;
  New York 64 % and 29 %; Barcelona 0 %.
- **Hills (14 November 2026).** In San Francisco the owner took streets that stop on Telegraph Hill for a fault.
  The map is right: 16 streets stop within 450 m of Coit Tower, half of them at a stairway. The answer was to
  make it readable: stairs drawn as stairs, round street ends, slopes shaded (`RELIEF` in `roadMesh.ts`),
  arrowheads on steep streets, and hills in the driving of the player's car (`cars.ts`). Cost measured before
  and after in three cities: about 5 % more triangles, no measurable change in the time to build a square.
  A tilted camera was advised against. Still open: letting a car bump down a stairway.
- **Which real places the game shows (decided by the owner, 14 November 2026).**
  Named, and only where a square has no well-known sight: public places (town hall, station, museum, theatre,
  library, stadium, bus station, ferry terminal, cinema, marketplace, pool, sports centre).
  A symbol and no name: fuel stations (may become part of play later), fire stations, police stations.
  Allowed later but unnamed and not shown yet, pending research into whether they fit the play: colleges,
  universities, hospitals and big clinics (only big ones).
  Left out for now, though they could serve as mission places later without names: restaurants, cafés,
  hotels, supermarkets, banks, pharmacies, repair shops.
  Never: schools and kindergartens (the owner's rule), places of worship, cemeteries, prisons, embassies.
  Dropped while building, because of what the map files under them: post offices (parcel shops and other
  businesses) and courts (juvenile and labour courts turned up). The famous cathedrals in the hand-picked
  list stay. Missions between real places are not built; the owner has not asked for them yet.
- **The "3D view social idea"** is the private repo `yourplace3d/yourplace-live`: friends shown live at their
  building and floor. Agreed with the owner: no live location in the game. The two can share links between
  friends later; a run that starts or ends at a place the player picks was offered and not yet decided.
- **Streets are drawn in a fixed order, not by height** (`roadMesh.ts`). Before, where streets crossed on a
  slope, the pale kerb of one cut through the dark surface of the other ("shards"), seen by the owner in
  Ottawa and clear in Hong Kong.
- **Keep it its own thing.** The name nods at a famous game; the look, the mark and the wording must not
  imitate that game or any other. No references to it in the product or its publicity.

## How the game is built, in the parts that surprised

- **One square at a time.** `World.load` builds a 1.5 km square on a fixed grid (750 m steps) from OpenFreeMap
  vector tiles and AWS terrain tiles; the next square loads when you are 450 m from the centre, and everything
  near you is carried over (`Game.swap`). Loading blocks for roughly 130 ms.
- **Streets connect where they cross**, not only where a map line ends (`RoadNet.cross`). Before this the
  network was nearly disconnected. Bridges and the roads under them don't meet.
- **Buildings a street runs through are not walls** (`buildingsOverRoads` in `world.ts`): passages, gateways,
  town walls. Any building with a street's centre line inside it is left out of the collision index. It is
  still drawn, so a car can disappear under a roof for a moment.
- **Routes** are a shortest-path field per target (`RoadNet.field`, `RoadNet.route`). Drop-offs are only placed
  where a route exists. The distances are a `Float64Array` on purpose: with 32-bit floats the search skipped
  nodes.
- **Transit comes from the tiles' `poi` and `transportation` layers:** tram tracks are narrow `rail` lines,
  stops are `bus_stop`, `tram_stop` and `subway_entrance` points. Bus and tram lines are not the real routes.
- **Tall buildings are squashed** (`gameHeight`) so the camera can stay close; the camera also rises above
  the roofs around you.
- **`game.auto = true`** makes the game drive the jobs itself. `tools/selfdrive-test.mjs` uses it to count
  deliveries per city, and `tools/film.mjs` to film scenes frame by frame. Both need Playwright
  (`npm i -D playwright && npx playwright install chromium`) and a preview server
  (`npm run build && npx vite preview --port 4173`).
- **A build with the map shipped beside the page** (`VITE_BAKED_AT`, see README) exists for hosts that allow
  no outside requests. The Berlin preview inside Claude uses it. Vector tiles go as base64 text there.

## What was tested, and what was not

- Scripted runs, in a headless browser with software rendering at about 5 frames a second: self-driving
  deliveries in Berlin, Hamburg, Paris, New York, London, Freiburg, Nuremberg and a German village; trams
  staying on track and waiting at stops; left-hand traffic in London; the subway ride; the thin-place warning
  on eleven places; a link by name.
- **Never tested by the cloud session:** the live site itself (its address was blocked there), the place
  search against the real Photon server (tested with a stand-in answer only), touch controls on a real
  device, and real frame rates. The owner's play sessions are the only real-device evidence.
- Self-driving results vary run to run: usually two to five deliveries in eight game-minutes; an occasional
  run makes none.

## Known rough edges

- Traffic can queue behind a pedestrian walking in the road, and behind a stopped car; cars hesitate at some
  corners.
- Left-hand traffic uses rough boxes of latitude and longitude; border regions can be wrong.
- No traffic lights, no one-way streets. Sound exists since 14 November 2026 and has only been checked for
  which sounds fire when: nobody has listened to it in the test browser. Volumes and tones need the owner's ear.
- Subway rides stay within the loaded square.
- The thin-place rule counts streets across the loaded tiles, not only the square, so its numbers are loose.
- `streetKm` and the building count are the only measures of "well mapped"; a real village with complete data
  can still be called thin if it is small.

## Working conventions the owner's projects follow

- Plain, specific wording in the app, the README and commit messages; say what a thing does for the player.
- Commit messages: a short title, then a few lines on why.
- The engine in `src/geo`, `src/scene`, `src/export`, `src/data` is a copy from Walk it 3D / Your Place (MIT).
  Changes there are few and listed in the README; prefer adding to `src/game`.
- Credit the map wherever the game or pictures of it appear: "Map data © OpenStreetMap contributors".
