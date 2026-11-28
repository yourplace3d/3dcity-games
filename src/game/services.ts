/**
 * Fuel stations, fire stations and police stations, from the map's points of interest. They are
 * marked with a symbol and carry no name, and each kind hands out its own kind of job: a supply
 * run from a fuel station, a rush job from a fire station, a clean run from a police station.
 *
 * Where a part of town has none of a kind on the map, one is made up, so that every place has all
 * three kinds of job. A made-up one stands at a spot worked out from its position on the earth: the
 * same on every visit and for every player. Its symbol has a dashed ring, so the game never claims
 * a station stands where the map has none.
 */

import type { Projector } from '../geo/projection';
import type { LoadedTile } from '../geo/tiles';
import type { RoadNet } from './roads';

export type ServiceKind = 'fuel' | 'fire' | 'police';

export interface Service {
  kind: ServiceKind;
  x: number;
  y: number;
  /** not on the map: made up so that this part of town has one */
  invented?: boolean;
}

/** The job a kind of place hands out. `plain` is a package from a street corner, where no place is near. */
export type JobKind = 'plain' | 'supply' | 'rush' | 'clean';
export const JOB_OF: Record<ServiceKind, JobKind> = { fuel: 'supply', fire: 'rush', police: 'clean' };

/**
 * The most cash a job pays, with everything that comes on top (the owner, 28 November 2026: "Jobs should not
 * pay more than 300 ever... with rents there's already too much money involved"). Open jobs had come to
 * pay about a thousand dollars and more after fifty deliveries, and a clean run 70 % more than that.
 */
export const JOB_MAX = 300;
/**
 * The most an open job's own pay comes to, by kind: a little under `JOB_MAX`, so that what comes on top
 * still shows (time left on any job, three times as much on a rush job, a fifth more for a supply run
 * without a new dent) and a job done well reaches about `JOB_MAX`. The police's clean run still pays
 * best. Estimates, to tune from play.
 */
export const PAY_TOP: Record<JobKind, number> = { plain: 260, supply: 230, rush: 220, clean: 280 };

/** An open job's own pay, from what its way and its kind come to: never more than its kind's top. */
export const openPay = (kind: JobKind, pay: number): number => Math.min(PAY_TOP[kind], pay);

/**
 * What a delivered job is worth: its pay, and on top $2 for each second left on the clock, three times as
 * much on a rush job, and on a supply run a fifth more for a car that took no harm (`whole`). In tens.
 * A run of three counts this as its score.
 */
export function jobWorth(kind: JobKind, pay: number, left: number, whole: boolean): number {
  let bonus = Math.round((left * (kind === 'rush' ? 6 : 2)) / 10) * 10;
  if (kind === 'supply' && whole) bonus += Math.round((pay * 0.2) / 10) * 10;
  return pay + bonus;
}

/** The cash a delivered job pays: what it is worth, and never more than `JOB_MAX`. */
export const jobCash = (worth: number): number => Math.min(JOB_MAX, worth);

/**
 * The colour of a package's ring, by who gives the job, in the colour of the giver's sign: orange at
 * the pump, red at the flame, blue at the badge, turquoise for a plain package from a street corner.
 * A party's food is pink, as its sign. While a home of yours waits for a package (a repair), the
 * stations' rings flash green, the colour of homes in the game (pink was for the party alone, the
 * owner said). Where to deliver is always yellow. All in one colour, the stations' rings took over
 * the screen after a run and could not be told from a plain one (the owner, 24 November).
 */
export const RING: Record<JobKind | 'party' | 'home', string> = { plain: '#2bd4e0', supply: '#ff8a1f', rush: '#ff3b30', clean: '#3d74ff', party: '#ff5cb8', home: '#5fd08a' };
/** Where to deliver: the ring, the arrow and the way there. */
export const DROP = '#ffd400';
/**
 * A ring goes only where a circle this wide is clear of walls and water, about half a car (m): a
 * street the map has running into a building is no place for one (the party's food in Edinburgh lay
 * on North Bridge, where it ran into the roof of the station below, 25 November).
 */
export const RING_CLEAR_M = 1;

/**
 * Where along a street a ring can go, nearest the place asked for: that place, or up to 24 m either
 * way along the street where a car can stand (`RING_CLEAR_M`). A station's spot on its forecourt lane
 * drawn against the kiosk still gets its package, a step along. Null where there is no such place.
 */
export function ringAlong(net: RoadNet, free: (x: number, y: number, r: number) => boolean, line: number, s: number): number | null {
  const len = net.lines[line].len;
  for (let d = 0; d <= 24; d += 2) {
    for (const t of d ? [s + d, s - d] : [s]) {
      if (t < 0 || t > len) continue;
      const [x, y] = net.point(line, t);
      if (free(x, y, RING_CLEAR_M)) return t;
    }
  }
  return null;
}

const KIND: Record<string, ServiceKind> = { fuel: 'fuel', fire_station: 'fire', police: 'police' };

/**
 * Points in a grid of cells, to ask what lies near a spot without going through all of them: a city centre's
 * tiles hold thousands of restaurants, and going through every kept one for every new one took millions of steps.
 */
export class PointGrid<T extends { x: number; y: number }> {
  private readonly cells = new Map<string, T[]>();
  constructor(private readonly cell: number) {}
  add(p: T): void {
    const k = `${Math.floor(p.x / this.cell)},${Math.floor(p.y / this.cell)}`;
    const list = this.cells.get(k);
    if (list) list.push(p);
    else this.cells.set(k, [p]);
  }
  /** Whether a point within `r` (no more than the cell size) passes `test`. */
  near(x: number, y: number, r: number, test: (p: T) => boolean = () => true): boolean {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const p of this.cells.get(`${cx + dx},${cy + dy}`) ?? []) if (Math.hypot(p.x - x, p.y - y) < r && test(p)) return true;
    return false;
  }
}

/** Points of interest of the map tiles, by the map's sub-kind, as metres from the square's middle. */
function readPoints<K extends string>(tiles: LoadedTile[], proj: Projector, half: number, pick: Record<string, K>): Array<{ kind: K; x: number; y: number }> {
  const out: Array<{ kind: K; x: number; y: number }> = [];
  const kept = new PointGrid<{ kind: K; x: number; y: number }>(40);
  for (const t of tiles) {
    const layer = t.tile.layers.poi;
    if (!layer) continue;
    const n = 2 ** t.z;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type !== 1) continue;
      // by the map's sub-kind: its "fuel" class holds charging points for electric cars too
      const kind = pick[String(f.properties.subclass ?? '')];
      if (!kind) continue;
      const pt = f.loadGeometry()[0]?.[0];
      // points near a tile's edge are repeated in its neighbours
      if (!pt || pt.x < 0 || pt.y < 0 || pt.x >= layer.extent || pt.y >= layer.extent) continue;
      const lon = ((t.x + pt.x / layer.extent) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
      const [x, y] = proj.toLocal(lon, lat);
      if (Math.abs(x) > half || Math.abs(y) > half) continue;
      // one mark for a place mapped twice (the building and its entrance, say)
      if (kept.near(x, y, 40, (o) => o.kind === kind)) continue;
      const p = { kind, x, y };
      out.push(p);
      kept.add(p);
    }
  }
  return out;
}

export function readServices(tiles: LoadedTile[], proj: Projector, half: number): Service[] {
  return readPoints(tiles, proj, half, KIND);
}

/** A bank: where savings are paid in, in the player's home town. Marked with a symbol, never named. */
export interface Bank {
  kind: 'bank';
  x: number;
  y: number;
  invented?: boolean;
}

export function readBanks(tiles: LoadedTile[], proj: Projector, half: number): Bank[] {
  return readPoints(tiles, proj, half, { bank: 'bank' as const });
}

/**
 * A garage: where cars are kept (`game/garage.ts`; the owner, 28 November 2026). From the map's car dealers
 * and repair garages, and made up where a part of town has neither, as the stations are. Marked with a
 * symbol, never named.
 */
export interface GaragePlace {
  kind: 'garage';
  x: number;
  y: number;
  invented?: boolean;
}

export function readGarages(tiles: LoadedTile[], proj: Projector, half: number): GaragePlace[] {
  return readPoints(tiles, proj, half, { car: 'garage' as const, car_repair: 'garage' as const });
}

/** Where a party's food comes from: a restaurant (or fast food) for the pizza, a supermarket (or corner shop) for drinks and snacks. */
export type FoodKind = 'restaurant' | 'shop';

/**
 * A place to fetch food for a party (`game/party.ts`). Marked with a symbol and never named, like the
 * stations (the owner, 14 November: restaurants and supermarkets may serve as mission places, without
 * names). Not drawn by the world: only the one a party run uses is put up.
 */
export interface FoodPlace {
  kind: 'food';
  food: FoodKind;
  x: number;
  y: number;
  invented?: boolean;
}

const FOOD: Record<string, FoodKind> = { restaurant: 'restaurant', fast_food: 'restaurant', supermarket: 'shop', convenience: 'shop' };

export function readFood(tiles: LoadedTile[], proj: Projector, half: number): FoodPlace[] {
  return readPoints(tiles, proj, half, FOOD).map((p) => ({ kind: 'food' as const, food: p.kind, x: p.x, y: p.y }));
}

/** Kinds of place the game leaves alone: never named, and for an add-on never for sale. */
const RESERVED = new Set(['school', 'kindergarten', 'college', 'university', 'place_of_worship', 'hospital', 'clinic', 'cemetery', 'grave_yard', 'prison', 'embassy', 'diplomatic']);

/** Where such places lie in a square, by the map. The game itself draws nothing for them. */
export function readReserved(tiles: LoadedTile[], proj: Projector, half: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const t of tiles) {
    const layer = t.tile.layers.poi;
    if (!layer) continue;
    const n = 2 ** t.z;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type !== 1) continue;
      if (!RESERVED.has(String(f.properties.subclass ?? '')) && !RESERVED.has(String(f.properties.class ?? ''))) continue;
      const pt = f.loadGeometry()[0]?.[0];
      if (!pt || pt.x < 0 || pt.y < 0 || pt.x >= layer.extent || pt.y >= layer.extent) continue;
      const lon = ((t.x + pt.x / layer.extent) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
      const [x, y] = proj.toLocal(lon, lat);
      if (Math.abs(x) <= half && Math.abs(y) <= half) out.push({ x, y });
    }
  }
  return out;
}

function hash(a: number, b: number, c: number): number {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b) ^ Math.imul(c, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export type PlaceKind = ServiceKind | 'bank' | 'food' | 'garage';
// a new kind goes at the end: each kind's made-up spots are worked out from its place in this list
const ORDER: PlaceKind[] = ['fuel', 'fire', 'police', 'bank', 'food', 'garage'];

/** A cell of the earth about 1.2 km across holds one made-up place of each kind, unless a real one is near. */
const CELL_DEG = 0.011;
/** a real place of the kind this near (m) and none is made up */
const REAL_NEAR = 450;

/**
 * The made-up places a square needs. `real` is every real one in the loaded map, also those just
 * outside the square, so that the answer is the same from whichever square a spot is looked at.
 */
export function inventServices<K extends PlaceKind = ServiceKind>(
  real: Array<{ kind: K; x: number; y: number }>,
  proj: Projector,
  half: number,
  roads: RoadNet,
  kinds: K[] = ['fuel', 'fire', 'police'] as K[],
): Array<{ kind: K; x: number; y: number; invented: true }> {
  const out: Array<{ kind: K; x: number; y: number; invented: true }> = [];
  const sw = proj.toLngLat(-half, -half);
  const ne = proj.toLngLat(half, half);
  for (let row = Math.floor(sw.lat / CELL_DEG); row <= Math.floor(ne.lat / CELL_DEG); row++) {
    // cells as wide as they are tall, whatever the latitude
    const lonStep = CELL_DEG / Math.max(0.2, Math.cos((((row + 0.5) * CELL_DEG) * Math.PI) / 180));
    for (let col = Math.floor(sw.lon / lonStep); col <= Math.floor(ne.lon / lonStep); col++) {
      for (const kind of kinds) {
        // each kind its own numbers, the same whichever kinds are asked for
        const k = ORDER.indexOf(kind);
        const lat = (row + 0.15 + 0.7 * hash(row, col, k * 2 + 1)) * CELL_DEG;
        const lon = (col + 0.15 + 0.7 * hash(row, col, k * 2 + 2)) * lonStep;
        const [x, y] = proj.toLocal(lon, lat);
        if (Math.abs(x) > half - 40 || Math.abs(y) > half - 40) continue;
        if (real.some((r) => r.kind === kind && Math.hypot(r.x - x, r.y - y) < REAL_NEAR)) continue;
        // beside a street a car can reach
        const n = roads.nearest(x, y, 240, 'traffic');
        if (!n) continue;
        const [rx, ry] = roads.point(n.line, n.s);
        const [hx, hy] = roads.heading({ line: n.line, s: n.s, dir: 1 });
        const side = roads.lines[n.line].w / 2 + 7;
        out.push({ kind, x: rx + hy * side, y: ry - hx * side, invented: true });
      }
    }
  }
  return out;
}

const icons = new Map<string, HTMLCanvasElement>();

/** The symbol of a kind of place: a round sign, 128 px, drawn once. A made-up place has a dashed ring. */
export function serviceIcon(kind: Exclude<PlaceKind, 'food'> | FoodKind, invented = false): HTMLCanvasElement {
  const had = icons.get(kind + invented);
  if (had) return had;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const disc = (fill: string) => {
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fillStyle = '#16181c';
    g.fill();
    g.beginPath();
    g.arc(64, 64, 50, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  if (kind === 'fuel') {
    // a pump: a box with a window, and the hose at its side
    disc('#e8862e');
    g.fillStyle = '#16181c';
    g.fillRect(38, 34, 34, 58);
    g.fillRect(32, 90, 46, 8);
    g.fillStyle = '#f4f1ea';
    g.fillRect(44, 41, 22, 16);
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.strokeStyle = '#16181c';
    g.beginPath();
    g.moveTo(72, 56);
    g.lineTo(88, 56);
    g.lineTo(88, 84);
    g.stroke();
  } else if (kind === 'fire') {
    // a flame
    disc('#f4f1ea');
    g.fillStyle = '#d8362e';
    g.beginPath();
    g.moveTo(64, 24);
    g.bezierCurveTo(70, 46, 94, 54, 90, 80);
    g.bezierCurveTo(88, 96, 76, 104, 64, 104);
    g.bezierCurveTo(52, 104, 40, 96, 38, 80);
    g.bezierCurveTo(36, 66, 46, 60, 50, 50);
    g.bezierCurveTo(54, 58, 58, 60, 60, 56);
    g.bezierCurveTo(64, 46, 60, 34, 64, 24);
    g.fill();
    g.fillStyle = '#ffd400';
    g.beginPath();
    g.moveTo(64, 66);
    g.bezierCurveTo(72, 76, 78, 82, 74, 92);
    g.bezierCurveTo(72, 99, 56, 99, 54, 92);
    g.bezierCurveTo(51, 82, 60, 78, 64, 66);
    g.fill();
  } else if (kind === 'restaurant') {
    // a fork and a knife
    disc('#d8457f');
    g.fillStyle = '#f4f1ea';
    g.fillRect(46, 30, 5, 22);
    g.fillRect(55, 30, 5, 22);
    g.fillRect(37, 30, 5, 22);
    g.beginPath();
    g.moveTo(37, 50);
    g.lineTo(60, 50);
    g.bezierCurveTo(60, 60, 54, 64, 52, 64);
    g.lineTo(45, 64);
    g.bezierCurveTo(43, 64, 37, 60, 37, 50);
    g.fill();
    g.fillRect(44, 62, 9, 38);
    g.beginPath();
    g.moveTo(76, 100);
    g.lineTo(76, 30);
    g.bezierCurveTo(90, 36, 92, 56, 88, 70);
    g.lineTo(84, 70);
    g.lineTo(84, 100);
    g.closePath();
    g.fill();
  } else if (kind === 'shop') {
    // a shopping basket
    disc('#d8457f');
    g.strokeStyle = '#f4f1ea';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(64, 58, 20, Math.PI, 0);
    g.stroke();
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.moveTo(30, 56);
    g.lineTo(98, 56);
    g.lineTo(90, 96);
    g.lineTo(38, 96);
    g.closePath();
    g.fill();
    g.fillStyle = '#d8457f';
    for (const cx of [50, 64, 78]) g.fillRect(cx - 3, 64, 6, 24);
  } else if (kind === 'bank') {
    // a bank: a roof over three columns, on a step
    disc('#6a4fc2');
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.moveTo(64, 26);
    g.lineTo(98, 46);
    g.lineTo(30, 46);
    g.closePath();
    g.fill();
    g.fillRect(32, 49, 64, 6);
    for (const cx of [38, 59, 80]) g.fillRect(cx, 58, 10, 28);
    g.fillRect(30, 89, 68, 9);
  } else if (kind === 'garage') {
    // a garage: a car under a roof, on steel grey, a colour no other sign has
    disc('#b9c2cc');
    g.fillStyle = '#16181c';
    // the roof: a low gable on two posts
    g.beginPath();
    g.moveTo(64, 22);
    g.lineTo(104, 44);
    g.lineTo(98, 53);
    g.lineTo(64, 34);
    g.lineTo(30, 53);
    g.lineTo(24, 44);
    g.closePath();
    g.fill();
    g.fillRect(28, 48, 8, 46);
    g.fillRect(92, 48, 8, 46);
    // the car, from the front: a cab on a body, two lamps, two wheels
    g.beginPath();
    g.moveTo(50, 58);
    g.lineTo(78, 58);
    g.lineTo(84, 72);
    g.lineTo(84, 90);
    g.lineTo(44, 90);
    g.lineTo(44, 72);
    g.closePath();
    g.fill();
    g.fillRect(46, 88, 9, 10);
    g.fillRect(73, 88, 9, 10);
    g.fillStyle = '#b9c2cc';
    g.beginPath();
    g.moveTo(53, 62);
    g.lineTo(75, 62);
    g.lineTo(78, 70);
    g.lineTo(50, 70);
    g.closePath();
    g.fill();
    g.fillRect(48, 76, 8, 6);
    g.fillRect(72, 76, 8, 6);
  } else {
    // a badge
    disc('#1f4fa8');
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.moveTo(64, 28);
    g.lineTo(92, 38);
    g.lineTo(92, 64);
    g.bezierCurveTo(92, 84, 78, 96, 64, 102);
    g.bezierCurveTo(50, 96, 36, 84, 36, 64);
    g.lineTo(36, 38);
    g.closePath();
    g.fill();
    g.fillStyle = '#1f4fa8';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 7 : 17;
      g.lineTo(64 + Math.cos(a) * r, 62 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }
  if (invented) {
    g.setLineDash([15, 11]);
    g.lineWidth = 9;
    g.strokeStyle = '#f4f1ea';
    g.beginPath();
    g.arc(64, 64, 55, 0, Math.PI * 2);
    g.stroke();
  }
  icons.set(kind + invented, c);
  return c;
}
