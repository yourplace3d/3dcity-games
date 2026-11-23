/**
 * Things that happen at the player's homes, each solved by a mission (the owner, 23 November 2026;
 * `docs/plan-returning-players.md`, section 4). Step 1 is renovation: a while after a home was bought or
 * last renovated, its walls wear down, and a package from any station renovates it.
 *
 * The rules for all of them:
 * - from the player's second day with a home on, or on the first after `FIRST_DAY_S` of play;
 * - at most one new one a day, after the first delivery of the visit, with no package on board;
 * - at a home in the part of town being played, chosen at random, never by the part of town (the game
 *   makes no statement about real neighbourhoods);
 * - while one is open, that home's rent waits: it is not lost, and is paid out when the event is solved.
 *
 * Kept in the browser under `3da-events`, so saving online carries it along.
 */

import type { JobKind } from './services';

const STORE = '3da-events';
const DAY_MS = 86400000;

/** seconds of play on the day of the first home before something may happen (the owner: "if visit 1 is longer than say 30 minutes") */
export const FIRST_DAY_S = 1800;
/** days after a home was bought or last renovated before it may need renovating (estimate) */
export const RENOVATE_AFTER_DAYS = 7;
/** seconds of play after a card before an event's card may come, so two do not follow at once */
export const AFTER_CARD_S = 30;

export type EventKind = 'renovate';

export interface HomeEvent {
  /** the home, as `homeKey` names it */
  home: string;
  kind: EventKind;
  /** the day it began (YYYY-MM-DD) */
  began: string;
  /** rent that has waited at the building since */
  waiting: number;
}

export interface Events {
  open: HomeEvent[];
  /** the day the last event began */
  last: string;
  /** the day the player first had a home, as this module first saw it; 'before' for homes from before it */
  first: string;
  /** each home renovated, with the day (days since 1970) */
  renovated: Record<string, number>;
}

/** A home's name in the events: its map number and its place, as a map number alone may repeat. */
export function homeKey(h: { id: string; lat: number; lon: number }): string {
  return `${h.id}@${h.lat.toFixed(5)},${h.lon.toFixed(5)}`;
}

export function readEvents(raw: string | null, hasHomes: boolean): Events {
  const none: Events = { open: [], last: '', first: hasHomes ? 'before' : '', renovated: {} };
  try {
    const k = JSON.parse(raw ?? 'null') as Partial<Events> | null;
    if (!k || typeof k !== 'object') return none;
    const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
    const open = Array.isArray(k.open)
      ? k.open.flatMap((e) =>
          e && typeof e.home === 'string' && e.kind === 'renovate' && day(e.began)
            ? [{ home: e.home, kind: e.kind, began: e.began, waiting: typeof e.waiting === 'number' && Number.isFinite(e.waiting) && e.waiting > 0 ? Math.round(e.waiting) : 0 }]
            : [],
        )
      : [];
    const renovated: Record<string, number> = {};
    if (k.renovated && typeof k.renovated === 'object') {
      for (const [h, d] of Object.entries(k.renovated)) if (typeof d === 'number' && Number.isFinite(d)) renovated[h] = Math.floor(d);
    }
    const first = k.first === 'before' ? 'before' : day(k.first) || none.first;
    return { open, last: day(k.last), first, renovated };
  } catch {
    return none;
  }
}

export function loadEvents(hasHomes: boolean): Events {
  try {
    return readEvents(localStorage.getItem(STORE), hasHomes);
  } catch {
    return readEvents(null, hasHomes);
  }
}

export function storeEvents(e: Events): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, ...e }));
  } catch {
    /* private window: for this visit only */
  }
}

export interface EventNow {
  /** today (YYYY-MM-DD, as `dayOf` gives it) */
  today: string;
  /** seconds played on this visit */
  playedS: number;
  /** deliveries made on this visit */
  deliveredHere: number;
  /** seconds played since the last card */
  sinceCardS: number;
  /** a package on board, a card up, a city being guessed, or the rent not yet said */
  busy: boolean;
}

/** Whether something may happen at a home now. */
export function eventDue(e: Events, n: EventNow): boolean {
  if (n.busy || e.last === n.today || n.deliveredHere < 1 || n.sinceCardS < AFTER_CARD_S) return false;
  // not on the day of the first home, unless that visit is a long one
  if (!e.first || (e.first === n.today && n.playedS < FIRST_DAY_S)) return false;
  return true;
}

/** Days since 1970 of a moment, as homes keep the day they were bought. */
export const dayNumber = (ms: number): number => Math.floor(ms / DAY_MS);

/**
 * The homes that may need renovating now: in the part of town being played (`here`), with nothing open,
 * and bought or last renovated `RENOVATE_AFTER_DAYS` days ago or more.
 */
export function renovationCandidates<H extends { id: string; lat: number; lon: number; at: number }>(homes: H[], e: Events, today: number, here: (h: H) => boolean): H[] {
  return homes.filter((h) => {
    const key = homeKey(h);
    if (!here(h) || e.open.some((o) => o.home === key)) return false;
    const since = Math.max(dayNumber(h.at), e.renovated[key] ?? -Infinity);
    return today - since >= RENOVATE_AFTER_DAYS;
  });
}

/** What a station's package is, for a home being renovated: the line said as it is picked up. */
export function renovateLines(what: string): Record<JobKind, string> {
  return {
    plain: `Things to renovate ${what}: take them to the building`,
    supply: `Paint and plaster for ${what}: a heavy load, take it to the building`,
    rush: `A plumber's part for ${what}: quick, the clock is short`,
    clean: `New windows for ${what}: drive clean or the job is gone`,
  };
}

/** The tenants' thanks when their home is renovated: a quarter of a day's rent, in tens. */
export function thanks(rent: number): number {
  return Math.max(10, Math.round((rent * 0.25) / 10) * 10);
}
