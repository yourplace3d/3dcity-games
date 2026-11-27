/**
 * Find the car and drive it back (the owner, 27 November 2026): the first of the chases, the gentle one.
 * A car is parked somewhere in a circle on the little map; drive around until you see it, get in, and
 * drive it back to the ring. The circle never gives the spot away, and closes in on the car after a while,
 * so the search never gets too hard. Later chases (a tail, then a wild one) build on this.
 *
 * The rules alone, with no screen: the circle, when the car counts as seen, and its look. `game.ts` plays it.
 */

import type { CarKind } from './cars';

/** how far from you the car is parked (m) */
export const FIND_NEAR = 250;
export const FIND_FAR = 520;
/** the circle to search (m) */
export const ZONE_R = 150;
/** the smallest the circle gets (m) */
export const ZONE_MIN = 55;
/** seconds of searching before the circle closes in */
export const CLOSE_IN_S = 60;
/** the car is seen this near with a clear view, or this near whatever is between (m) */
export const SEE_M = 40;
export const NEAR_M = 14;
/** at the ring: this near, this slow, to hand the car over (m, m/s) */
export const HAND_M = 7.5;
export const HAND_SPEED = 2.5;

/** Looks the game's other cars never have, so the one to find can be told apart; each with its word. */
export const LOOKS: ReadonlyArray<{ colour: string; word: string }> = [
  { colour: '#e0569b', word: 'pink' },
  { colour: '#9ccc3a', word: 'lime-green' },
];
export const KINDS: ReadonlyArray<{ kind: CarKind; word: string }> = [
  { kind: 'sedan', word: 'car' },
  { kind: 'van', word: 'van' },
  { kind: 'sport', word: 'sports car' },
];

/** "a pink van" */
export const describeCar = (word: string, kind: string): string => `a ${word} ${kind}`;

/**
 * The circle: its middle away from the car, by a random share of its radius in a random direction, so the
 * car is in it but not in its middle.
 */
export function zoneAround(car: [number, number], r = ZONE_R, rand = Math.random): { x: number; y: number; r: number } {
  const a = rand() * Math.PI * 2;
  const d = r * (0.3 + 0.35 * rand());
  return { x: car[0] + Math.cos(a) * d, y: car[1] + Math.sin(a) * d, r };
}

/** The circle closes in: halfway to the car, and a little over half as wide, never smaller than `ZONE_MIN`. */
export function closeIn(zone: { x: number; y: number; r: number }, car: [number, number]): { x: number; y: number; r: number } {
  const r = Math.max(ZONE_MIN, zone.r * 0.6);
  let x = (zone.x + car[0]) / 2;
  let y = (zone.y + car[1]) / 2;
  // the car stays inside, with room to spare
  const d = Math.hypot(car[0] - x, car[1] - y);
  if (d > r * 0.7) {
    x = car[0] + ((x - car[0]) / d) * r * 0.7;
    y = car[1] + ((y - car[1]) / d) * r * 0.7;
  }
  return { x, y, r };
}

/** Whether you see the car: near with a clear view, or very near. */
export const seen = (metres: number, clear: boolean): boolean => metres < NEAR_M || (metres < SEE_M && clear);

/** What finding it pays: like a supply run of the way back, at least $150, in tens. */
export const findPay = (metres: number): number => Math.max(150, Math.round((metres * 0.75) / 10) * 10);
