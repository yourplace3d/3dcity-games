# The ground: kinds of land and the lie of it

*Written 26 November 2026, as a trial on branch `claude/project-thread-vz1xys`.*

Two things, both from data the game already loads and both worked out once when a square loads, so
they cost nothing while playing. `?try=plainland` in the link turns both off, to compare.

## Every kind of land the map gives (`src/geo/tiles.ts`, `src/scene/overlay.ts`)

The map squares (OpenFreeMap, OpenMapTiles schema) carry more than the game used to paint:

- **Land cover:** wetland (marsh, swamp, bog, reeds) in blue-green with strokes of reed, heath and fell
  in a dry olive, scrub between grass and wood, orchards with dots for the trees, vineyards with rows,
  bare rock and scree in grey with stones, glaciers in white.
- **What a part of town is used for** (land use): homes a warm shade, shops and offices a pinkish one,
  industry and railway land grey, schools, universities and hospitals a pale yellow, quarries bare
  earth with stones. Painted under everything else, so parks and squares inside stay as they were.

Rock, glaciers and the parts of town are a new kind of area (`'rock'`, `'ice'`, `'built'`) that only
colours the ground: trees, prices and water don't look at them.

## The lie of the ground (`src/scene/relief.ts`)

From the height grid (a point every 7.8 m): slopes steeper than about 24° turn bare (fully at 38°),
steeper than 40° into a darker cliff, and ground above the lasting snow line is white. The snow line is
a guess from latitude alone, about 4,800 m in the tropics, 2,900 m in the Alps, 1,300 m at 60°. It lies
over fields, grass and the parts of town, and under woods, beaches, squares, water and roads.

Measured on the raw heights of ten places: none in Berlin, San Francisco, Lisbon, Cape Town's centre
or Innsbruck's; under 1 % of the square in Wellington and Monaco; about 30 % around Zermatt and on
Hong Kong's Peak (mostly under woods there); snow on 80 % of the square at the Jungfraujoch.

`tools/relief-bench.html` and `tools/relief-shots.mjs` show the relief on the real heights of a place
without the map (for a machine that can't reach the map tiles).

## Not checked yet

The land colours have not been seen on real map tiles: the machine they were made on could not reach
OpenFreeMap. Look at a few places before this goes live (a marshy coast, a wine region, an industrial
port, a mountain town).
