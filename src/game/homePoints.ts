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
 *   new player learns.
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

/** "1 more delivery", "3 more deliveries": what is missing for a home that takes `need`. */
export function missing(points: number, need: number): string {
  const n = Math.max(0, need - points);
  return `${n} more ${n === 1 ? 'delivery' : 'deliveries'}`;
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

export function storePoints(points: number): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, points }));
  } catch {
    /* private window: for this visit only */
  }
}
