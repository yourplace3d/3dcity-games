/**
 * Learning to use the bank, for players who come back (the owner's order of 23 November 2026):
 *
 * 1. On the first visit a home is bought.
 * 2. On a later day the rent comes in as cash, and a card says which home paid what.
 * 3. After the first delivery of that visit, or after a minute of play, a mission: carry the cash to
 *    the bank, where fines can't touch it. The arrow shows the nearest bank of the home plate. It waits
 *    for rent to have come in on a return at least once, so it never comes on the day of the first home.
 * 4. From then on, a reminder whenever the cash carried grows large: a line, and the arrow to the
 *    nearest bank for a while.
 *
 * Banks are only in the home plate (`bank.ts`), so the mission and the reminders wait for a visit
 * there. Kept in the browser under `3da-banklesson`, so saving online carries it along.
 */

const STORE = '3da-banklesson';

/** `offer`: not yet asked, or put off ("Later"); `go`: on the way to the bank; `done`: paid in once */
export type LessonStage = 'offer' | 'go' | 'done';

export interface Lesson {
  stage: LessonStage;
  /** `offer`, put off: the day it was put off, so it is asked again on another day */
  later?: string;
  /** rent has come in on a return: the mission is for a player who comes back */
  rent?: boolean;
}

/** seconds of play before the mission comes up, when no delivery came first */
export const LESSON_AFTER_S = 60;
/** the least cash carried for the mission to be worth it */
export const LESSON_MIN = 100;
/** the least cash carried for a reminder */
export const REMIND_MIN = 1000;
/** seconds of play between two reminders */
export const REMIND_GAP_S = 240;
/** seconds the arrow shows the way to the bank after a reminder */
export const REMIND_ARROW_S = 45;

export function readLesson(raw: string | null, hasSavings: boolean): Lesson {
  try {
    const r = JSON.parse(raw ?? 'null') as Partial<Lesson> | null;
    if (r && (r.stage === 'offer' || r.stage === 'go' || r.stage === 'done')) {
      return { stage: r.stage, ...(r.stage === 'offer' && typeof r.later === 'string' ? { later: r.later } : {}), ...(r.rent === true ? { rent: true } : {}) };
    }
  } catch {
    /* not kept, or kept oddly: as new */
  }
  // a player who has paid in before knows the bank: no mission, only the reminders
  return { stage: hasSavings ? 'done' : 'offer' };
}

export function loadLesson(hasSavings: boolean): Lesson {
  try {
    return readLesson(localStorage.getItem(STORE), hasSavings);
  } catch {
    return readLesson(null, hasSavings);
  }
}

export function storeLesson(l: Lesson): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, ...l }));
  } catch {
    /* private window: for this visit only */
  }
}

export interface LessonNow {
  /** today, as `dayOf` gives it */
  today: string;
  /** the square being played is in the home plate and has a bank */
  bankHere: boolean;
  /** cash carried */
  cash: number;
  /** deliveries made on this visit */
  deliveredHere: number;
  /** seconds played on this visit, cards and pauses not counted */
  playedS: number;
  /** a package is on board, or a card is up */
  busy: boolean;
}

/** Whether the mission to the bank is asked now. */
export function lessonDue(l: Lesson, n: LessonNow): boolean {
  if (l.stage !== 'offer' || l.later === n.today) return false;
  // it is for a player who comes back: once rent has come in on a return
  if (!l.rent) return false;
  if (!n.bankHere || n.busy || n.cash < LESSON_MIN) return false;
  return n.deliveredHere >= 1 || n.playedS >= LESSON_AFTER_S;
}

/** The cash that brings a reminder: at least `REMIND_MIN`, and at least a day of rent from all one's homes. */
export function remindAt(rentPerDay: number): number {
  return Math.max(REMIND_MIN, Math.ceil(rentPerDay / 100) * 100);
}

/** Whether to remind now: the lesson learnt, a bank here, much cash carried, and none said for a while. */
export function remindDue(l: Lesson, n: LessonNow, rentPerDay: number, sinceLastS: number): boolean {
  return l.stage === 'done' && n.bankHere && !n.busy && n.cash >= remindAt(rentPerDay) && sinceLastS >= REMIND_GAP_S;
}

/** What a fine would take of the cash carried, when caught (a quarter, as `Game.fine`). */
export function caughtCost(cash: number): number {
  return Math.min(cash, Math.max(50, Math.round((cash * 0.25) / 10) * 10));
}

/** Of several banks, the nearest to a point. */
export function nearestBank<T extends { x: number; y: number }>(banks: T[], x: number, y: number): T | null {
  let best: T | null = null;
  let d = Infinity;
  for (const b of banks) {
    const e = Math.hypot(b.x - x, b.y - y);
    if (e < d) {
      d = e;
      best = b;
    }
  }
  return best;
}
