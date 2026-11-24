/**
 * A party at one of the player's homes (the owner, 23 November 2026): friends are coming over tonight,
 * and nobody got the food. Fetch it from a restaurant or a supermarket near the home and bring it to
 * the door before it gets cold. "Pizza delivery for a friends' evening or a party", in the owner's words.
 *
 * - Every home has its own party run, "built" when it is first asked for: the food place picked for it
 *   is kept, so the run stays the same (later the player may pick the place themselves).
 * - The clock starts when the food is picked up and stops at the door. That time is what a friend sent
 *   the party tries to beat: they start at the same home and fetch from the same place.
 * - It pays no cash: a party pays `PARTY_POINTS` home points, once a day. Played again the same day it
 *   pays nothing, so homes don't come faster than one extra flat a day.
 * - At the end a friend can be invited with a link, and no more than that is asked: "Someone still
 *   missing for tonight's party?" Sending a link earns nothing, and nothing about the links is counted.
 *
 * Kept in the browser under `3da-party`, so saving online carries it along.
 */

import type { Pt } from '../geo/polygon';
import type { LngLat } from '../geo/projection';
import type { FoodKind } from './services';

const STORE = '3da-party';
const E5 = 1e5;

/** What the evening is: one is picked for each party, and the link carries it. */
export const OCCASIONS = ['party', 'games night', 'film night', 'birthday party'] as const;
/** home points a party pays, once a day */
export const PARTY_POINTS = 2;
/** how far by road from the door the food place may be (m); the one nearest `PARTY_AIM` within is picked */
export const PARTY_NEAR = 450;
export const PARTY_FAR = 1200;
const PARTY_AIM = 800;

/** "the pizza", "the drinks and snacks" */
export function foodName(food: FoodKind): string {
  return food === 'shop' ? 'the drinks and snacks' : 'the pizza';
}

/** "the restaurant", "the supermarket" */
export function foodPlace(food: FoodKind): string {
  return food === 'shop' ? 'the supermarket' : 'the restaurant';
}

/** "games night" for an occasion's number; a number from a link that is not one reads as a party. */
export function occasion(n: number): string {
  return OCCASIONS[n] ?? OCCASIONS[0];
}

/**
 * The clock (s) from the food on board to the door, for a way of `metres` by road: quicker than a plain
 * job, not a rush job. `walk`: the last metres of it on foot, up a lane too narrow for a car; they get
 * time to park and walk.
 */
export function partyClock(metres: number, walk = 0): number {
  return Math.round(20 + Math.max(0, metres) / 9 + (walk > 0 ? 6 + walk / 6 : 0));
}

/**
 * The longest walk a party asks for (m): from where the lane gets too narrow for a car to the door. The
 * owner (24 November): in narrow lanes "it might also be possible to walk then instead. Just make sure it
 * wouldn't become an endless walk." Where it would be longer, the food goes to the corner where the car
 * stops, and the friends meet you there.
 */
export const WALK_MAX = 150;
/** only this last stretch of the way to the door is looked at (m): further out the player picks their own way */
const NARROW_LOOK = 300;
/** samples along the way (m), and how many in a row a car must not fit at for the lane to count as too narrow */
const NARROW_STEP = 2;
const NARROW_RUN = 3;

/**
 * Where the way to a door gets too narrow for a car, from `pts` (the way by road from the pickup to the
 * door) and `fits` (whether a car fits at a point, clear of walls). Null where a car gets all the way.
 * Else: `walk`, the metres from where the car stops to the door, and `stop`, a spot on the way a few
 * metres before the narrow part. A corner or a gate post grazing the way does not count: the car must not
 * fit at `NARROW_RUN` samples in a row.
 */
export function narrowWalk(pts: Pt[], fits: (x: number, y: number) => boolean): { walk: number; stop: Pt } | null {
  let total = 0;
  for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  let along = 0;
  let run = 0;
  let runFrom = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    const len = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < len; s += NARROW_STEP) {
      const at = along + s;
      if (total - at > NARROW_LOOK) continue;
      if (fits(ax + ((bx - ax) * s) / len, ay + ((by - ay) * s) / len)) {
        run = 0;
        continue;
      }
      if (run++ === 0) runFrom = at;
      if (run >= NARROW_RUN) return { walk: total - runFrom, stop: pointAt(pts, Math.max(0, runFrom - 4)) };
    }
    along += len;
  }
  return null;
}

/** The point `at` metres along a line. */
function pointAt(pts: Pt[], at: number): Pt {
  let left = at;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len && len > 0) return [ax + ((bx - ax) * left) / len, ay + ((by - ay) * left) / len];
    left -= len;
  }
  return pts[pts.length - 1];
}

/**
 * The food place for a home's party: of the places a road leads to from the door (`metres` by road),
 * a real one between `PARTY_NEAR` and `PARTY_FAR`, nearest `PARTY_AIM`; else a made-up one in that
 * range; else whichever is nearest that range. Null when there is none at all.
 */
export function pickFood<T extends { metres: number; invented?: boolean }>(places: T[]): T | null {
  const aim = (a: T, b: T) => Math.abs(a.metres - PARTY_AIM) - Math.abs(b.metres - PARTY_AIM);
  const inRange = places.filter((p) => p.metres >= PARTY_NEAR && p.metres <= PARTY_FAR);
  const real = inRange.filter((p) => !p.invented);
  if (real.length) return [...real].sort(aim)[0];
  if (inRange.length) return [...inRange].sort(aim)[0];
  const off = (p: T) => (p.metres < PARTY_NEAR ? PARTY_NEAR - p.metres : p.metres - PARTY_FAR);
  return [...places].sort((a, b) => off(a) - off(b))[0] ?? null;
}

/** The food place kept for a home: where its symbol stands, and the spot on the road where the food is picked up. */
export interface FoodSpot {
  food: FoodKind;
  invented: boolean;
  shop: LngLat;
  pick: LngLat;
}

export interface PartyStore {
  /** the last day a party paid its points (YYYY-MM-DD) */
  paid: string;
  /** each home's food place, by `homeKey` */
  places: Record<string, FoodSpot>;
  /** each home's best time from pickup to door (s) */
  best: Record<string, number>;
  /** the line saying the link shows where the home is has been read */
  warned: boolean;
}

const point = (v: unknown): LngLat | null => {
  const p = v as { lat?: unknown; lon?: unknown } | null;
  return p && typeof p.lat === 'number' && typeof p.lon === 'number' && Math.abs(p.lat) <= 85 && Math.abs(p.lon) <= 180 ? { lat: p.lat, lon: p.lon } : null;
};

export function readParties(raw: string | null): PartyStore {
  const none: PartyStore = { paid: '', places: {}, best: {}, warned: false };
  try {
    const k = JSON.parse(raw ?? 'null') as Partial<PartyStore> | null;
    if (!k || typeof k !== 'object') return none;
    const places: Record<string, FoodSpot> = {};
    if (k.places && typeof k.places === 'object') {
      for (const [h, s] of Object.entries(k.places)) {
        const shop = point(s?.shop);
        const pick = point(s?.pick);
        if (shop && pick && (s.food === 'restaurant' || s.food === 'shop')) places[h] = { food: s.food, invented: s.invented === true, shop, pick };
      }
    }
    const best: Record<string, number> = {};
    if (k.best && typeof k.best === 'object') {
      for (const [h, t] of Object.entries(k.best)) if (typeof t === 'number' && Number.isFinite(t) && t > 0) best[h] = Math.round(t);
    }
    const paid = typeof k.paid === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k.paid) ? k.paid : '';
    return { paid, places, best, warned: k.warned === true };
  } catch {
    return none;
  }
}

export function loadParties(): PartyStore {
  try {
    return readParties(localStorage.getItem(STORE));
  } catch {
    return readParties(null);
  }
}

export function storeParties(p: PartyStore): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, ...p }));
  } catch {
    /* private window: for this visit only */
  }
}

/** Whether a party done today pays its points: the first of the day does. */
export function pointsDue(p: PartyStore, today: string): boolean {
  return p.paid !== today;
}

/** A party to send to a friend: whose it is, the time to beat and who set it, and the places, all in the link. */
export interface SentParty {
  /** whose party it is: the name of the player whose home it is ('' for none given) */
  name: string;
  /** who set the time: the host, or a friend sending their time back */
  by: string;
  /** from pickup to door (s) */
  seconds: number;
  place: string;
  occasion: number;
  food: FoodKind;
  invented: boolean;
  /** the home: where the friend starts */
  home: LngLat;
  /** the drop-off on the road at the home's door */
  door: LngLat;
  /** the food place's symbol, and the spot on the road where the food is picked up */
  shop: LngLat;
  pick: LngLat;
  /** the last metres to the door on foot, up a lane too narrow for a car (0: none) */
  walk: number;
  /** the lanes to the door are too narrow for a car, further than `WALK_MAX`: `door` is the corner where the car stops */
  corner: boolean;
}

/** The text that stands for a party in a link: letters, digits, `-` and `_` only. */
export function packParty(p: SentParty): string {
  const lat0 = Math.round(p.home.lat * E5);
  const lon0 = Math.round(p.home.lon * E5);
  // every place as its distance from the home, which keeps the link short
  const pts = [p.door, p.shop, p.pick].flatMap((q) => [Math.round(q.lat * E5) - lat0, Math.round(q.lon * E5) - lon0]);
  const json = JSON.stringify([1, p.name.slice(0, 16), p.by.slice(0, 16), Math.round(p.seconds), p.place.slice(0, 40), p.occasion, p.food === 'shop' ? 's' : 'r', p.invented ? 1 : 0, Math.round(p.walk), p.corner ? 1 : 0, lat0, lon0, ...pts]);
  let bin = '';
  for (const b of new TextEncoder().encode(json)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A party from a link, or null when the text is not one. */
export function readParty(text: string): SentParty | null {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const a = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))) as unknown;
    if (!Array.isArray(a) || a[0] !== 1 || a.length !== 18) return null;
    const [, name, by, seconds, place, occ, food, invented, walk, corner, ...nums] = a as unknown[];
    if (typeof name !== 'string' || typeof by !== 'string' || typeof place !== 'string' || (food !== 'r' && food !== 's')) return null;
    if (![seconds, occ, invented, walk, corner, ...nums].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    const [la, lo, ...d] = nums as number[];
    // the food place is within a couple of kilometres of the home
    if (Math.abs(la) > 85 * E5 || Math.abs(lo) > 180 * E5 || d.some((v) => Math.abs(v) > 0.05 * E5)) return null;
    const at = (i: number): LngLat => ({ lat: (la + d[i * 2]) / E5, lon: (lo + d[i * 2 + 1]) / E5 });
    return {
      name: name.trim().slice(0, 16),
      by: by.trim().slice(0, 16),
      seconds: Math.max(0, Math.min(3600, Math.round(seconds as number))),
      place: place.trim().slice(0, 40),
      occasion: OCCASIONS[occ as number] ? (occ as number) : 0,
      food: food === 's' ? 'shop' : 'restaurant',
      invented: invented === 1,
      home: { lat: la / E5, lon: lo / E5 },
      door: at(0),
      shop: at(1),
      pick: at(2),
      // never a longer walk than a party asks for, whatever a link says
      walk: Math.max(0, Math.min(WALK_MAX, Math.round(walk as number))),
      corner: corner === 1,
    };
  } catch {
    return null;
  }
}
