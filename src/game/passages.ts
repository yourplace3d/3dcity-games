/**
 * Ways through buildings: archways, gateways into courtyards, streets under a house, gates in a town
 * wall. The map draws such a building as one whole block, so on its own it would wall the street
 * off. Here a corridor along the street is cut out of the building at ground level: the walls on
 * either side stay solid, and the floors above stay as a roof you pass beneath (`Solids` skips parts
 * that start above head height). A low building, a gate or a wall, is cut open to the sky.
 *
 * A street wide enough for a car gets a corridor a car fits through; a footpath one wide enough to
 * walk, and for a small car to squeeze through.
 */

import polygonClipping, { type Geom, type MultiPolygon } from 'polygon-clipping';
import { closed, fromMulti, toGeom } from '../geo/clip';
import type { LineFeature, LineKind } from '../geo/osm';
import { pointInRing, ringBounds, type Polygon, type Pt, type Ring } from '../geo/polygon';

/** Kinds of line that are driven or walked: these open a building. Rails and water don't. */
const OPENS = new Set<LineKind>(['motorway', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'path']);
/** how high the opening is (m): over a car, a van, a person */
export const PASSAGE_CLEAR_M = 4;
/** the narrowest corridor cut for a street a car takes, and for a footpath (m) */
const MIN_DRIVE_W = 3.6;
const MIN_WALK_W = 2.6;
/** sample spacing along the lines (m) */
const STEP = 0.5;
/** Building parts that start this high already let you pass beneath (as in `Solids`). */
const OVERHEAD_M = 2.6;
/** below this much building over the opening, the opening is left open to the sky (m) */
const MIN_ROOF_M = 1.5;
const CELL = 32;

export interface CarvableBuilding {
  poly: Polygon;
  height: number;
  minHeight: number;
}

interface Run {
  /** arc length along the line where it is inside the building */
  s0: number;
  s1: number;
  depth: number;
}

/** A grid over the buildings' outlines, to find the ones whose bounds meet a small box. */
function index(buildings: CarvableBuilding[]): (x0: number, y0: number, x1: number, y1: number) => number[] {
  const key = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);
  const cells = new Map<number, number[]>();
  const box = new Float64Array(buildings.length * 4);
  buildings.forEach((b, i) => {
    const [x0, y0, x1, y1] = ringBounds(b.poly.outer);
    box.set([x0, y0, x1, y1], i * 4);
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
        const k = key(cx, cy);
        const list = cells.get(k);
        if (list) list.push(i);
        else cells.set(k, [i]);
      }
  });
  return (x0, y0, x1, y1) => {
    const out: number[] = [];
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
        for (const i of cells.get(key(cx, cy)) ?? [])
          if (x1 >= box[i * 4] && x0 <= box[i * 4 + 2] && y1 >= box[i * 4 + 1] && y0 <= box[i * 4 + 3] && !out.includes(i)) out.push(i);
    return out;
  };
}

const inside = (p: Pt, poly: Polygon) => pointInRing(p, poly.outer) && !poly.holes.some((h) => pointInRing(p, h));

/** Distance from a point to the nearest wall of an outline. */
function depthIn(p: Pt, poly: Polygon): number {
  let best = Infinity;
  for (const ring of [poly.outer, ...poly.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
    }
  }
  return best;
}

/** Points along a line every `STEP` metres or less, with their arc length, in pieces of up to `CHUNK` metres. */
const CHUNK = 16;
function* chunks(pts: Pt[]): Generator<{ x0: number; y0: number; x1: number; y1: number; pts: Array<{ p: Pt; s: number }> }> {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const pieces = Math.max(1, Math.ceil(len / CHUNK));
    for (let c = 0; c < pieces; c++) {
      const t0 = c / pieces;
      const t1 = (c + 1) / pieces;
      const last = i === pts.length - 2 && c === pieces - 1;
      const px0 = ax + (bx - ax) * t0;
      const py0 = ay + (by - ay) * t0;
      const px1 = ax + (bx - ax) * t1;
      const py1 = ay + (by - ay) * t1;
      const plen = len / pieces;
      const n = Math.max(1, Math.ceil(plen / STEP));
      yield {
        x0: Math.min(px0, px1),
        y0: Math.min(py0, py1),
        x1: Math.max(px0, px1),
        y1: Math.max(py0, py1),
        get pts() {
          const out: Array<{ p: Pt; s: number }> = [];
          for (let k = 0; k < n + (last ? 1 : 0); k++) out.push({ p: [px0 + ((px1 - px0) * k) / n, py0 + ((py1 - py0) * k) / n], s: s + len * t0 + (plen * k) / n });
          return out;
        },
      };
    }
    s += len;
  }
}

/** Points along a line every `STEP` metres or less, with their arc length. */
function samples(pts: Pt[]): Array<{ p: Pt; s: number }> {
  const out: Array<{ p: Pt; s: number }> = [];
  for (const c of chunks(pts)) out.push(...c.pts);
  return out;
}

/** The stretches of a line inside each building it enters, by building. */
function runsOf(pts: Pt[], buildings: CarvableBuilding[], near: ReturnType<typeof index>): Map<number, Run[]> {
  const runs = new Map<number, Run[]>();
  const open = new Map<number, Run>();
  const close = (keep: Set<number> | null) => {
    for (const [i, r] of open) {
      if (keep?.has(i)) continue;
      open.delete(i);
      const list = runs.get(i);
      if (list) list.push(r);
      else runs.set(i, [r]);
    }
  };
  for (const c of chunks(pts)) {
    // most of a street runs between the buildings, clear of every one's bounds
    const cand = near(c.x0, c.y0, c.x1, c.y1);
    if (!cand.length) {
      close(null);
      continue;
    }
    for (const { p, s } of c.pts) {
      const here = new Set<number>();
      for (const i of cand) {
        if (!inside(p, buildings[i].poly)) continue;
        here.add(i);
        const d = depthIn(p, buildings[i].poly);
        const r = open.get(i);
        if (r) {
          r.s1 = s;
          r.depth = Math.max(r.depth, d);
        } else open.set(i, { s0: s, s1: s, depth: d });
      }
      close(here);
    }
  }
  close(null);
  return runs;
}

/**
 * Whether a stretch goes through a building, rather than grazing its front because the street's
 * line was drawn a little off: it must reach well into the building somewhere. A thin wall the
 * street crosses straight counts, since the stretch is short.
 */
function goesThrough(r: Run): boolean {
  return r.depth >= Math.min(1.2, 0.3 * (r.s1 - r.s0) + 0.2);
}

/** The part of a line between two arc lengths. */
function slice(pts: Pt[], s0: number, s1: number): Pt[] {
  const out: Pt[] = [];
  let s = 0;
  const at = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const e = s + len;
    if (e >= s0 && s <= s1 && len > 0) {
      if (!out.length) out.push(s0 > s ? at(a, b, (s0 - s) / len) : a);
      out.push(s1 < e ? at(a, b, (s1 - s) / len) : b);
    }
    s = e;
    if (s > s1) break;
  }
  return out;
}

/** A band of width `w` along a polyline, as pieces to be joined: a box per segment, a square at each bend. */
function band(pts: Pt[], w: number): Geom[] {
  const h = w / 2;
  const out: Geom[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-3) continue;
    const nx = (-(by - ay) / len) * h;
    const ny = ((bx - ax) / len) * h;
    const box: Ring = [
      [ax + nx, ay + ny],
      [ax - nx, ay - ny],
      [bx - nx, by - ny],
      [bx + nx, by + ny],
    ];
    out.push([closed(box)]);
    if (i > 0) {
      // the bend: an octagon, so the corridor has no notch on the outside of a turn
      const oct: Ring = [];
      for (let k = 0; k < 8; k++) oct.push([ax + Math.cos((k * Math.PI) / 4) * h, ay + Math.sin((k * Math.PI) / 4) * h]);
      out.push([closed(oct)]);
    }
  }
  return out;
}

/** How wide a corridor a line gets through a building. */
export function passageWidth(l: Pick<LineFeature, 'kind' | 'widthM'>): number {
  return Math.max(l.widthM, l.kind === 'path' ? MIN_WALK_W : MIN_DRIVE_W);
}

/**
 * Lines the tiles call tunnels but that stay at ground level are kept only where at least half of
 * them runs under buildings: a building passage. Any other is a tunnel after all and left out.
 */
export function keepPassages(lines: LineFeature[], buildings: CarvableBuilding[]): LineFeature[] {
  if (!lines.some((l) => l.passage)) return lines;
  const near = index(buildings);
  return lines.filter((l) => {
    if (!l.passage) return true;
    const pts = samples(l.pts);
    if (pts.length < 2) return false;
    let under = 0;
    for (const { p } of pts) if (near(p[0], p[1], p[0], p[1]).some((i) => inside(p, buildings[i].poly))) under++;
    return under >= pts.length * 0.5;
  });
}

/** For each building a street or path goes through, the corridors to cut out of it. */
function findCuts(buildings: CarvableBuilding[], lines: LineFeature[]): Map<number, Geom[]> {
  const near = index(buildings);
  const cuts = new Map<number, Geom[]>();
  for (const l of lines) {
    if (!OPENS.has(l.kind) || l.bridge || l.pts.length < 2) continue;
    const w = passageWidth(l);
    for (const [i, runs] of runsOf(l.pts, buildings, near)) {
      const b = buildings[i];
      if (b.minHeight > OVERHEAD_M) continue;
      for (const r of runs) {
        if (!goesThrough(r)) continue;
        // a little past the walls on both sides, so the opening is clean
        const part = slice(l.pts, r.s0 - STEP - 1, r.s1 + STEP + 1);
        if (part.length < 2) continue;
        const list = cuts.get(i) ?? [];
        list.push(...band(part, w));
        cuts.set(i, list);
      }
    }
  }
  return cuts;
}

/** One building with its corridors cut out: the solid parts and the roof over the way; null if it can't be cut. */
function cutOne<B extends CarvableBuilding>(b: B, cut: Geom[]): B[] | null {
  let walls: Polygon[];
  let roof: Polygon[];
  try {
    const [first, ...rest] = cut;
    const corridor: MultiPolygon = polygonClipping.union(first, ...rest);
    const whole = toGeom(b.poly);
    walls = fromMulti(polygonClipping.difference(whole, corridor), 0.5);
    roof = fromMulti(polygonClipping.intersection(whole, corridor), 0.5);
  } catch {
    // an outline the clipper rejects stays whole
    return null;
  }
  const out: B[] = walls.map((poly) => ({ ...b, poly }));
  const bottom = Math.max(b.minHeight, PASSAGE_CLEAR_M);
  if (b.height - bottom >= MIN_ROOF_M) for (const poly of roof) out.push({ ...b, poly, minHeight: bottom });
  return out;
}

/**
 * The buildings with the ways through them cut out. A building no street runs through comes back as
 * it was; one with a passage comes back as pieces with the same other fields: the solid parts, and
 * the part over the passage raised to start at `PASSAGE_CLEAR_M`. `opened` lists the buildings cut.
 * With `breathe`, the cutting stops for a frame now and then, so the game doesn't freeze.
 */
export function carvePassages<B extends CarvableBuilding>(buildings: B[], lines: LineFeature[]): { shapes: B[]; opened: Set<number> } {
  const cuts = findCuts(buildings, lines);
  const opened = new Set<number>();
  const shapes: B[] = [];
  buildings.forEach((b, i) => {
    const cut = cuts.get(i);
    const pieces = cut ? cutOne(b, cut) : null;
    if (pieces) opened.add(i);
    shapes.push(...(pieces ?? [b]));
  });
  return { shapes, opened };
}

/** As `carvePassages`, a frame at a time: cutting a few dozen outlines takes some tens of milliseconds. */
export async function carvePassagesInSteps<B extends CarvableBuilding>(buildings: B[], lines: LineFeature[], breathe: () => Promise<void>): Promise<{ shapes: B[]; opened: Set<number> }> {
  const cuts = findCuts(buildings, lines);
  await breathe();
  const done = new Map<number, B[]>();
  let t = performance.now();
  for (const [i, cut] of cuts) {
    const pieces = cutOne(buildings[i], cut);
    if (pieces) done.set(i, pieces);
    if (performance.now() - t > 8) {
      await breathe();
      t = performance.now();
    }
  }
  const shapes: B[] = [];
  buildings.forEach((b, i) => shapes.push(...(done.get(i) ?? [b])));
  return { shapes, opened: new Set(done.keys()) };
}

/**
 * Where there is a roof over the ground: over a passage, or a part of a building that bridges a
 * street. The camera looks straight down, so whoever is under one is drawn on top of it as well.
 */
export class Roofs {
  private readonly near: ReturnType<typeof index>;

  constructor(private readonly roofs: CarvableBuilding[]) {
    this.near = index(roofs);
  }

  over(x: number, y: number): boolean {
    if (!this.roofs.length) return false;
    return this.near(x, y, x, y).some((i) => inside([x, y], this.roofs[i].poly));
  }
}
