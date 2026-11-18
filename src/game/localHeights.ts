/**
 * Heights for buildings the map gives none. The tiles hand such a building 5 m, so a quarter of
 * six-storey blocks whose mappers drew only the outlines comes out as flat slabs between the few
 * houses with a recorded height. Such a building takes the middle height of its nearest recorded
 * neighbours instead, nudged a little so a row of them is not one level roof.
 *
 * Sheds and garages stay low: a small footprint is not raised, and does not pass its height on.
 * Where too little is recorded nearby, the 5 m stays.
 */

import { centroid, signedArea, type Polygon } from '../geo/polygon';

/** a footprint under this is a shed, a garage or a kiosk (m²) */
const SMALL = 45;
/** a building looks this far for recorded neighbours (m), takes the nearest few, and needs this many */
const REACH = 160;
const NEAREST = 9;
const ENOUGH = 4;
const CELL = 80;

export interface HeightCounts {
  /** buildings with a recorded height, those raised to their neighbours', and those left at the tiles' 5 m */
  mapped: number;
  neighbours: number;
  low: number;
}

function hash(a: number, b: number): number {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Raises `height` in place where it was not recorded and the neighbours tell what it should be. */
export function localHeights(buildings: Array<{ poly: Polygon; height: number; heightKnown: boolean }>): HeightCounts {
  const at = buildings.map((b) => ({ c: centroid(b.poly.outer), area: Math.abs(signedArea(b.poly.outer)) }));
  const cells = new Map<number, number[]>();
  const cellOf = (cx: number, cy: number) => (cx + 512) * 1024 + cy + 512;
  buildings.forEach((b, i) => {
    if (!b.heightKnown || at[i].area < SMALL) return;
    const k = cellOf(Math.floor(at[i].c[0] / CELL), Math.floor(at[i].c[1] / CELL));
    const list = cells.get(k);
    if (list) list.push(i);
    else cells.set(k, [i]);
  });
  const counts: HeightCounts = { mapped: 0, neighbours: 0, low: 0 };
  const rings = Math.ceil(REACH / CELL);
  // the recorded heights are read before any is changed, so a guess never feeds the next guess
  const raised: Array<[number, number]> = [];
  buildings.forEach((b, i) => {
    if (b.heightKnown) return void counts.mapped++;
    const [x, y] = at[i].c;
    if (at[i].area < SMALL) return void counts.low++;
    const near: Array<{ d: number; h: number }> = [];
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let dy = -rings; dy <= rings; dy++)
      for (let dx = -rings; dx <= rings; dx++)
        for (const j of cells.get(cellOf(cx + dx, cy + dy)) ?? []) {
          const d = Math.hypot(at[j].c[0] - x, at[j].c[1] - y);
          if (d <= REACH) near.push({ d, h: buildings[j].height });
        }
    if (near.length < ENOUGH) return void counts.low++;
    near.sort((p, q) => p.d - q.d);
    const hs = near.slice(0, NEAREST).map((p) => p.h).sort((p, q) => p - q);
    const mid = hs[hs.length >> 1];
    if (mid <= b.height) return void counts.low++;
    // the nudge comes from the building's shape and size, which are the same on every visit
    const r = hash(Math.round(at[i].area * 10), b.poly.outer.length);
    raised.push([i, Math.round(mid * (0.88 + 0.24 * r) * 10) / 10]);
    counts.neighbours++;
  });
  for (const [i, h] of raised) buildings[i].height = h;
  return counts;
}
