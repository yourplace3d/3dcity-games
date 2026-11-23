/**
 * Home points: how many homes may be bought, earned by playing (the owner, 23 November 2026).
 *
 * Rent comes in once for each day the player comes back, and each home bought with it brings more,
 * so without a limit the homes snowball: a few thousand after a month of five-minute visits (estimate,
 * `docs/plan-returning-players.md`, section 5). So each delivery earns a point, and a home takes points:
 *
 * - a flat 2, a house 10, a whole building 2 for each flat it adds;
 * - up to `POINTS_MAX` wait, so a long drive without buying counts, but not without end; a home
 *   that would take more than that is too big for now;
 * - the first home, and the rest of its building in the first-home mission, take none: that is how a
 *   new player learns;
 * - one flat or house a day takes none, once a delivery has been made that day (the owner, 23 November:
 *   "one flat/object should be buyable anyways per day"). Not before a delivery, or each change of the
 *   phone's date would bring a free home; and never a whole building.
 *
 * Points wait from day to day (up to `POINTS_MAX`) rather than starting at 0 each day: totals hardly
 * differ, but a five-minute player could otherwise never save the 10 points for a house, and points lost
 * at midnight would punish a short day.
 *
 * Points come from deliveries only, so waiting, or setting the phone's date to another day, brings rent
 * but no homes. Kept in the browser under `3da-points`, so saving online carries them along.
 */

const STORE = '3da-points';

export const FLAT_POINTS = 2;
export const HOUSE_POINTS = 10;
/** the most points that wait */
export const POINTS_MAX = 20;

/** The points a home takes: a flat, a house, or a whole building adding `adds` flats. */
export function pointsFor(what: 'flat' | 'house' | 'building', adds = 1): number {
  return what === 'house' ? HOUSE_POINTS : FLAT_POINTS * Math.max(1, what === 'building' ? adds : 1);
}

/** Points after `n` more deliveries. */
export function earn(points: number, n: number): number {
  return Math.min(POINTS_MAX, points + Math.max(0, n));
}

/** How many flats the points buy now. */
export function flatsFree(points: number): number {
  return Math.floor(points / FLAT_POINTS);
}

/** "1 more delivery", "3 more deliveries": what is missing before a home can be bought. */
export function deliveries(n: number): string {
  return `${n} more ${n === 1 ? 'delivery' : 'deliveries'}`;
}

/** The free home of the day: the day it was last taken, and the last day a delivery was made (YYYY-MM-DD). */
export interface Daily {
  used: string;
  played: string;
}

/** Whether the day's free home is there: a delivery made today, and none taken yet. */
export function dailyReady(d: Daily, today: string): boolean {
  return d.played === today && d.used !== today;
}

/** Deliveries still missing for a home that takes `need` points; a flat or house can be the day's free one. */
export function deliveriesFor(points: number, need: number, d: Daily, today: string, canBeDaily: boolean): number {
  const short = Math.max(0, need - points);
  if (!canBeDaily || d.used === today) return short;
  return Math.min(short, d.played === today ? 0 : 1);
}

export function readDaily(raw: string | null): Daily {
  try {
    const k = JSON.parse(raw ?? '') as { used?: unknown; played?: unknown };
    const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
    return { used: day(k.used), played: day(k.played) };
  } catch {
    return { used: '', played: '' };
  }
}

export function loadDaily(): Daily {
  try {
    return readDaily(localStorage.getItem(STORE));
  } catch {
    return readDaily(null);
  }
}

export function readPoints(raw: string | null): number {
  try {
    const v = (JSON.parse(raw ?? '') as { points?: unknown }).points;
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(POINTS_MAX, Math.max(0, Math.floor(v))) : 0;
  } catch {
    return 0;
  }
}

export function loadPoints(): number {
  try {
    return readPoints(localStorage.getItem(STORE));
  } catch {
    return 0;
  }
}

export function storePoints(points: number, daily: Daily): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, points, ...daily }));
  } catch {
    /* private window: for this visit only */
  }
}
