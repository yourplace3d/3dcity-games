/**
 * Where am I? The player is put down in a well-known city with its name kept back, drives around,
 * and picks the city from four names. The sooner the pick, the more points; a wrong pick costs
 * points and takes that name away.
 *
 * The three wrong names are not any three: two are cities near the right one, so that knowing the
 * continent is not enough, and one is from anywhere.
 */

import type { LngLat } from './geo/projection';
import { CITY_LIST } from './places';

export interface Round {
  city: string;
  at: LngLat;
  /** the four names to pick from, the right one among them */
  options: string[];
}

/** points for a pick at once, what a second of looking and a wrong pick cost, and the least a right pick is worth */
const FULL = 1000;
const PER_SECOND = 4;
const WRONG = 250;
const LEAST = 100;
/** the start lies up to this far from the city's middle (m), so a city is not the same streets every time */
const AROUND_M = 350;
const SEEN = '3da-guess-seen';

export function points(seconds: number, wrong: number): number {
  return Math.max(LEAST, Math.round(FULL - PER_SECOND * seconds) - WRONG * wrong);
}

function seen(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(SEEN) ?? '[]');
    return Array.isArray(list) ? list.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/** A city played is not given again until the others have had their turn. */
export function played(city: string): void {
  try {
    const list = seen().filter((n) => n !== city);
    list.push(city);
    localStorage.setItem(SEEN, JSON.stringify(list.slice(-(CITY_LIST.length - 8))));
  } catch {
    /* without a store a city may come twice */
  }
}

const km = (a: LngLat, b: LngLat): number => Math.hypot((a.lat - b.lat) * 111, (a.lon - b.lon) * 111 * Math.cos((a.lat * Math.PI) / 180));

function shuffle<T>(list: T[], rnd: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** A city to guess and the names to pick from. `not`: cities that would not load this time. */
export function newRound(not: string[] = [], rnd: () => number = Math.random): Round {
  const skip = new Set([...seen(), ...not]);
  let pool = CITY_LIST.filter((c) => !skip.has(c.name));
  if (!pool.length) pool = CITY_LIST.filter((c) => !not.includes(c.name));
  if (!pool.length) pool = CITY_LIST;
  const city = pool[Math.floor(rnd() * pool.length)];
  const others = CITY_LIST.filter((c) => c !== city).sort((a, b) => km(a.at, city.at) - km(b.at, city.at));
  const near = shuffle(others.slice(0, 7), rnd).slice(0, 2);
  const rest = others.filter((c) => !near.includes(c));
  const far = rest[Math.floor(rnd() * rest.length)];
  const turn = rnd() * Math.PI * 2;
  const out = Math.sqrt(rnd()) * AROUND_M;
  const at = {
    lat: city.at.lat + (Math.cos(turn) * out) / 111320,
    lon: city.at.lon + (Math.sin(turn) * out) / (111320 * Math.cos((city.at.lat * Math.PI) / 180)),
  };
  return { city: city.name, at, options: shuffle([city.name, near[0].name, near[1].name, far.name], rnd) };
}

/** A city someone guessed, sent on for the next one to guess: the same spot, the same four names, and what there is to beat. */
export interface SentGuess {
  name: string;
  points: number;
  seconds: number;
  wrong: number;
  round: Round;
}

const KEY = [0x3d, 0xa7, 0x51, 0xc4, 0x1e, 0x92, 0x6b];

/**
 * The text that stands for a sent guess in a link. The link must not say which city it is, so the
 * bytes are stirred before they are written: nobody reads "Toronto" out of the address by eye.
 * It is no secret from someone who sets out to take the link apart.
 */
export function packGuess(g: SentGuess): string {
  const json = JSON.stringify([1, g.name.slice(0, 16), Math.round(g.points), Math.round(g.seconds), g.wrong, Math.round(g.round.at.lat * 1e5), Math.round(g.round.at.lon * 1e5), g.round.options.indexOf(g.round.city), ...g.round.options]);
  let bin = '';
  new TextEncoder().encode(json).forEach((b, i) => (bin += String.fromCharCode(b ^ KEY[i % KEY.length] ^ (i & 0xff))));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A sent guess from a link, or null when the text is not one. */
export function readGuess(text: string): SentGuess | null {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const a = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch, i) => ch.charCodeAt(0) ^ KEY[i % KEY.length] ^ (i & 0xff)))) as unknown;
    if (!Array.isArray(a) || a[0] !== 1 || a.length !== 12) return null;
    const [, name, pts, seconds, wrong, lat, lon, right, ...options] = a as unknown[];
    const nums = [pts, seconds, wrong, lat, lon, right];
    if (typeof name !== 'string' || !nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    if (!options.every((o): o is string => typeof o === 'string' && o.length > 0 && o.length <= 40) || new Set(options).size !== 4) return null;
    const [p, s, w, la, lo, r] = nums as number[];
    if (Math.abs(la) > 85e5 || Math.abs(lo) > 180e5 || !Number.isInteger(r) || r < 0 || r > 3) return null;
    return {
      name: name.trim().slice(0, 16),
      points: Math.max(0, Math.min(FULL, Math.round(p))),
      seconds: Math.max(0, Math.min(86400, Math.round(s))),
      wrong: Math.max(0, Math.min(3, Math.round(w))),
      round: { city: options[r], at: { lat: la / 1e5, lon: lo / 1e5 }, options },
    };
  } catch {
    return null;
  }
}
