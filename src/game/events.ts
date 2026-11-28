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
import { T } from '../i18n';

const STORE = '3da-events';
const DAY_MS = 86400000;

/** seconds of play on the day of the first home before something may happen (the owner: "if visit 1 is longer than say 30 minutes") */
export const FIRST_DAY_S = 1800;
/** days after a home was bought or last renovated before it may need renovating (estimate) */
export const RENOVATE_AFTER_DAYS = 7;
/** seconds of play after a card before an event's card may come, so two do not follow at once */
export const AFTER_CARD_S = 30;

export type EventKind = 'renovate' | 'dispute';

/** The tenants' mood in a dispute (`dispute.ts`): something is broken, or money is tight. */
export type Mood = 'broken' | 'tight';
/**
 * Where a dispute stands: the tenants wait to talk; the job of the choice made (insist: a rush job;
 * accept part: a supply run); the court's order (a clean run with the officers); a replacement (a package
 * from any station); new tenants, who move in with the next delivery.
 */
export type Stage = 'talk' | 'insist' | 'accept' | 'court' | 'replace' | 'moving';
const MOODS: Mood[] = ['broken', 'tight'];
const STAGES: Stage[] = ['talk', 'insist', 'accept', 'court', 'replace', 'moving'];

export interface HomeEvent {
  /** the home, as `homeKey` names it */
  home: string;
  kind: EventKind;
  /** the day it began (YYYY-MM-DD) */
  began: string;
  /** rent that has waited at the building since */
  waiting: number;
  /** a dispute: the tenants' mood */
  mood?: Mood;
  /** a dispute: where it stands */
  stage?: Stage;
  /** a dispute: the story's chapter 8 */
  chapter?: boolean;
}

export interface Events {
  open: HomeEvent[];
  /** the day the last event began */
  last: string;
  /** the day the player first had a home, as this module first saw it; 'before' for homes from before it */
  first: string;
  /** each home renovated, with the day (days since 1970) */
  renovated: Record<string, number>;
  /** each home's last dispute, with the day it began (days since 1970) */
  disputed: Record<string, number>;
  /** disputes settled, in all: from the first on, they also come as events */
  settled: number;
  /** homes whose rent is a fifth lower until this day (days since 1970, the last day it is), as agreed in a dispute */
  lower: Record<string, number>;
  /** how many times each home's tenants have changed: the court's order brings new ones */
  moved: Record<string, number>;
  /** homes whose tenants it went well with: they come to the next party there, once */
  glad: string[];
}

/** A home's name in the events: its map number and its place, as a map number alone may repeat. */
export function homeKey(h: { id: string; lat: number; lon: number }): string {
  return `${h.id}@${h.lat.toFixed(5)},${h.lon.toFixed(5)}`;
}

/** A record of numbers by home, keeping only whole numbers. */
function days(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [h, d] of Object.entries(v)) if (typeof d === 'number' && Number.isFinite(d)) out[h] = Math.floor(d);
  return out;
}

export function readEvents(raw: string | null, hasHomes: boolean): Events {
  const none: Events = { open: [], last: '', first: hasHomes ? 'before' : '', renovated: {}, disputed: {}, settled: 0, lower: {}, moved: {}, glad: [] };
  try {
    const k = JSON.parse(raw ?? 'null') as Partial<Events> | null;
    if (!k || typeof k !== 'object') return none;
    const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
    const open = Array.isArray(k.open)
      ? k.open.flatMap((e): HomeEvent[] => {
          if (!e || typeof e.home !== 'string' || !day(e.began)) return [];
          const waiting = typeof e.waiting === 'number' && Number.isFinite(e.waiting) && e.waiting > 0 ? Math.round(e.waiting) : 0;
          if (e.kind === 'renovate') return [{ home: e.home, kind: e.kind, began: e.began, waiting }];
          if (e.kind !== 'dispute' || !MOODS.includes(e.mood as Mood)) return [];
          const stage = STAGES.includes(e.stage as Stage) ? (e.stage as Stage) : 'talk';
          return [{ home: e.home, kind: e.kind, began: e.began, waiting, mood: e.mood, stage, ...(e.chapter ? { chapter: true } : {}) }];
        })
      : [];
    const first = k.first === 'before' ? 'before' : day(k.first) || none.first;
    return {
      // one open at a home at most
      open: open.filter((e, i) => open.findIndex((o) => o.home === e.home) === i),
      last: day(k.last),
      first,
      renovated: days(k.renovated),
      disputed: days(k.disputed),
      settled: typeof k.settled === 'number' && Number.isInteger(k.settled) && k.settled > 0 ? k.settled : 0,
      lower: days(k.lower),
      moved: days(k.moved),
      glad: Array.isArray(k.glad) ? [...new Set(k.glad.filter((g): g is string => typeof g === 'string'))].slice(-50) : [],
    };
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
  return T.renovateLines(what);
}

/** The tenants' thanks when their home is renovated: a quarter of a day's rent, in tens. */
export function thanks(rent: number): number {
  return Math.max(10, Math.round((rent * 0.25) / 10) * 10);
}
