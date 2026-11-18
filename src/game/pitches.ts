/**
 * Sports grounds as something laid out, not a patch of green: mown turf with sharp edges and white
 * lines, the way basins got a stone rim. Painted on the ground a pitch was a soft green blot that
 * nobody took for a football field or a baseball diamond.
 *
 * The map gives the outline and seldom the sport, so the game judges by shape: a rectangle gets
 * stripes in the grass, a line round it and a halfway line (with a centre circle when it is big
 * enough for football); any other shape gets the turf and a line round it. Sand or clay mapped
 * inside a pitch (a baseball infield, a running track's jumping pit) is drawn on top of it, sharp
 * as well.
 *
 * All the pitches of a square are one shape and one draw.
 */

import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial, ShapeUtils, Vector2 } from 'three';
import type { AreaFeature } from '../geo/osm';
import polygonClipping, { type MultiPolygon } from 'polygon-clipping';
import type { Polygon, Ring } from '../geo/polygon';

/** Smaller than this is no pitch worth drawing (m²): a single basketball hoop's patch. */
const MIN_AREA_M2 = 120;
/** How close to a rectangle an outline must be to count as one: its area against its tightest box. */
const RECT_FILL = 0.88;

export interface Pitch {
  outer: Ring;
  /** for a rectangle: its middle, the direction of its long side, and half its length and width */
  rect: { cx: number; cy: number; ux: number; uy: number; hl: number; hw: number } | null;
  /** sand or clay inside it, with the grass inside that (a baseball infield's) as holes */
  infill: Polygon[];
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

const tidy = (r: Ring): Ring => {
  const out: Ring = [];
  for (const p of r) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.05) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.05) out.pop();
  return out;
};

/** The box around a ring: west, south, east, north. */
export function bounds(r: Ring): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of r) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return [x0, y0, x1, y1];
}

/** The tightest box along one of the ring's own sides, if the ring nearly fills it. */
export function asRect(ring: Ring): Pitch['rect'] {
  const area = Math.abs(ringArea(ring));
  let best: Pitch['rect'] = null;
  let bestArea = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 1) continue;
    const ux = (q[0] - p[0]) / len;
    const uy = (q[1] - p[1]) / len;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const r of ring) {
      const a = r[0] * ux + r[1] * uy;
      const b = -r[0] * uy + r[1] * ux;
      a0 = Math.min(a0, a);
      a1 = Math.max(a1, a);
      b0 = Math.min(b0, b);
      b1 = Math.max(b1, b);
    }
    const box = (a1 - a0) * (b1 - b0);
    if (box >= bestArea) continue;
    bestArea = box;
    const am = (a0 + a1) / 2;
    const bm = (b0 + b1) / 2;
    const cx = am * ux - bm * uy;
    const cy = am * uy + bm * ux;
    // the long side leads
    best = a1 - a0 >= b1 - b0 ? { cx, cy, ux, uy, hl: (a1 - a0) / 2, hw: (b1 - b0) / 2 } : { cx, cy, ux: -uy, uy: ux, hl: (b1 - b0) / 2, hw: (a1 - a0) / 2 };
  }
  return best && area / bestArea >= RECT_FILL ? best : null;
}

/**
 * Takes the pitches out of the areas, so that the ground is not painted green under them, and
 * hands them back with the sand inside them. `half` is half the square's width: a pitch cut by the
 * square's edge stays painted.
 */
export function takePitches(areas: AreaFeature[], half: number): Pitch[] {
  const pitches: Pitch[] = [];
  for (const a of areas) {
    if (a.kind !== 'green' || a.cls !== 'pitch') continue;
    a.polys = a.polys.filter((poly) => {
      const outer = tidy(poly.outer);
      if (outer.length < 3 || poly.holes.length) return true;
      if (outer.some((p) => Math.abs(p[0]) > half - 2 || Math.abs(p[1]) > half - 2)) return true;
      if (Math.abs(ringArea(outer)) < MIN_AREA_M2) return true;
      pitches.push({ outer, rect: asRect(outer), infill: [] });
      return false;
    });
  }
  if (!pitches.length) return pitches;
  // sand on a pitch is part of it. The map tiles cut it where they meet, so the pieces are joined
  // again and trimmed to the pitch's edge.
  const sand: Ring[][] = [];
  for (const a of areas) if (a.kind === 'sand') for (const poly of a.polys) sand.push([poly.outer, ...poly.holes].map((r) => tidy(r)).filter((r) => r.length >= 3));
  const closed = (r: Ring): Array<[number, number]> => [...r.map((p): [number, number] => [p[0], p[1]]), [r[0][0], r[0][1]]];
  for (const p of pitches) {
    const [x0, y0, x1, y1] = bounds(p.outer);
    const near = sand.filter((rings) => {
      if (!rings.length) return false;
      const [a0, b0, a1, b1] = bounds(rings[0]);
      return a1 > x0 && a0 < x1 && b1 > y0 && b0 < y1;
    });
    if (!near.length) continue;
    try {
      const joined = polygonClipping.union(...(near.map((rings) => [rings.map(closed)]) as [MultiPolygon, ...MultiPolygon[]]));
      for (const [outer, ...holes] of polygonClipping.intersection(joined, [[closed(p.outer)]])) {
        const ring = tidy(outer as Ring);
        if (ring.length >= 3 && Math.abs(ringArea(ring)) > 4) p.infill.push({ outer: ring, holes: holes.map((h) => tidy(h as Ring)).filter((h) => h.length >= 3) });
      }
    } catch {
      /* a shape the clipping could not read: the pitch is drawn without its sand */
    }
  }
  return pitches;
}

const TURF = new Color('#78b35f');
const TURF_LIGHT = new Color('#86bf6c');
const CLAY = new Color('#e3bf86');
/** heights over the ground (m): far enough apart that the layers never flicker through each other */
const UP_TURF = 0.04;
const UP_CLAY = 0.14;
const UP_CHALK = 0.22;
const CHALK = new Color('#f3f3ec');

/** The pitches of a square as one shape. `ground` gives the height of the ground at a spot. */
export function pitchMesh(pitches: Pitch[], ground: (x: number, y: number) => number): Mesh | null {
  if (!pitches.length) return null;
  const pos: number[] = [];
  const col: number[] = [];
  // a pitch is level: it lies at the height of the highest ground under it
  let level = 0;
  const at = (x: number, y: number, up: number): number[] => [x, level + up, y];
  const tri = (a: number[], b: number[], c: number[], k: Color) => {
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], -p[2]);
      col.push(k.r, k.g, k.b);
    }
  };
  const fill = (ring: Ring, up: number, k: Color, holes: Ring[] = []) => {
    const ccw = ringArea(ring) > 0 ? ring : [...ring].reverse();
    const cw = holes.map((h) => (ringArea(h) < 0 ? h : [...h].reverse()));
    const all = [...ccw, ...cw.flat()];
    for (const f of ShapeUtils.triangulateShape(ccw.map((p) => new Vector2(p[0], p[1])), cw.map((h) => h.map((p) => new Vector2(p[0], p[1]))))) {
      const [p, q, r] = [all[f[0]], all[f[1]], all[f[2]]];
      tri(at(p[0], p[1], up), at(q[0], q[1], up), at(r[0], r[1], up), k);
    }
  };
  /** a quad from four corners in order round it */
  const quad = (a: [number, number], b: [number, number], c: [number, number], d: [number, number], up: number, k: Color) => {
    tri(at(a[0], a[1], up), at(b[0], b[1], up), at(c[0], c[1], up), k);
    tri(at(a[0], a[1], up), at(c[0], c[1], up), at(d[0], d[1], up), k);
  };
  /** a white line from one spot to another */
  const line = (x0: number, y0: number, x1: number, y1: number, w: number, up: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * (w / 2);
    const ny = ((x1 - x0) / len) * (w / 2);
    quad([x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 + nx, y1 + ny], up, CHALK);
  };
  for (const p of pitches) {
    const [x0, y0, x1, y1] = bounds(p.outer);
    level = -Infinity;
    for (let x = x0; x <= x1 + 0.01; x += Math.max(2, (x1 - x0) / 12))
      for (let y = y0; y <= y1 + 0.01; y += Math.max(2, (y1 - y0) / 12)) level = Math.max(level, ground(x, y));
    const r = p.rect;
    if (r) {
      // in a local frame along the long side
      const pt = (a: number, b: number): [number, number] => [r.cx + a * r.ux - b * r.uy, r.cy + a * r.uy + b * r.ux];
      // mown stripes across the long side
      const n = Math.max(2, Math.round(r.hl / 5)) * 2;
      for (let i = 0; i < n; i++) {
        const a0 = -r.hl + (2 * r.hl * i) / n;
        const a1 = -r.hl + (2 * r.hl * (i + 1)) / n;
        quad(pt(a0, -r.hw), pt(a1, -r.hw), pt(a1, r.hw), pt(a0, r.hw), UP_TURF, i % 2 ? TURF : TURF_LIGHT);
      }
      for (const q of p.infill) fill(q.outer, UP_CLAY, CLAY, q.holes);
      // lines: a small court gets thin ones close to its edge
      const big = r.hl > 25;
      const w = big ? 0.5 : 0.25;
      const inset = Math.min(big ? 2 : 0.6, r.hw * 0.15);
      const hl = r.hl - inset;
      const hw = r.hw - inset;
      const c = [pt(-hl, -hw), pt(hl, -hw), pt(hl, hw), pt(-hl, hw)];
      for (let i = 0; i < 4; i++) line(c[i][0], c[i][1], c[(i + 1) % 4][0], c[(i + 1) % 4][1], w, UP_CHALK);
      // a halfway line, and a centre circle where the field is big enough for football; not on a
      // ground with an infield or a track: that is baseball or athletics, not football
      const football = !p.infill.length;
      const [m0, m1] = [pt(0, -hw), pt(0, hw)];
      if (football) line(m0[0], m0[1], m1[0], m1[1], w, UP_CHALK);
      if (football && big && hw > 14) {
        const cr = Math.min(9, hw * 0.3);
        const sides = 32;
        for (let i = 0; i < sides; i++) {
          const a0 = (i / sides) * Math.PI * 2;
          const a1 = ((i + 1) / sides) * Math.PI * 2;
          line(r.cx + Math.cos(a0) * cr, r.cy + Math.sin(a0) * cr, r.cx + Math.cos(a1) * cr, r.cy + Math.sin(a1) * cr, w, UP_CHALK);
        }
      }
    } else {
      fill(p.outer, UP_TURF, TURF);
      for (const q of p.infill) fill(q.outer, UP_CLAY, CLAY, q.holes);
      // a line just inside the edge
      let cx = 0, cy = 0;
      for (const q of p.outer) {
        cx += q[0];
        cy += q[1];
      }
      cx /= p.outer.length;
      cy /= p.outer.length;
      const inner = p.outer.map((q): [number, number] => {
        const d = Math.hypot(q[0] - cx, q[1] - cy) || 1;
        const k = Math.max(0, d - 1.2) / d;
        return [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k];
      });
      for (let i = 0; i < inner.length; i++) {
        const a = inner[i];
        const b = inner[(i + 1) % inner.length];
        line(a[0], a[1], b[0], b[1], 0.4, UP_CHALK);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.computeVertexNormals();
  // under the streets and paths that cross a ground, over the painted ground
  const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.receiveShadow = true;
  return mesh;
}
