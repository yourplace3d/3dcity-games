/**
 * Calms the ground heights before the town is built on them.
 *
 * The height data is measured from above. Where a town is dense and tall it measured roofs, not
 * streets: the "ground" between high-rises then bulges up by tens of metres and swallows the
 * smaller houses, and over the sea it can be anything. For a game played on the streets:
 *
 * - **The sea is at sea level**, wherever the map says there is sea.
 * - **Built-up ground loses its bulges.** Around buildings, every bump narrower than about 155 m
 *   is taken down to the level of the ground around it. A slope stays a slope and a hill wider
 *   than that stays a hill; only narrow tops are trimmed.
 */

import type { Polygon } from '../geo/polygon';
import { isSea, seaMaskFromPolygons } from '../geo/sea';
import type { HeightGrid } from '../geo/terrain';

/** half the width of the bumps that go, in grid steps (10 steps of 7.8 m are about 78 m) */
const REACH = 10;
/** how far around a building the ground counts as built-up (m): wide enough to take in a beach or a square */
const NEAR_M = 120;

/** The lowest (or highest) value within `r` cells to every side: a square window, done in two passes. */
function window1(src: Float32Array, n: number, r: number, pick: (a: number, b: number) => number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let v = src[j * n + i];
      for (let a = Math.max(0, i - r); a <= Math.min(n - 1, i + r); a++) v = pick(v, src[j * n + a]);
      tmp[j * n + i] = v;
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let v = tmp[j * n + i];
      for (let b = Math.max(0, j - r); b <= Math.min(n - 1, j + r); b++) v = pick(v, tmp[b * n + i]);
      out[j * n + i] = v;
    }
  }
  return out;
}

/** Changes `grid.elev` in place. Returns how many grid points were lowered and by how much at most. */
export function calmGround(grid: HeightGrid, buildings: Array<{ poly: Polygon }>, sea: Polygon[] | undefined): { lowered: number; most: number } {
  const { n, sizeM, elev } = grid;
  const step = sizeM / (n - 1);
  const h = sizeM / 2;

  // the sea at sea level
  const mask = sea?.length ? seaMaskFromPolygons(sea, sizeM, 1024) : null;
  const wet = new Uint8Array(elev.length);
  if (mask) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (!isSea(mask, -h + i * step, -h + j * step)) continue;
        wet[j * n + i] = 1;
        elev[j * n + i] = 0;
      }
    }
  }

  // which grid points lie at buildings
  const built = new Uint8Array(elev.length);
  for (const b of buildings) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of b.poly.outer) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const i0 = Math.max(0, Math.floor((x0 - NEAR_M + h) / step));
    const i1 = Math.min(n - 1, Math.ceil((x1 + NEAR_M + h) / step));
    const j0 = Math.max(0, Math.floor((y0 - NEAR_M + h) / step));
    const j1 = Math.min(n - 1, Math.ceil((y1 + NEAR_M + h) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) built[j * n + i] = 1;
  }

  // the ground without its narrow bumps: the lowest around, then the highest of that around
  const opened = window1(window1(elev, n, REACH, Math.min), n, REACH, Math.max);
  let lowered = 0;
  let most = 0;
  const next = Float32Array.from(elev);
  for (let k = 0; k < elev.length; k++) {
    if (!built[k] || wet[k]) continue;
    const drop = elev[k] - opened[k];
    // under half a metre is the lie of the land, not a roof
    if (drop < 0.5) continue;
    next[k] = opened[k];
    lowered++;
    most = Math.max(most, drop);
  }
  // soften the steps the lowering left, where it happened
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      let v = next[k];
      if (built[k] && !wet[k] && i > 0 && j > 0 && i < n - 1 && j < n - 1) {
        let s = 0;
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += next[(j + b) * n + i + a];
        v = s / 9;
      }
      elev[k] = v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  grid.min = min;
  grid.max = max;
  return { lowered, most };
}
