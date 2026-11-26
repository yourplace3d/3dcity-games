# Trees

*Written 26 November 2026, while the trees were a trial on branch `claude/project-thread-nxkr8f`.*

## What the game has

Trees from the map alone (`src/game/trees.ts`), worldwide, with no extra data or hosting:

- in woods: close together, about a third of them firs;
- in parks, gardens and cemeteries: spread out;
- never on a road or path (nor with the crown over one), in a building, in water, on a sports
  ground or a square.

Each tree's spot comes from where it stands on the earth, so it is the same on every visit. The trunk is
solid (`Solids.addPosts`): a car bumps off it as off a wall, and people walk round it. `?try=notrees`
leaves the trees out, to compare.

Drawing cost, measured with `tools/trees-bench.html` (a square of wood under the game's camera) in a
browser with software graphics, the worst case: about 25,000 triangles and 13 draws a frame, 27 ms a
frame against 21 ms without trees. What made it cheap: flat crowns of 36 triangles, trunks of 10
triangles that throw no shadow, a soft patch on the ground instead of a real shadow (real shadows cost four times as much), trees in
patches of 125 m so those off screen are skipped, and at most 9,000 a square. Not yet measured on a
phone.

The owner found the first live trees looked like flying balls (26 November): the shadow patch lay
where the crown's shadow falls, metres away from the tree, and no trunk was drawn. The patch now
runs from the foot of the trunk to the crown's shadow, the trunks are drawn again, and the trees are
lower (5.5–9 m, firs 8–13 m).

## Parked: trees from satellites (owner, 26 November 2026)

The map has no street trees, back yards or the green between blocks. ESA WorldCover (10 m land cover
from satellites, CC BY 4.0, attribution "ESA WorldCover project 2021") shows them. The code is in
place and switched off (`SATELLITE_TREES` in `src/game/trees.ts`): the owner found it too expensive for
now because of the storage it needs.

Why it needs hosting: ESA's bucket sends no CORS headers, so a browser cannot read it. The squares have
to be baked (`tools/landcover-bake.mjs`, one 256 × 256 grey PNG per zoom-14 tile, the pixel is the
WorldCover class) and served by us.

- Size for the world: roughly 40–100 GB (about 40 million land tiles of 1–5 KB), best packed as one
  PMTiles file. GitHub Pages allows 1 GB, so it cannot live beside the game.
- Where: storage a browser can read with CORS, for example Cloudflare R2 (in November 2026 about
  $0.015 a GB a month, no charge for downloads, a small charge per million reads).
- Cost estimate: a few dollars a month to store; at 10,000 games a day very roughly $5–10 a month in
  reads; baking the world once is about a day on a rented machine, a few dollars.
- Smaller ways in: only the cities players start in most, or a 1-bit tree mask at 10 m instead of all
  classes.

The trial baked six cities (Berlin, Hamburg, Paris, London, New York, Tokyo, 3.5 km round each centre:
168 tiles, 830 KB). They were taken out of the branch again; the bake tool makes them in a minute:

    npm i --no-save geotiff@2.1.3
    node tools/landcover-bake.mjs public/landcover 52.5170,13.3889,3.5 48.8566,2.3522,3.5

then set `SATELLITE_TREES = true`.

## Ideas not done

- Real roof shapes and roof colours are the other cheap gain found in the same research (procedural
  pitched roofs on small houses; OSM `roof:shape` needs our own tiles).
