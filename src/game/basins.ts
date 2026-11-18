/**
 * Small water as something built: a basin with a stone rim, and a jet in the middle of a round one.
 *
 * The map calls every small piece of water a pond and has no word for a fountain, so the game
 * judges by size and shape: water up to 25 m across and compact (a circle, a square, an oval) is
 * drawn as a basin; anything larger or straggling stays a pond, painted on the ground. A swimming
 * pool gets the rim and a paler blue, and never a jet.
 *
 * Painted on the ground a 10 m fountain was a dozen soft pixels. Here it is a shape of its own, so
 * its edge stays sharp from close up. All the basins of a square are one shape and one draw.
 */

import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial, ShapeUtils, Vector2 } from 'three';
import type { AreaFeature } from '../geo/osm';
import type { Polygon, Ring } from '../geo/polygon';

/** Water wider than this stays a pond (m). */
const MAX_ACROSS_M = 25;
/** Smaller than this is a speck in the data, not worth a rim (m²). */
const MIN_AREA_M2 = 6;
/** How compact a basin must be: 1 is a circle, a square 0.79, a strip three times as long as wide 0.59. */
const MIN_COMPACT = 0.6;
/** From here on it is round enough for a jet in the middle. */
const ROUND = 0.84;
const RIM_W = 0.55;
const RIM_H = 0.45;

export interface Basin {
  poly: Polygon;
  cx: number;
  cy: number;
  /** half its width, measured from the middle to the farthest corner */
  r: number;
  jet: boolean;
  pool: boolean;
}

const ringArea = (r: Ring): number => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

/** A ring without its closing point and without points lying on top of each other. */
const tidy = (r: Ring): Ring => {
  const out: Ring = [];
  for (const p of r) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.05) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.05) out.pop();
  return out;
};

/**
 * Takes the basins out of the areas, so that the ground is not painted blue under them, and hands
 * them back. `half` is half the square's width: water cut by the square's edge is left alone.
 */
export function takeBasins(areas: AreaFeature[], half: number): Basin[] {
  const basins: Basin[] = [];
  for (const a of areas) {
    if (a.kind !== 'water') continue;
    const cls = a.cls;
    if (cls === 'river' || cls === 'ocean' || cls === 'dock') continue;
    a.polys = a.polys.filter((poly) => {
      const outer = tidy(poly.outer);
      if (outer.length < 3) return true;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, per = 0;
      for (let i = 0; i < outer.length; i++) {
        const p = outer[i];
        const q = outer[(i + 1) % outer.length];
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
        per += Math.hypot(q[0] - p[0], q[1] - p[1]);
      }
      if (Math.max(x1 - x0, y1 - y0) > MAX_ACROSS_M) return true;
      if (x0 < -half + 2 || y0 < -half + 2 || x1 > half - 2 || y1 > half - 2) return true;
      const area = Math.abs(ringArea(outer));
      if (area < MIN_AREA_M2) return true;
      const compact = (4 * Math.PI * area) / (per * per);
      if (compact < MIN_COMPACT) return true;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      let r = 0;
      for (const p of outer) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
      const pool = cls === 'swimming_pool';
      const holes = poly.holes.map(tidy).filter((h) => h.length >= 3);
      // a jet where the basin is round and wide enough to show one, and has no island in the middle
      basins.push({ poly: { outer, holes }, cx, cy, r, jet: !pool && !holes.length && compact >= ROUND && r >= 2.5, pool });
      return false;
    });
  }
  return basins;
}

const STONE = new Color('#f0ebde');
const STONE_SIDE = new Color('#a59d8c');
const WATER = new Color('#4d9bd1');
const POOL = new Color('#8fd0ea');
const FOAM = new Color('#f2f9fc');

/** The basins of a square as one shape. `ground` gives the height of the ground at a spot. */
export function basinMesh(basins: Basin[], ground: (x: number, y: number) => number): Mesh | null {
  if (!basins.length) return null;
  const pos: number[] = [];
  const col: number[] = [];
  // a triangle from three spots (east, up, north), seen from above or from outside
  const tri = (a: number[], b: number[], c: number[], k: Color) => {
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], -p[2]);
      col.push(k.r, k.g, k.b);
    }
  };
  for (const b of basins) {
    const { outer, holes } = b.poly;
    const ccw = ringArea(outer) > 0 ? outer : [...outer].reverse();
    // the rim's outer edge: each corner pushed away from the middle
    const wide = ccw.map((p) => {
      const d = Math.hypot(p[0] - b.cx, p[1] - b.cy) || 1;
      return [p[0] + ((p[0] - b.cx) / d) * RIM_W, p[1] + ((p[1] - b.cy) / d) * RIM_W] as [number, number];
    });
    // level on a slope: the rim stands on the highest ground under it and its wall reaches below the lowest
    let hi = -Infinity, lo = Infinity;
    for (const p of wide) {
      const g = ground(p[0], p[1]);
      hi = Math.max(hi, g);
      lo = Math.min(lo, g);
    }
    const top = hi + RIM_H;
    const foot = lo - 0.6;
    const level = top - 0.14;
    const n = ccw.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = ccw[i], c = ccw[j], A = wide[i], C = wide[j];
      // the top of the rim
      tri([a[0], top, a[1]], [A[0], top, A[1]], [C[0], top, C[1]], STONE);
      tri([a[0], top, a[1]], [C[0], top, C[1]], [c[0], top, c[1]], STONE);
      // its wall, facing out
      tri([A[0], top, A[1]], [A[0], foot, A[1]], [C[0], foot, C[1]], STONE_SIDE);
      tri([A[0], top, A[1]], [C[0], foot, C[1]], [C[0], top, C[1]], STONE_SIDE);
    }
    // the water, a little below the rim
    const contour = ccw.map((p) => new Vector2(p[0], p[1]));
    const holeRings = holes.map((h) => (ringArea(h) < 0 ? h : [...h].reverse()));
    const all = [...ccw, ...holeRings.flat()];
    const blue = b.pool ? POOL : WATER;
    for (const f of ShapeUtils.triangulateShape(contour, holeRings.map((h) => h.map((p) => new Vector2(p[0], p[1]))))) {
      const [p, q, r] = [all[f[0]], all[f[1]], all[f[2]]];
      tri([p[0], level, p[1]], [q[0], level, q[1]], [r[0], level, r[1]], blue);
    }
    // an island in the basin is stone, as high as the rim
    for (const h of holeRings) {
      const up = [...h].reverse();
      for (const f of ShapeUtils.triangulateShape(up.map((p) => new Vector2(p[0], p[1])), [])) {
        const [p, q, r] = [up[f[0]], up[f[1]], up[f[2]]];
        tri([p[0], top, p[1]], [q[0], top, q[1]], [r[0], top, r[1]], STONE);
      }
    }
    if (b.jet) {
      // the jet: white water where it falls back, and a column in the middle
      const foamR = Math.min(2.2, b.r * 0.32);
      const colR = Math.max(0.18, foamR * 0.22);
      const tall = Math.min(3, 0.8 + b.r * 0.35);
      const sides = 12;
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;
        const at = (rad: number, ang: number, y: number) => [b.cx + Math.cos(ang) * rad, y, b.cy + Math.sin(ang) * rad];
        tri([b.cx, level + 0.03, b.cy], at(foamR, a0, level + 0.03), at(foamR, a1, level + 0.03), FOAM);
        tri(at(colR, a0, level), at(colR, a1, level), [b.cx, level + tall, b.cy], FOAM);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
