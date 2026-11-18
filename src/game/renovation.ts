/**
 * The new player's way to a first home and the building around it, step by step:
 *
 * 1. `find`: after two deliveries, a part of town with cheap, worn-down flats is shown. Their walls
 *    need work, so one sells for what the player has (`price`), in a building of 3 to 5 flats.
 * 2. `flat`: the flat is bought, but pays no rent until it is repaired. The packages at the fuel,
 *    fire and police stations blink: whichever is taken goes to the building, and repairs the flat.
 * 3. `buy`: the flat pays rent. The rest of the building is for sale, even before the 6th home.
 * 4. `rest`: the building is the player's. Each package to it repairs one more flat, and each
 *    repaired flat adds its share of the rent.
 * 5. `paint`: every flat is done. One more package brings the paint for the outside.
 * 6. `done`: the building has its colours back, and the player chooses a new one.
 *
 * Kept in the browser under `3da-reno`, so saving online carries it along. The building is the
 * first home, `homes[0]`: homes are never sold, so it stays there.
 */

import type { JobKind } from './services';

export type RenoStage = 'find' | 'flat' | 'buy' | 'rest' | 'paint' | 'done';

export interface Reno {
  stage: RenoStage;
  /** `find`: what a worn-down flat sells for */
  price?: number;
  /** from `flat` on: the flats in the building */
  units?: number;
  /** `rest`: the flats repaired besides the player's own */
  fixed?: number;
  /** the first package has been taken, and the plan told */
  told?: boolean;
}

const STORE = '3da-reno';
/** the older key of the first-home mission: 'on' or 'done' */
const OLD = '3da-mission';

/** A building of this many flats or so is chosen, so that repairing it is a few jobs, not dozens. */
export const UNITS_MIN = 3;
export const UNITS_MAX = 5;
/** the least cash for a worn-down flat to be offered */
export const FIXER_MIN = 200;
/** deliveries before a flat is offered */
export const FIXER_AFTER = 2;
/** The colour of worn-down walls, until the building is done. */
export const WORN = '#8f8a80';

export function readReno(raw: string | null, old: string | null, hasHomes: boolean): Reno | null {
  try {
    const r = JSON.parse(raw ?? 'null') as Partial<Reno> | null;
    const stages: RenoStage[] = ['find', 'flat', 'buy', 'rest', 'paint', 'done'];
    if (r && typeof r === 'object' && stages.includes(r.stage as RenoStage)) {
      const stage = r.stage as RenoStage;
      // a building is only had with a home; without one the way starts again
      if (stage !== 'find' && stage !== 'done' && !hasHomes) return null;
      const int = (n: unknown, lo: number, hi: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined);
      const units = int(r.units, 2, 400);
      return {
        stage,
        ...(int(r.price, 1, 1e7) !== undefined ? { price: int(r.price, 1, 1e7) } : {}),
        ...(units !== undefined ? { units } : {}),
        ...(int(r.fixed, 0, 400) !== undefined ? { fixed: Math.min(int(r.fixed, 0, 400)!, (units ?? 2) - 1) } : {}),
        ...(r.told === true ? { told: true } : {}),
      };
    }
  } catch {
    /* none kept */
  }
  // a player from before: a home bought, or the old mission over, and there is nothing to repair
  if (hasHomes || old === 'done') return { stage: 'done' };
  if (old === 'on') return { stage: 'find' };
  return null;
}

export function loadReno(hasHomes: boolean): Reno | null {
  try {
    return readReno(localStorage.getItem(STORE), localStorage.getItem(OLD), hasHomes);
  } catch {
    return hasHomes ? { stage: 'done' } : null;
  }
}

export function storeReno(r: Reno): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(r));
  } catch {
    /* private window: for this visit */
  }
}

/** The share of the first home's rent that comes in: nothing before the flat is repaired, then flat by flat. */
export function rentShare(r: Reno | null): number {
  if (!r) return 1;
  if (r.stage === 'flat') return 0;
  if (r.stage === 'rest') return Math.min(1, (1 + (r.fixed ?? 0)) / (r.units ?? 1));
  return 1;
}

/** Whether a package is wanted at the building now. */
export function wantsJob(r: Reno | null): boolean {
  return r?.stage === 'flat' || r?.stage === 'rest' || r?.stage === 'paint';
}

/** What a station's package is, for each kind of job: the line said as it is picked up. */
export function jobLines(r: Reno): Record<JobKind, string> {
  const units = r.units ?? 1;
  const which = r.stage === 'flat' ? 'your flat' : r.stage === 'rest' ? `flat ${2 + (r.fixed ?? 0)} of ${units}` : 'the outside of your building';
  if (r.stage === 'paint') {
    const line = 'Paint for the outside of your building: take it there, and then choose its colour';
    return { plain: line, supply: `${line}. A heavy load: mind the dents`, rush: `${line}. Quick, before the weather turns`, clean: `${line}. Drive clean or the job is gone` };
  }
  return {
    plain: `Things to repair ${which}: take them to your building`,
    supply: `Paint and plaster for ${which}: a heavy load, take it to your building`,
    rush: `A plumber's part for the pipes of ${which}: quick, the clock is short`,
    clean: `New locks and windows for ${which}: drive clean or the job is gone`,
  };
}
