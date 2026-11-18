/**
 * Tenants: who lives in the player's homes, what they ask for, and the rent that waits for the
 * player at each building.
 *
 * - Rent is earned once for each day the player comes back, as before, but it no longer lands in
 *   the pocket: it waits at the building, up to `HOLD_DAYS` days of it, until the player stops
 *   beside it and collects it. A home never visited stops filling up.
 * - Each home's tenants have a mood of 1 to 3 stars. Full rent at 3 stars, three quarters at 2, half
 *   at 1: never less, so there is no spiral down.
 * - Tenants ask for things: a part for a repair, a burst pipe, new locks. Each ask is a package
 *   from its own kind of station (fuel, fire, police) to the building. Answered, the stars go up
 *   one and the tenant tips; left until the next day the player comes back, they go down one.
 * - A home bought starts with moving day: furniture from a fuel station's yard (a heavy load) to
 *   the building. Its rent starts once the tenant has moved in.
 * - Upgrades raise a home's rent, each less than the one before: the first pays for itself in
 *   about three weeks of visits, the last in months. Money to spend that is never wasted.
 *
 * Kept in the browser under `3da-tenants`, one entry per home, in the order homes were bought
 * (homes are never sold), so saving online carries it along.
 */

import type { JobKind } from './services';

export type Ask = 'move' | 'repair' | 'pipe' | 'locks';

export interface Tenant {
  /** rent waiting at the building */
  due: number;
  /** 1 to 3 */
  stars: number;
  /** what the tenant asks for, if anything */
  ask?: Ask;
  /** upgrades made, in the order of `UPGRADES` */
  up: number;
}

export interface Tenants {
  v: 1;
  t: Tenant[];
  /** the player has been told how tenants work */
  told?: boolean;
}

const STORE = '3da-tenants';
/** days of rent a building holds before it stops filling up */
export const HOLD_DAYS = 3;
/** the share of the rent paid at 0 (never), 1, 2 and 3 stars */
export const STAR_SHARE = [0.5, 0.5, 0.75, 1];
/** the chance a home's tenants ask for something on a day the player comes back */
export const ASK_CHANCE = 0.5;
/** the station each ask comes from: its kind of job */
export const ASK_KIND: Record<Ask, JobKind> = { move: 'supply', repair: 'supply', pipe: 'rush', locks: 'clean' };

export const UPGRADES: Array<{ name: string; days: number; add: number }> = [
  { name: 'a new kitchen', days: 2, add: 0.1 },
  { name: 'a new bathroom', days: 3, add: 0.08 },
  { name: 'a balcony', days: 5, add: 0.06 },
  { name: 'a lift', days: 8, add: 0.05 },
];

export function tenantOf(t: Tenants, i: number): Tenant {
  while (t.t.length <= i) t.t.push({ due: 0, stars: 3, up: 0 });
  return t.t[i];
}

/** How much the upgrades made raise the rent: 1.1 after a kitchen. */
export function upgradeShare(up: number): number {
  let s = 1;
  for (let k = 0; k < Math.min(up, UPGRADES.length); k++) s += UPGRADES[k].add;
  return s;
}

/** A day's rent from a home: its base rent with the upgrades, by the tenants' mood; none before moving day. */
export function dayRent(base: number, t: Tenant): number {
  if (t.ask === 'move') return 0;
  return Math.round(base * upgradeShare(t.up) * STAR_SHARE[Math.max(0, Math.min(3, t.stars))]);
}

/** The next upgrade of a home, what it costs and what it adds to a day's rent; null when all are made. */
export function nextUpgrade(base: number, t: Tenant): { name: string; cost: number; adds: number } | null {
  const u = UPGRADES[t.up];
  if (!u) return null;
  const cost = Math.max(10, Math.round((base * u.days) / 10) * 10);
  return { name: u.name, cost, adds: Math.max(1, Math.round(base * u.add)) };
}

/** a number from 0 to 1, the same for a day and a home */
function roll(day: string, i: number, salt: number): number {
  let h = 2166136261 ^ salt;
  const key = `${day}#${i}`;
  for (let k = 0; k < key.length; k++) h = Math.imul(h ^ key.charCodeAt(k), 16777619);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * A day the player comes back. Asks left open since the last such day cost a star; each home earns
 * its day's rent into what waits at it (up to `HOLD_DAYS` days of it); and some tenants ask for
 * something new. `bases[i]` is home i's rent before tenants; `asking[i]` false for a home whose
 * tenants don't ask yet (the first home while it is being repaired).
 */
export function newDay(t: Tenants, bases: number[], asking: boolean[], day: string): { earned: number; asks: number } {
  let earned = 0;
  let asks = 0;
  bases.forEach((base, i) => {
    const ten = tenantOf(t, i);
    if (ten.ask && ten.ask !== 'move') ten.stars = Math.max(1, ten.stars - 1);
    const rent = dayRent(base, ten);
    const room = Math.max(0, rent * HOLD_DAYS - ten.due);
    const add = Math.min(rent, room);
    ten.due += add;
    earned += add;
    if (!ten.ask && asking[i] && roll(day, i, 1) < ASK_CHANCE) {
      const kinds: Ask[] = ['repair', 'pipe', 'locks'];
      ten.ask = kinds[Math.floor(roll(day, i, 2) * kinds.length) % kinds.length];
    }
    if (ten.ask) asks++;
  });
  return { earned, asks };
}

/** An ask answered: the tenants are happier, and they tip a share of a day's rent. Returns the tip. */
export function answer(t: Tenants, i: number, base: number): number {
  const ten = tenantOf(t, i);
  const was = ten.ask;
  if (!was) return 0;
  delete ten.ask;
  if (was === 'move') return 0;
  ten.stars = Math.min(3, ten.stars + 1);
  return Math.max(10, Math.round((dayRent(base, ten) * 0.25) / 10) * 10);
}

/** What the player tells a tenant about, by the kind of station the package comes from. */
export function askLine(ask: Ask, street: string): string {
  const at = street ? ` on ${street}` : '';
  switch (ask) {
    case 'move':
      return `Moving day: furniture for your new tenant${at}. A heavy load: mind the dents`;
    case 'repair':
      return `A part for the heating of your tenant${at}: a heavy load, take it to your building`;
    case 'pipe':
      return `A burst pipe at your building${at}: quick, before the ceiling comes down`;
    default:
      return `New locks for your tenant${at}: drive clean, or the job is gone`;
  }
}

/** Stars as text: ★★☆ */
export function starText(stars: number): string {
  const s = Math.max(1, Math.min(3, stars));
  return '★'.repeat(s) + '☆'.repeat(3 - s);
}

export function readTenants(raw: string | null): Tenants {
  try {
    const t = JSON.parse(raw ?? '') as Partial<Tenants>;
    if (t && t.v === 1 && Array.isArray(t.t)) {
      const asks: Ask[] = ['move', 'repair', 'pipe', 'locks'];
      return {
        v: 1,
        t: t.t.map((x) => {
          const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
          const ask = asks.includes(x?.ask as Ask) ? (x.ask as Ask) : undefined;
          return { due: n(x?.due, 0, 1e7, 0), stars: n(x?.stars, 1, 3, 3), up: n(x?.up, 0, UPGRADES.length, 0), ...(ask ? { ask } : {}) };
        }),
        ...(t.told === true ? { told: true } : {}),
      };
    }
  } catch {
    /* none yet */
  }
  return { v: 1, t: [] };
}

export function loadTenants(): Tenants {
  try {
    return readTenants(localStorage.getItem(STORE));
  } catch {
    return readTenants(null);
  }
}

export function saveTenants(t: Tenants): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(t));
  } catch {
    /* private window: for this visit */
  }
}
