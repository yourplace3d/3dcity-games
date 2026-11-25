/**
 * Ways through buildings: archways, gateways into courtyards, streets under a house, gates in a town
 * wall. The map draws such a building as one whole block, so on its own it would wall the street
 * off. Here a corridor along the street is cut out of the building at ground level: the walls on
 * either side stay solid, and the floors above stay as a roof you pass beneath (`Solids` skips parts
 * that start above head height). A low building, a gate or a wall, is cut open to the sky.
 *
 * A street wide enough for a car gets a corridor a car fits through; a footpath one wide enough to
 * walk, and for a small car to squeeze through.
 *
 * A bridge over a building is the other way round: the map has the building below the bridge (North
 * Bridge in Edinburgh over the roof of Waverley station), but the game lays every street on the
 * ground, so the building stood across it like a wall (the owner, 25 November). Where the ground
 * under a bridge lies well below the line between its two ends, the bridge is up in the air there,
 * and what it crosses is cut away along its deck, open to the sky: from above the street crosses the
 * roof, as it does on a photo from the air. Only street bridges do it, and the pavements beside
 * them; a footbridge on its own, often a walkway from house to house, leaves the houses as before.
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
/** a bridge is up in the air where the ground under it lies this far below its deck (m): a storey */
export const BRIDGE_OVER_M = 3;
/** how far a bridge's deck reaches past its way on either side (m): the pavement, the parapet */
const DECK_SIDE_M = 2;
/** how far from the middle of a street bridge a footpath bridge may run and still be its pavement (m) */
const PAVEMENT_M = 14;

/** The height of the ground at a point, as the game lays it (m). */
export type GroundAt = (x: number, y: number) => number;

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

/** A point `d` on past the end of a line (its last point), straight on from a metre or so before it. */
function beyond(pts: Pt[], d: number): Pt | null {
  const b = pts[pts.length - 1];
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // a point a hair's breadth before the end gives no way to go on
    if (len >= 1 || (i === 0 && len > 1e-3)) return [b[0] + ((b[0] - a[0]) / len) * d, b[1] + ((b[1] - a[1]) / len) * d];
  }
  return null;
}

/**
 * The part of a line between two arc lengths. With `past`, carried on straight past the line's ends
 * where they lie outside it: a bridge that starts right on a building's wall left a sliver of the
 * building across the street, thinner than a hair and as tall as the building, and a car stopped at
 * it. (Not for passages: their corridors stay as they were, and some outlines in Hong Kong could no
 * longer be cut with the longer ones.)
 */
function slice(pts: Pt[], s0: number, s1: number, past = false): Pt[] {
  const out: Pt[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
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
  if (past && out.length >= 2) {
    const before = s0 < 0 ? beyond([...pts].reverse(), -s0) : null;
    const after = s1 > total ? beyond(pts, s1 - total) : null;
    if (before) out.unshift(before);
    if (after) out.push(after);
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

/** What is cut out of one building: corridors under a roof, and the way under a bridge, open to the sky. */
interface Cut {
  roofed: Geom[];
  open: Geom[];
}

/** A bridge, as far as the game can tell how high it is. */
interface Deck {
  pts: Pt[];
  /** samples along the line, with their arc length */
  along: Array<{ p: Pt; s: number }>;
  len: number;
  /** the height of the deck at a point, from the heights where the whole bridge meets the ground */
  deckAt: (p: Pt) => number;
  /** which of the line's two ends are where the whole bridge meets the ground */
  ends: [boolean, boolean];
  /** the whole bridge it is a piece of */
  whole: number;
}

/** how near the ends of two bridge lines lie when they are one bridge cut in pieces (m) */
const JOIN_M = 1;

/**
 * Bridges joined whole where the ends of their pieces meet: the map often cuts a bridge in pieces,
 * and the tiles cut every line at their edges, and a piece with both ends over the valley sees no drop
 * under the line between them. The deck's height at a point comes from the heights where the whole
 * bridge meets the ground, the nearer such end counting more: between two ends, along the straight
 * line from one to the other.
 */
function wholeBridges(lines: LineFeature[], ground: GroundAt): Deck[] {
  const parent = lines.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const endsOf = (l: LineFeature): [Pt, Pt] => [l.pts[0], l.pts[l.pts.length - 1]];
  const cellKey = (x: number, y: number) => `${Math.floor(x / JOIN_M)},${Math.floor(y / JOIN_M)}`;
  const cells = new Map<string, Array<[number, number]>>();
  lines.forEach((l, i) =>
    endsOf(l).forEach((p, e) => {
      const k = cellKey(p[0], p[1]);
      const list = cells.get(k);
      if (list) list.push([i, e]);
      else cells.set(k, [[i, e]]);
    }),
  );
  const joined = lines.map((): [boolean, boolean] => [false, false]);
  lines.forEach((l, i) =>
    endsOf(l).forEach((p, e) => {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          for (const [j, f] of cells.get(cellKey(p[0] + dx * JOIN_M, p[1] + dy * JOIN_M)) ?? []) {
            if (j === i) continue;
            const q = endsOf(lines[j])[f];
            if (Math.hypot(q[0] - p[0], q[1] - p[1]) > JOIN_M) continue;
            joined[i][e] = true;
            parent[find(i)] = find(j);
          }
    }),
  );
  const feet = new Map<number, Array<{ p: Pt; h: number }>>();
  lines.forEach((l, i) =>
    endsOf(l).forEach((p, e) => {
      if (joined[i][e]) return;
      const g = find(i);
      const list = feet.get(g) ?? [];
      list.push({ p, h: ground(p[0], p[1]) });
      feet.set(g, list);
    }),
  );
  return lines.map((l, i) => {
    const along = samples(l.pts);
    // a bridge that is a ring, with no end on the ground, is never up in the air
    const at = feet.get(find(i)) ?? [];
    const deckAt = (p: Pt) => {
      let w = 0;
      let h = 0;
      for (const f of at) {
        const d = Math.max(Math.hypot(f.p[0] - p[0], f.p[1] - p[1]), 0.5);
        w += 1 / d;
        h += f.h / d;
      }
      return w ? h / w : -Infinity;
    };
    return { pts: l.pts, along, len: along.length ? along[along.length - 1].s : 0, deckAt, ends: [!joined[i][0], !joined[i][1]], whole: find(i) };
  });
}

/** Whether a bridge is up in the air between two arc lengths: the ground lies `BRIDGE_OVER_M` or more below its deck somewhere there. */
function overGround(d: Deck, s0: number, s1: number, ground: GroundAt): boolean {
  for (const { p, s } of d.along) {
    if (s < s0 || s > s1) continue;
    if (d.deckAt(p) - ground(p[0], p[1]) >= BRIDGE_OVER_M) return true;
  }
  return false;
}

/**
 * Whether a bridge up in the air somewhere opens a building it runs into: whatever it crosses between
 * its ends, as the heights are known only every 8 m or so, and near the ends of North Bridge they
 * showed the ground only 2 m down, under a building of 4 m that then stood across the street. Where
 * the bridge ends on the ground inside a building it must be up in the air in there itself, as a
 * building at the end of a bridge stands on the bank.
 */
function bridgeOpens(d: Deck, r: Run, ground: GroundAt): boolean {
  const atEnd = (r.s0 < STEP && d.ends[0]) || (r.s1 > d.len - STEP && d.ends[1]);
  return atEnd ? overGround(d, r.s0, r.s1, ground) : true;
}

/** The distance from a point to a polyline. */
function distTo(p: Pt, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx - p[0], ay + t * dy - p[1]));
  }
  return best;
}

/** Whether a footpath runs beside one of the street bridges, nearly all the way: it is its pavement. */
function besideDeck(walk: Deck, decks: Array<{ deck: Deck; box: [number, number, number, number] }>): boolean {
  const [x0, y0, x1, y1] = ringBounds(walk.pts);
  const near = decks.filter(({ box }) => x1 >= box[0] && x0 <= box[2] && y1 >= box[1] && y0 <= box[3]);
  if (!near.length) return false;
  let beside = 0;
  for (const { p } of walk.along) {
    if (near.some(({ deck, box }) => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3] && distTo(p, deck.pts) <= PAVEMENT_M)) beside++;
  }
  return beside >= walk.along.length * 0.8;
}

/**
 * For each building a street or path goes through, the corridors to cut out of it. A bridge opens
 * buildings only where it is a street, up in the air, or the pavement beside one, and the pavement only
 * what its street opens: the walkways from house to house over the streets of Minneapolis, Calgary and
 * Hong Kong are footpath bridges too, and in Hong Kong, on the slopes, some lie 4 m over the line
 * between their ends: they would cut towers of 60 m open to the sky.
 */
function findCuts(buildings: CarvableBuilding[], lines: LineFeature[], ground?: GroundAt): Map<number, Cut> {
  const near = index(buildings);
  const cuts = new Map<number, Cut>();
  const cutRuns = (l: LineFeature, open: Deck | null, only?: Set<number>): Set<number> => {
    const w = passageWidth(l);
    const opened = new Set<number>();
    for (const [i, runs] of runsOf(l.pts, buildings, near)) {
      const b = buildings[i];
      if (b.minHeight > OVERHEAD_M || (only && !only.has(i))) continue;
      for (const r of runs) {
        if (!goesThrough(r)) continue;
        if (open && !bridgeOpens(open, r, ground!)) continue;
        // a little past the walls on both sides, so the opening is clean
        const part = slice(l.pts, r.s0 - STEP - 1, r.s1 + STEP + 1, !!open);
        if (part.length < 2) continue;
        const cut = cuts.get(i) ?? { roofed: [], open: [] };
        // under a bridge, its whole deck: a strip of the building left standing between a street and
        // its pavement, a line of its own, was a wall along the bridge
        if (open) cut.open.push(...band(part, w + 2 * DECK_SIDE_M));
        else cut.roofed.push(...band(part, w));
        cuts.set(i, cut);
        opened.add(i);
      }
    }
    return opened;
  };
  for (const l of lines) if (OPENS.has(l.kind) && !l.bridge && l.pts.length >= 2) cutRuns(l, null);
  if (!ground) return cuts;
  const streets = lines.filter((l) => OPENS.has(l.kind) && l.kind !== 'path' && l.bridge && l.pts.length >= 2);
  const up: Array<{ deck: Deck; box: [number, number, number, number] }> = [];
  const underStreets = new Set<number>();
  const decks = wholeBridges(streets, ground);
  // a whole bridge is up in the air if it is anywhere, though not every piece of it is
  const high = new Set(decks.filter((d) => overGround(d, 0, d.len, ground)).map((d) => d.whole));
  decks.forEach((deck, k) => {
    if (!high.has(deck.whole)) return;
    const [x0, y0, x1, y1] = ringBounds(deck.pts);
    up.push({ deck, box: [x0 - PAVEMENT_M, y0 - PAVEMENT_M, x1 + PAVEMENT_M, y1 + PAVEMENT_M] });
    for (const i of cutRuns(streets[k], deck)) underStreets.add(i);
  });
  // the pavements, once the streets up in the air are known
  if (up.length) {
    const walks = lines.filter((l) => l.kind === 'path' && l.bridge && l.pts.length >= 2);
    wholeBridges(walks, ground).forEach((walk, k) => {
      if (besideDeck(walk, up)) cutRuns(walks[k], walk, underStreets);
    });
  }
  return cuts;
}

const unite = (geoms: Geom[]): MultiPolygon => polygonClipping.union(geoms[0], ...geoms.slice(1));

/**
 * One building with its corridors cut out: the solid parts and the roof over the way; null if it
 * can't be cut. Where the clipper rejects the cut under a bridge, the passages are cut as before.
 */
function cutOne<B extends CarvableBuilding>(b: B, cut: Cut): B[] | null {
  const pieces = cutAll(b, cut);
  return pieces || !cut.open.length || !cut.roofed.length ? pieces : cutAll(b, { roofed: cut.roofed, open: [] });
}

function cutAll<B extends CarvableBuilding>(b: B, cut: Cut): B[] | null {
  let walls: Polygon[];
  let roof: Polygon[];
  try {
    const whole = toGeom(b.poly);
    walls = fromMulti(polygonClipping.difference(whole, unite([...cut.roofed, ...cut.open])), 0.5);
    // the roof over a passage, but none where a bridge runs over it as well
    let over: MultiPolygon = cut.roofed.length ? polygonClipping.intersection(whole, unite(cut.roofed)) : [];
    if (over.length && cut.open.length) over = polygonClipping.difference(over, unite(cut.open));
    roof = fromMulti(over, 0.5);
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
 * With `ground`, a bridge up in the air cuts away what it crosses; without it bridges cut nothing.
 * With `breathe`, the cutting stops for a frame now and then, so the game doesn't freeze.
 */
export function carvePassages<B extends CarvableBuilding>(buildings: B[], lines: LineFeature[], ground?: GroundAt): { shapes: B[]; opened: Set<number> } {
  const cuts = findCuts(buildings, lines, ground);
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
export async function carvePassagesInSteps<B extends CarvableBuilding>(buildings: B[], lines: LineFeature[], breathe: () => Promise<void>, ground?: GroundAt): Promise<{ shapes: B[]; opened: Set<number> }> {
  const cuts = findCuts(buildings, lines, ground);
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
