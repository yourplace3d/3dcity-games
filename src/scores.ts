/**
 * The scoreboard: finished runs, best first. Kept in this browser only, so
 * it is the board of whoever plays on this device.
 */

export interface Score {
  /** what the player typed; empty when they left it out */
  name: string;
  score: number;
  seconds: number;
  place: string;
  /** how many deliveries the run had; runs from before this was written down had five */
  jobs?: number;
  /** when the run ended (ms since 1970); also tells entries apart */
  at: number;
}

const KEY = '3da-scores';
const NAME_KEY = '3da-name';
const KEEP = 50;

export function scores(): Score[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Score[];
    return Array.isArray(list) ? list.filter((s) => typeof s?.score === 'number') : [];
  } catch {
    return [];
  }
}

function store(list: Score[]): void {
  list.sort((a, b) => b.score - a.score || a.seconds - b.seconds);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, KEEP)));
  } catch {
    /* private window: the board lasts as long as the page */
  }
}

/** Put a finished run on the board. */
export function addScore(s: Score): void {
  store([...scores(), s]);
}

/** Write a name on a run that is already on the board. */
export function nameScore(at: number, name: string): void {
  const list = scores();
  const mine = list.find((s) => s.at === at);
  if (mine) mine.name = name;
  store(list);
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* nothing to remember it in */
  }
}

/** The name written last time, to offer again. */
export function lastName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
