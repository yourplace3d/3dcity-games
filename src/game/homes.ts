/**
 * Homes: flats and houses the player can buy with the cash from deliveries. They pay rent once for
 * each day the player comes back: on the first visit of a calendar day, the same however long they
 * were away. Nothing comes in while playing, and a day missed is not made up.
 *
 * Each player owns their own copy of the city: two players can own the same flat. What is owned is
 * kept in the browser under `3da-homes`, beside the cash, so saving online carries it along.
 *
 * Which buildings are for sale, and for how much, comes from the map alone, so that it works in
 * any town:
 * - A building of three floors or more with room for several flats is split into flats: one can
 *   be bought, or the whole building. A smaller one is a house, bought whole. Sheds, garages and
 *   big low halls (shops, factories, gyms) are not for sale, nor anything at a sight, a school,
 *   a place of worship or a station the game marks.
 * - The price of a spot is guessed from what is around it: a dense part of town, a park or water
 *   close by, a well-known sight raise it; a big road or a railway outside and a district of halls
 *   lower it. The spots are then ranked within the square, so every town has its cheap and its
 *   dear streets, and the cheapest flats cost about what one run of three deliveries pays.
 * The price says nothing about the real place: it is a game's guess from the shape of the map.
 */

import type { Pt, Polygon } from '../geo/polygon';
import type { AreaFeature, LineFeature } from '../geo/osm';

/** what one flat of 70 m² costs where the spot is average */
const FLAT_BASE = 900;
const FLAT_M2 = 70;
/** rent for each day one comes back, as a share of what was paid: a home pays for itself in about four visits */
export const RENT_PER_VISIT = 0.24;
const STORE = '3da-homes';

export type LotKind = 'flats' | 'house';

/** A building that is for sale. */
export interface Lot {
  /** the map's number for the building; '' where the tiles gave none */
  id: string;
  /** its middle, metres east and north of the square's middle */
  x: number;
  y: number;
  poly: Polygon;
  kind: LotKind;
  floors: number;
  /** flats in it; 1 for a house */
  units: number;
  /** one flat (for a house: the house) */
  price: number;
  /** the whole building */
  whole: number;
  /** the street it stands on, where the map names one near enough */
  street: string;
  /** flats in what looks like a house: where a place has hardly any blocks of flats */
  inHouse?: boolean;
}

export interface LotBuilding {
  poly: Polygon;
  /** metres, as the map gives it (roof included) */
  height: number;
  id?: string;
}

/** What the guess of a spot's worth looks at. */
export interface Surroundings {
  areas: AreaFeature[];
  lines: LineFeature[];
  /** sights, stations the game marks, schools and the like: nothing near them is for sale */
  keepClear: Pt[];
  /** well-known sights: they raise the worth of what is around them */
  sights: Pt[];
  streets: Array<{ name: string; pts: Pt[] }>;
  /** half the square's side (m) */
  half: number;
}

export function ringArea(r: Pt[]): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a) / 2;
}

function middle(r: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of r) {
    x += p[0];
    y += p[1];
  }
  return [x / r.length, y / r.length];
}

/** a number from 0 to 1 that is always the same for one building, so prices don't end in round hundreds everywhere */
function wobble(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Prices a player reads: two figures that matter, the rest zeros ($780, $4,300, $18,000). */
export function roundPrice(v: number): number {
  const step = v < 1000 ? 10 : v < 10000 ? 100 : 1000;
  return Math.max(step, Math.round(v / step) * step);
}

/** A coarse grid over the square that counts what lies in each cell. */
class Grid {
  readonly n: number;
  readonly cells: Float32Array;
  constructor(
    readonly half: number,
    readonly cell: number,
  ) {
    this.n = Math.ceil((2 * half) / cell);
    this.cells = new Float32Array(this.n * this.n);
  }
  index(x: number, y: number): number {
    const i = Math.floor((x + this.half) / this.cell);
    const j = Math.floor((y + this.half) / this.cell);
    return i < 0 || j < 0 || i >= this.n || j >= this.n ? -1 : j * this.n + i;
  }
  add(x: number, y: number, v = 1): void {
    const k = this.index(x, y);
    if (k >= 0) this.cells[k] += v;
  }
  /** along a line, a point every `step` metres */
  addLine(pts: Pt[], step: number, v = 1): void {
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1];
      const [bx, by] = pts[k];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let s = 0; s < n; s++) this.add(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, v);
    }
  }
  private sums: Float64Array | null = null;
  /** the sum over the cells of the square of side 2r around a point (a summed-area table: quick for any r) */
  around(x: number, y: number, r: number): number {
    const n = this.n;
    if (!this.sums) {
      // sums[(j+1)*(n+1)+(i+1)] = everything in cells [0..i]×[0..j]
      const t = new Float64Array((n + 1) * (n + 1));
      for (let j = 0; j < n; j++) {
        let row = 0;
        for (let i = 0; i < n; i++) {
          row += this.cells[j * n + i];
          t[(j + 1) * (n + 1) + i + 1] = t[j * (n + 1) + i + 1] + row;
        }
      }
      this.sums = t;
    }
    const clampI = (v: number) => Math.max(0, Math.min(n, v));
    const i0 = clampI(Math.floor((x - r + this.half) / this.cell));
    const i1 = clampI(Math.floor((x + r + this.half) / this.cell) + 1);
    const j0 = clampI(Math.floor((y - r + this.half) / this.cell));
    const j1 = clampI(Math.floor((y + r + this.half) / this.cell) + 1);
    const t = this.sums;
    const w = n + 1;
    return t[j1 * w + i1] - t[j0 * w + i1] - t[j1 * w + i0] + t[j0 * w + i0];
  }
}

/** The named street pieces, sorted into 60 m cells, to say quickly which street a building stands on. */
class StreetIndex {
  private readonly cells = new Map<string, Array<[number, number, number, number, string]>>();
  constructor(streets: Surroundings['streets']) {
    for (const st of streets) {
      for (let k = 1; k < st.pts.length; k++) {
        const [ax, ay] = st.pts[k - 1];
        const [bx, by] = st.pts[k];
        const seg: [number, number, number, number, string] = [ax, ay, bx, by, st.name];
        for (let i = Math.floor(Math.min(ax, bx) / 60); i <= Math.floor(Math.max(ax, bx) / 60); i++) {
          for (let j = Math.floor(Math.min(ay, by) / 60); j <= Math.floor(Math.max(ay, by) / 60); j++) {
            const key = `${i},${j}`;
            const list = this.cells.get(key);
            if (list) list.push(seg);
            else this.cells.set(key, [seg]);
          }
        }
      }
    }
  }
  /** the name of the nearest street piece within 60 m, or '' */
  nearest(x: number, y: number): string {
    let best = 60;
    let name = '';
    const i0 = Math.floor(x / 60);
    const j0 = Math.floor(y / 60);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        for (const [ax, ay, bx, by, n] of this.cells.get(`${i},${j}`) ?? []) {
          const dx = bx - ax;
          const dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
          if (d < best) {
            best = d;
            name = n;
          }
        }
      }
    }
    return name;
  }
}

/** How far a point is from a building: 0 inside it. */
export function edgeDistance(r: Pt[], x: number, y: number): number {
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, ay] = r[j];
    const [bx, by] = r[i];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return inside ? 0 : best;
}

/** How many floors a building of this height has: 3.5 m each, as the height includes the roof. */
export function floorsOf(height: number): number {
  return Math.max(1, Math.round(height / 3.5));
}

/** What kind of lot a building is, or null where it is not for sale. */
export function lotKind(area: number, floors: number): { kind: LotKind; units: number } | null {
  if (area < 35) return null; // a shed or a garage
  if (floors >= 3 && area >= 80) return { kind: 'flats', units: Math.min(400, Math.max(2, Math.round((area * floors * 0.8) / FLAT_M2))) };
  if (area <= 300) return { kind: 'house', units: 1 };
  return null; // a big low hall
}

/** The buildings of a square that are for sale, with their prices. */
export function findLots(buildings: LotBuilding[], around: Surroundings): Lot[] {
  const { half } = around;
  const built = new Grid(half, 25);
  const halls = new Grid(half, 25);
  for (const b of buildings) {
    const a = ringArea(b.poly.outer);
    const [x, y] = middle(b.poly.outer);
    built.add(x, y, a);
    if (a > 1500 && floorsOf(b.height) <= 2) halls.add(x, y, a);
  }
  const green = new Grid(half, 25);
  const water = new Grid(half, 25);
  for (const f of around.areas) {
    const g = f.kind === 'water' ? water : f.kind === 'green' || f.kind === 'forest' ? green : null;
    if (!g) continue;
    for (const p of f.polys) g.addLine([...p.outer, p.outer[0]], 15);
  }
  const loud = new Grid(half, 25);
  for (const l of around.lines) {
    const v = l.kind === 'motorway' ? 3 : l.kind === 'primary' ? 1.5 : l.kind === 'rail' ? 2 : 0;
    if (v) loud.addLine(l.pts, 10, v);
  }
  const sights = new Grid(half, 50);
  for (const [x, y] of around.sights) sights.add(x, y);

  const lots: Array<Lot & { worth: number }> = [];
  for (const b of buildings) {
    const area = ringArea(b.poly.outer) - b.poly.holes.reduce((s, h) => s + ringArea(h), 0);
    const floors = floorsOf(b.height);
    const kind = lotKind(area, floors);
    if (!kind) continue;
    // a tower: of a church, a castle, a town hall; or a chimney
    if (b.height > 25 && b.height / Math.sqrt(area) > 1.9) continue;
    const [x, y] = middle(b.poly.outer);
    if (Math.abs(x) > half - 10 || Math.abs(y) > half - 10) continue;
    // a sight or a school is a point somewhere on or beside its building, which may be big
    if (around.keepClear.some(([px, py]) => Math.hypot(px - x, py - y) < 40 || (Math.hypot(px - x, py - y) < 200 && edgeDistance(b.poly.outer, px, py) < 20))) continue;
    // how much of the ground within about 200 m is built on (0 to about 0.6)
    const dense = built.around(x, y, 200) / (400 * 400);
    const worth =
      2.2 * Math.min(dense, 0.6) +
      (green.around(x, y, 120) > 0 ? 0.35 : 0) +
      (water.around(x, y, 150) > 0 ? 0.45 : 0) +
      Math.min(sights.around(x, y, 500), 3) * 0.2 -
      (loud.around(x, y, 30) > 0 ? 0.45 : 0) -
      Math.min(halls.around(x, y, 200) / (400 * 400), 0.3) * 2 +
      wobble(b.id || `${Math.round(x)},${Math.round(y)}`) * 0.15;
    lots.push({ id: b.id ?? '', x, y, poly: b.poly, ...kind, floors, price: 0, whole: 0, street: '', worth });
  }
  // A village has houses and hardly a block of flats: its bigger houses then hold flats, as many
  // do, so that a first home is in reach there too.
  if (lots.filter((l) => l.kind === 'flats').length < 10) {
    for (const l of lots) {
      const space = ringArea(l.poly.outer) * l.floors;
      if (l.kind === 'house' && space >= 160) Object.assign(l, { kind: 'flats', units: Math.max(2, Math.round((space * 0.8) / FLAT_M2)), inHouse: true });
    }
  }
  // ranked within the square: from 0.75 times the base to 3 times
  const order = [...lots].sort((a, b) => a.worth - b.worth);
  order.forEach((l, i) => {
    const rank = order.length > 1 ? i / (order.length - 1) : 0.5;
    const factor = 0.75 * 4 ** rank;
    const flat = FLAT_BASE * factor * (0.92 + wobble(`${l.id}p`) * 0.16);
    if (l.kind === 'flats') {
      l.price = roundPrice(flat);
      l.whole = roundPrice(flat * l.units);
    } else {
      // a house: its floor space in flats, a little dearer for having it to oneself
      const size = Math.max(1, (ringArea(l.poly.outer) * l.floors) / FLAT_M2);
      l.price = l.whole = roundPrice(flat * size * 1.2);
    }
  });
  const streets = new StreetIndex(around.streets);
  for (const l of lots) l.street = streets.nearest(l.x, l.y);
  return lots.map(({ worth: _w, ...l }) => l);
}

// ---------------------------------------------------------------- what the player owns

export interface Home {
  /** the map's number for the building; '' where there was none */
  id: string;
  lat: number;
  lon: number;
  /** a flat, a house, or a whole building of flats */
  kind: 'flat' | 'house' | 'building';
  /** what was paid, in all */
  paid: number;
  /** rent per real hour, fixed when bought */
  rent: number;
  street: string;
  place: string;
  /** when it was bought (ms) */
  at: number;
}

export interface Homes {
  v: 1;
  homes: Home[];
  /** the calendar day (on this device, YYYY-MM-DD) rent was last paid for */
  paidDay: string;
}

/** A calendar day on this device, as YYYY-MM-DD: rent is paid once for each. */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * How homes are kept, short, so a player with a thousand homes still fits in an online save: names of
 * streets and places once each, a home as [map number, lat, lon, kind letter, paid, street, place, day
 * bought]. The rent is not kept: it follows from the price paid.
 */
type Kept = { v: 2; d: string; s: string[]; p: string[]; h: Array<[string, number, number, string, number, number, number, number]> };
const KINDS = { flat: 'f', house: 'h', building: 'b' } as const;
const DAY_MS = 86400000;

export function packHomes(h: Homes): string {
  const streets: string[] = [];
  const places: string[] = [];
  const index = (list: string[], v: string) => {
    const i = list.indexOf(v);
    return i >= 0 ? i : list.push(v) - 1;
  };
  const kept: Kept = {
    v: 2,
    d: h.paidDay,
    s: streets,
    p: places,
    h: h.homes.map((x) => [x.id, Math.round(x.lat * 1e5) / 1e5, Math.round(x.lon * 1e5) / 1e5, KINDS[x.kind], x.paid, index(streets, x.street), index(places, x.place), Math.floor(x.at / DAY_MS)]),
  };
  return JSON.stringify(kept);
}

export function readHomes(raw: string | null, now = Date.now()): Homes {
  try {
    const h = JSON.parse(raw ?? '') as (Homes & { paidUntil?: number }) | Kept;
    if (h && h.v === 2 && Array.isArray(h.h)) {
      const kind = (k: string): Home['kind'] => (k === 'b' ? 'building' : k === 'h' ? 'house' : 'flat');
      const homes = h.h.map(([id, lat, lon, k, paid, si, pi, day]) => ({ id, lat, lon, kind: kind(k), paid, rent: rentFor(paid), street: h.s[si] ?? '', place: h.p[pi] ?? '', at: day * DAY_MS }));
      return { v: 1, homes, paidDay: typeof h.d === 'string' ? h.d : dayOf(now) };
    }
    if (h && h.v === 1 && Array.isArray(h.homes)) {
      // the first way of keeping them; the rent follows the price paid, whatever was kept
      const homes = h.homes.map((x) => ({ ...x, rent: rentFor(x.paid) }));
      const paidDay = typeof h.paidDay === 'string' ? h.paidDay : dayOf(Number.isFinite(h.paidUntil) ? h.paidUntil! : now);
      return { v: 1, homes, paidDay };
    }
  } catch {
    /* none yet */
  }
  return { v: 1, homes: [], paidDay: dayOf(now) };
}

export function loadHomes(): Homes {
  try {
    return readHomes(localStorage.getItem(STORE));
  } catch {
    return readHomes(null);
  }
}

export function saveHomes(h: Homes): void {
  try {
    localStorage.setItem(STORE, packHomes(h));
  } catch {
    /* private window: owned for this visit only */
  }
}

/** What all one's homes pay on a day one comes back. */
export function rentPerVisit(h: Homes): number {
  return h.homes.reduce((s, x) => s + x.rent, 0);
}

/** The rent due now: all of it on the first visit of a new day, nothing on a second visit that day. */
export function rentDue(h: Homes, now: number): number {
  return dayOf(now) === h.paidDay ? 0 : rentPerVisit(h);
}

/** Rent for a day one comes back, from the price paid: $168 for a $700 flat. */
export function rentFor(paid: number): number {
  return Math.max(1, Math.round(paid * RENT_PER_VISIT));
}

/**
 * Which building each home is, in a square: the nearest building with the home's map number within
 * 30 m, or failing that (the map has redrawn it under a new number) the nearest within 4 m of where it
 * stood. Each home is one building. The number alone is not enough: the map gives one number to a
 * group of buildings mapped as one thing (87 buildings in a Nuremberg square share one).
 */
export function homesIn<L extends { id: string; x: number; y: number }>(h: Homes, lots: L[], toLocal: (lon: number, lat: number) => [number, number]): Map<L, Home> {
  const found = new Map<L, Home>();
  for (const home of h.homes) {
    const [hx, hy] = toLocal(home.lon, home.lat);
    let best: L | null = null;
    let bestD = Infinity;
    let near: L | null = null;
    let nearD = 4;
    for (const l of lots) {
      if (found.has(l)) continue;
      const d = Math.hypot(l.x - hx, l.y - hy);
      if (home.id && l.id === home.id && d < 30 && d < bestD) {
        best = l;
        bestD = d;
      }
      if (d < nearD) {
        near = l;
        nearD = d;
      }
    }
    const lot = best ?? near;
    if (lot) found.set(lot, home);
  }
  return found;
}
