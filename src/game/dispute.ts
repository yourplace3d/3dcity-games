/**
 * The tenants' dispute (the owner, 23 and 26 November 2026; `docs/brainstorm-story.md`, sections 8 and 13):
 * chapter 8 of the story, and from then on one of the things that happen at the player's homes.
 *
 * Reading people, then driving (the owner's "4c"):
 * 1. The tenants stop paying and write a note, in one of two moods, chosen at random: something is broken
 *    (the heating), or money is tight (one of them lost a job). Their rent waits at the building.
 * 2. Stopped beside the home, the player chooses: insist on all of it (a rush job with the part, from a
 *    fire station) or accept part of it (a supply run with what the flat needs, from a fuel station).
 * 3. The choice that fits the mood makes its job easier: a longer clock for the part when the heating is
 *    broken, a lighter load when money is tight. The drive settles it.
 *
 * | You choose  | It goes well (in time; no new dent)          | It escalates (too late or lost; dented)                  |
 * |-------------|----------------------------------------------|----------------------------------------------------------|
 * | Insist      | all the rent that waited, and a tip          | the court's order: a clean run with the officers, a bill of 5 days' rent, new tenants |
 * | Accept part | the rent that waited; a fifth less for 7 days | the old boiler gives up: 3 days' rent and one more package from any station |
 *
 * No dice the player cannot see: chance only picks the mood. The tenants are never wrong in the wording,
 * nor is the player; the court's order is told as a court's decision carried out by officers, with no
 * arrest and no chase.
 */

import type { JobKind } from './services';
import { tenantNames } from './names';
import type { Mood, Stage } from './events';
import { T } from '../i18n';
import type { Case } from '../lang/en';

/** a home bought this many days ago or more may have a dispute (estimate) */
export const DISPUTE_AFTER_DAYS = 3;
/** days between two disputes at the same home (estimate) */
export const DISPUTE_GAP_DAYS = 14;
/** the part's clock, when the heating is what the tenants need: this much longer (estimate) */
export const CLOCK_FITS = 1.4;
/** the load, when money is what the tenants need: this share of a heavy load's slowing (the brainstorm's estimate: half) */
export const LIGHT_LOAD = 0.5;
/** the court's and the officers' bill, in days of the home's rent (the owner: "the bill should be high") */
export const COURT_DAYS = 5;
/** a new boiler, in days of the home's rent */
export const REPLACE_DAYS = 3;
/** the rent agreed when accepting part: this share, for `LOWER_DAYS` days */
export const LOWER_SHARE = 0.8;
export const LOWER_DAYS = 7;

/** Money in tens, as the game shows it. */
const tens = (n: number) => Math.max(10, Math.round(n / 10) * 10);

export const courtBill = (rent: number): number => tens(rent * COURT_DAYS);
export const replaceCost = (rent: number): number => tens(rent * REPLACE_DAYS);
/** The rent a home pays while the lower rent agreed holds. */
export const lowered = (rent: number): number => Math.round(rent * LOWER_SHARE);

/** The stations whose packages a stage takes: insisting brings the part, accepting part the load, the court's order the officers. */
export function kindsFor(stage: Stage): JobKind[] | null {
  switch (stage) {
    case 'insist':
      return ['rush'];
    case 'accept':
      return ['supply'];
    case 'court':
      return ['clean'];
    case 'replace':
      return ['plain', 'supply', 'rush', 'clean'];
    default:
      return null;
  }
}

/** Whether the choice made fits what the tenants wrote: the heating, insist and fix it; money, accept part. */
export const fits = (mood: Mood, stage: Stage): boolean => (mood === 'broken' && stage === 'insist') || (mood === 'tight' && stage === 'accept');

/**
 * What a stage's job leads to: `ok` is the drive done well (in time; for the load, no new dent too). The
 * court's order and the replacement are tried again until they are done; nothing escalates twice.
 */
export function after(stage: Stage, ok: boolean): Stage | 'settled' {
  switch (stage) {
    case 'insist':
      return ok ? 'settled' : 'court';
    case 'accept':
      return ok ? 'settled' : 'replace';
    case 'court':
      return ok ? 'moving' : 'court';
    case 'replace':
      return ok ? 'settled' : 'replace';
    default:
      return stage;
  }
}

// ---------------------------------------------------------------- who the tenants are

/** Who lives there: what they are, and whether one or two of them write. */
export const TENANTS: ReadonlyArray<{ what: string; two: boolean }> = [
  { what: 'a student', two: false },
  { what: 'a couple with a baby', two: true },
  { what: 'a retired teacher', two: false },
  { what: 'a nurse on night shifts', two: false },
  { what: 'a musician', two: false },
  { what: 'two flatmates', two: true },
  { what: 'a bus driver', two: false },
  { what: 'a cook', two: false },
  { what: 'a young family', two: true },
  { what: 'a carpenter', two: false },
];

export interface Tenants {
  /** "Lena and Max" */
  names: string;
  /** "a couple with a baby" */
  what: string;
  two: boolean;
}

/** A small number from a text, the same each time. */
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A home's tenants: made up from the home (and how many times its tenants have changed), so the same home
 * keeps the same tenants until the court's order brings new ones. Names from the home's own region, none of
 * the story's people (`avoid`).
 */
export function tenantsOf(home: { key: string; lat: number; lon: number }, moved: number, avoid: string[] = []): Tenants {
  const seed = `${home.key}#${moved}`;
  const i = hash(seed) % TENANTS.length;
  const t = TENANTS[i];
  // new tenants are other people than those who just moved out
  const before = moved > 0 ? tenantsOf(home, moved - 1, avoid).names.split(T.and) : [];
  const names = tenantNames(home.lat, home.lon, seed, t.two ? 2 : 1, [...avoid, ...before]);
  return { names: names.join(T.and), what: T.tenantWhat[i] ?? t.what, two: t.two };
}

// ---------------------------------------------------------------- what they say

/** The tenants' first note: what they need is in it. */
export function note(mood: Mood, t: Tenants, kind: 'flat' | 'house' | 'building'): string {
  // in a whole building, they live in one of its flats
  return T.tenantNote(mood === 'broken', t.two, kind !== 'house');
}

/** The card at the home: their words, and what each choice asks of the player. */
export function choiceText(mood: Mood, t: Tenants, kind: 'flat' | 'house' | 'building'): string {
  return [
    `“${note(mood, t, kind)}” ${t.names}, ${t.what}.`,
    T.choiceInsist,
    T.choiceAccept(kind !== 'house'),
  ].join('\n');
}

/** What a package for a dispute is, said as it is picked up: by the stage, and whether the choice fits. */
export function pickupLines(stage: Stage, mood: Mood, where: string | ((c: Case) => string), officer: string): Record<JobKind, string> {
  const at = typeof where === 'string' ? () => where : where;
  const all = (line: string): Record<JobKind, string> => ({ plain: line, supply: line, rush: line, clean: line });
  if (stage === 'insist') return all(T.pickInsist(fits(mood, stage), at));
  if (stage === 'accept') return all(T.pickAccept(fits(mood, stage), at));
  if (stage === 'court') return all(T.pickCourt(officer, at));
  return T.pickBoiler(at);
}

/** The tenants' answer, by how it went; `kind`: the home, for the word they use for it. */
export function answer(stage: Stage, ok: boolean, mood: Mood, kind: 'flat' | 'house' | 'building' = 'flat'): string {
  if (stage === 'insist') {
    return T.answerInsist(ok, mood === 'broken', kind !== 'house');
  }
  if (stage === 'accept') return T.answerAccept(ok);
  if (stage === 'replace') return ok ? T.answerReplace : '';
  return '';
}

/** The new tenants' first note, as they move in. */
export const welcome = (): string => T.tenantsWelcome;

/** The officer's notes: the court's order for the home (a flat, a house, a building), and when it is carried out. */
export const officerOrder = (kind: 'flat' | 'house' | 'building' = 'building'): string => T.officerOrder(kind);
export const officerDone = (): string => T.officerDone;

/**
 * A line for "The story so far": what was chosen, and how it went. `late`: the part ran out of time; else
 * it was lost on the way (the police caught the player, they were knocked out, or the job was taken away).
 */
export function storyLine(stage: Stage, ok: boolean, street: string, late = true): string {
  const at = street ? `${street}: ` : '';
  if (stage === 'insist') return T.soFarInsist(at, ok, late);
  if (stage === 'accept') return T.soFarAccept(at, ok);
  return '';
}

/** The day the next dispute may begin at a home: bought long enough ago, and none there for a while. */
export function disputeCandidates<H extends { at: number; key: string }>(homes: H[], open: Set<string>, disputed: Record<string, number>, today: number, here: (h: H) => boolean): H[] {
  return homes.filter((h) => {
    if (!here(h) || open.has(h.key)) return false;
    if (today - Math.floor(h.at / 86400000) < DISPUTE_AFTER_DAYS) return false;
    return today - (disputed[h.key] ?? -Infinity) >= DISPUTE_GAP_DAYS;
  });
}

/** The mood, at random: the one thing left to chance. */
export const pickMood = (r = Math.random()): Mood => (r < 0.5 ? 'broken' : 'tight');
