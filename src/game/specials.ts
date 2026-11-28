/**
 * Special cars, and the garage's own job that brings them: the car delivery (the owner, 28 November 2026:
 * "one more mission where the clean run is not a clean one by the police but a nice car which is not
 * allowed to have a dent during the mission. Maybe that's how we could also introduce some special cars").
 * The rules alone, with no screen: `garageUi.ts` offers the job, `game.ts` plays it (`Game.startCare`).
 *
 * - A garage hands out its own kind of job, as each station does: a car that looks like no other stands
 *   there, the player drives it to its owner, and a new dent on the way ends the job.
 * - There is no clock: the care is the test. (A clock at the higher levels is for later.)
 * - Each delivery done well is one level up, to `CARE_TOP`: the way gets longer and the pay a little
 *   better, never above what a job pays. Failing loses nothing, and the level stays.
 * - A special car delivered without a dent is for sale at the garages from then on: driven first, bought
 *   after. Bought, it takes one of the city's spots like any kept car.
 * - No makes and no names of real cars: plain words, and looks built from boxes like every car.
 */

import type { CarLook } from './cars';
import { JOB_MAX } from './services';

export type SpecialId = 'convertible' | 'coupe' | 'limo';

export interface Special {
  id: SpecialId;
  /** the kind of car it drives as */
  kind: 'sedan' | 'sport';
  look: Exclude<CarLook, '' | 'painted'>;
  colour: string;
  /** top speed (m/s) and pull (m/s²) */
  top: number;
  acc: number;
  /** how much of a knock becomes damage: above 1, it dents more easily than an ordinary car */
  dent: number;
  /** its length (m), where it is not its kind's */
  len?: number;
  /** the level of the job from which it is among the cars to deliver */
  from: number;
  /** what it costs at the garage once delivered (estimates, to tune from play) */
  price: number;
}

export const SPECIALS: Special[] = [
  // slow, and the one that dents most easily: the gentlest drive, the hardest to keep whole
  { id: 'convertible', kind: 'sedan', look: 'convertible', colour: '#efe6c8', top: 24, acc: 7, dent: 1.6, from: 0, price: 2000 },
  // long: slow round a corner, and its tail swings wide
  { id: 'limo', kind: 'sedan', look: 'limo', colour: '#1b1d21', top: 26, acc: 6.5, dent: 1.2, len: 6.2, from: 2, price: 3000 },
  // the fastest car in the game, which is its own temptation
  { id: 'coupe', kind: 'sport', look: 'coupe', colour: '#1f4d3a', top: 42, acc: 13, dent: 1.2, from: 4, price: 4000 },
];

const IDS = SPECIALS.map((s) => s.id);
export const isSpecial = (v: unknown): v is SpecialId => typeof v === 'string' && (IDS as string[]).includes(v);
export const special = (id: SpecialId): Special => SPECIALS.find((s) => s.id === id)!;

/** the highest level of the job: from here on only the car, the place and the way change */
export const CARE_TOP = 8;

/** The level of the job after `done` deliveries done well. */
export const careLevel = (done: number): number => Math.max(0, Math.min(CARE_TOP, Math.floor(done)));

/** How far the owner lives, as the crow flies (m, from, to): a little further at each level. */
export function careWay(level: number): [number, number] {
  const l = careLevel(level);
  return [450 + l * 80, 800 + l * 100];
}

/** What a delivery pays, in tens: a little more at each level, and never more than a job pays. */
export const carePay = (level: number): number => Math.min(JOB_MAX, 200 + careLevel(level) * 15);

/** The car to deliver at a level: one of those that have come in by then. */
export function careCar(level: number, rand = Math.random): Special {
  const open = SPECIALS.filter((s) => s.from <= careLevel(level));
  return open[Math.min(open.length - 1, Math.floor(rand() * open.length))];
}

/** What a special car sells for, once bought and kept: two fifths of its price. */
export const resale = (id: SpecialId): number => Math.round((special(id).price * 0.4) / 10) * 10;
