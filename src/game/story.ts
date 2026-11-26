/**
 * The story (the owner, 26 November 2026; `docs/brainstorm-story.md`): eight chapters that put what the
 * game has in order, from a parked car to a whole building. This file holds the rules alone, with no
 * screen: which chapter is open, when the next one opens, and what each says. `storyUi.ts` shows it.
 *
 * The rules:
 * - Chapters 1 to 3 open one after another, on any day: a first visit plays straight through to the first
 *   flat ("free to the flat"). From chapter 4 on, one new chapter on each new day you play: the next opens
 *   once the one before is done, and not on the day the one before opened.
 * - The story never locks what the game allows: what a chapter asks may be done before it opens, and it
 *   counts when the chapter comes. Only the scenes wait for their day.
 * - A player who is further on starts where they are: what the browser already holds ticks chapters at
 *   once, silently (they are not counted as played).
 * - Chapter 8 (the tenants' dispute) is not built yet: the story waits after chapter 7.
 *
 * Kept in the browser under `3da-story`, so saving online carries it along.
 */

import type { JobKind } from './services';
import type { Names } from './names';

const STORE = '3da-story';

export const CHAPTERS = ['Arrival', 'Making rent', 'A roof over your head', 'Safe money', 'The regulars', 'Housewarming', 'The whole building', 'Landlord'] as const;
/** chapters there are */
export const ALL = CHAPTERS.length;
/** chapters built so far: the rest come in an update */
export const BUILT = 7;
/** chapters that open as soon as the one before is done, on any day */
export const FREE = 3;
/** messages kept for the menu */
export const INBOX_MAX = 24;
/** people's messages waiting to be shown, kept so that a closed page loses none */
export const PENDING_MAX = 12;

/** Who speaks: the game itself, or a person, each with a look of their own. */
export type Who = 'game' | 'pump' | 'flame' | 'shield' | 'neighbour' | 'friends';
export type Person = Exclude<Who, 'game'>;
/** The people at the stations, by the job their station hands out. */
export const PERSON_OF: Record<Exclude<JobKind, 'plain'>, Who> = { supply: 'pump', rush: 'flame', clean: 'shield' };
export const STATION_JOBS: Array<Exclude<JobKind, 'plain'>> = ['supply', 'rush', 'clean'];

export interface Message {
  who: Who;
  /** who it is from, as shown ("Mira · the pump"); for the friends, the friend's name */
  from: string;
  text: string;
  /** the day it came (YYYY-MM-DD) */
  day: string;
}

export interface Story {
  /** the chapter open now, or the next one waiting for its day; `BUILT + 1` once every chapter built is done */
  open: number;
  /** the day `open` opened; '' while it waits for a new day */
  opened: string;
  /** the day the last chapter opened */
  last: string;
  /** chapters done, with the day; `silent`: ticked at once from what the player had, not played */
  done: Record<number, { day: string; silent?: boolean }>;
  /** the first day of the story */
  first: string;
  /** kinds of station job delivered since the story began */
  kinds: JobKind[];
  /** the scenes already shown, each once */
  said: string[];
  /** the messages, newest last */
  inbox: Message[];
  /** the people's messages still to be shown: they wait for a quiet moment, and for the home town */
  pending: Array<{ who: Person; text: string }>;
  /** the friends' messages shown so far: the three take turns */
  turn: number;
  /** the people's names, drawn once from the home town */
  names?: Names;
}

/** What the game holds, as the story reads it. */
export interface Snapshot {
  /** deliveries ever made */
  delivered: number;
  homes: number;
  /** the first-home mission's stage, or null */
  reno: 'find' | 'flat' | 'buy' | 'rest' | 'paint' | 'done' | null;
  /** money in the bank */
  saved: number;
  /** a party has been thrown */
  partied: boolean;
  /** a whole building is owned */
  building: boolean;
}

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const WHO: Who[] = ['game', 'pump', 'flame', 'shield', 'neighbour', 'friends'];
const JOBS: JobKind[] = ['plain', 'supply', 'rush', 'clean'];

/** A story that has not begun. */
export function none(): Story {
  return { open: 0, opened: '', last: '', done: {}, first: '', kinds: [], said: [], inbox: [], pending: [], turn: 0 };
}

export function readStory(raw: string | null): Story {
  try {
    const k = JSON.parse(raw ?? 'null') as Partial<Story> | null;
    if (!k || typeof k !== 'object') return none();
    const open = typeof k.open === 'number' && Number.isInteger(k.open) ? Math.max(0, Math.min(BUILT + 1, k.open)) : 0;
    const done: Story['done'] = {};
    if (k.done && typeof k.done === 'object') {
      for (const [n, d] of Object.entries(k.done)) {
        const c = Number(n);
        if (Number.isInteger(c) && c >= 1 && c <= ALL && d && isDay(d.day)) done[c] = d.silent ? { day: d.day, silent: true } : { day: d.day };
      }
    }
    const inbox = Array.isArray(k.inbox)
      ? k.inbox.flatMap((m) => (m && WHO.includes(m.who) && typeof m.text === 'string' && typeof m.from === 'string' && isDay(m.day) ? [{ who: m.who, from: m.from.slice(0, 80), text: m.text.slice(0, 400), day: m.day }] : [])).slice(-INBOX_MAX)
      : [];
    const pending = Array.isArray(k.pending)
      ? (k.pending as Array<{ who?: unknown; text?: unknown } | null>)
          .flatMap((m) => (m && typeof m.who === 'string' && m.who !== 'game' && WHO.includes(m.who as Who) && typeof m.text === 'string' ? [{ who: m.who as Person, text: m.text.slice(0, 400) }] : []))
          .slice(-PENDING_MAX)
      : [];
    const names = readNames(k.names);
    return {
      open,
      opened: isDay(k.opened) ? k.opened : '',
      last: isDay(k.last) ? k.last : '',
      done,
      first: isDay(k.first) ? k.first : '',
      kinds: Array.isArray(k.kinds) ? [...new Set(k.kinds.filter((j): j is JobKind => JOBS.includes(j)))] : [],
      said: Array.isArray(k.said) ? [...new Set(k.said.filter((s): s is string => typeof s === 'string'))].slice(0, 200) : [],
      inbox,
      pending,
      turn: typeof k.turn === 'number' && Number.isInteger(k.turn) && k.turn >= 0 ? k.turn % 3 : 0,
      ...(names ? { names } : {}),
    };
  } catch {
    return none();
  }
}

function readNames(v: unknown): Names | null {
  const n = v as Partial<Names> | null;
  const ok = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length < 40;
  if (!n || typeof n !== 'object' || !ok(n.pump) || !ok(n.flame) || !ok(n.shield) || !ok(n.neighbour) || !Array.isArray(n.friends) || n.friends.length !== 3 || !n.friends.every(ok)) return null;
  return { region: ok(n.region) ? n.region : 'shared', pump: n.pump, flame: n.flame, shield: n.shield, neighbour: n.neighbour, friends: [n.friends[0], n.friends[1], n.friends[2]] };
}

export function loadStory(): Story {
  try {
    return readStory(localStorage.getItem(STORE));
  } catch {
    return none();
  }
}

export function storeStory(s: Story): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, ...s }));
  } catch {
    /* private window: for this visit only */
  }
}

/** Whether what chapter `n` asks is done. */
export function finished(n: number, s: Snapshot, story: Story): boolean {
  switch (n) {
    case 1:
      return s.delivered >= 1;
    case 2:
      return s.delivered >= 2;
    case 3:
      // a home, and the first flat repaired
      return s.homes >= 1 && s.reno !== 'find' && s.reno !== 'flat';
    case 4:
      return s.saved > 0;
    case 5:
      return STATION_JOBS.every((k) => story.kinds.includes(k));
    case 6:
      return s.partied;
    case 7:
      // a whole building, and nothing left to repair at the first one
      return s.building && (s.reno === null || s.reno === 'done');
    default:
      return false;
  }
}

/** The first chapter not done, or `BUILT + 1`. */
function nextOf(story: Story): number {
  for (let n = 1; n <= BUILT; n++) if (!story.done[n]) return n;
  return BUILT + 1;
}

/**
 * The story begins: what the player has done already is ticked at once, silently, and the first chapter
 * not done opens.
 */
export function begin(s: Snapshot, today: string): Story {
  const story = none();
  story.first = today;
  for (let n = 1; n <= BUILT; n++) if (finished(n, s, story)) story.done[n] = { day: today, silent: true };
  story.open = nextOf(story);
  if (story.open <= BUILT) {
    story.opened = today;
    story.last = today;
  }
  return story;
}

export interface Step {
  story: Story;
  /** chapters finished in play just now, in order */
  finished: number[];
  /** of those, the ones done while they still waited for their day: they never opened, so nothing was said of them */
  early: number[];
  /** the chapter that opened just now, if one did */
  opened: number | null;
}

/** Move the story on: chapters done, and the next one opened when its day has come. */
export function advance(before: Story, s: Snapshot, today: string): Step {
  const story: Story = { ...before, done: { ...before.done } };
  const done: number[] = [];
  const early: number[] = [];
  let opened: number | null = null;
  let changed = false;
  for (let guard = 0; guard < ALL + 2 && story.open >= 1 && story.open <= BUILT; guard++) {
    const n = story.open;
    if (finished(n, s, story)) {
      // done, whether it had opened or was waiting for its day: what a chapter asks may be done before it opens
      story.done[n] = { day: today };
      done.push(n);
      if (!story.opened) early.push(n);
      story.open = nextOf(story);
      story.opened = '';
      changed = true;
      continue;
    }
    if (story.opened) break;
    // waiting: the first chapters open at once; later ones on a day after the last one opened
    if (n <= FREE || today !== story.last) {
      story.opened = today;
      story.last = today;
      opened = n;
      changed = true;
    }
    break;
  }
  // nothing moved: the same story, so nothing is written again
  return { story: changed ? story : before, finished: done, early, opened };
}

/** A station's job was delivered: its kind is kept, for chapter 5. */
export function noteJob(story: Story, kind: JobKind): Story {
  return story.kinds.includes(kind) ? story : { ...story, kinds: [...story.kinds, kind] };
}

/** People's messages are kept until they have been shown. */
export function addPending(story: Story, lines: Array<[Who, string]>): Story {
  const add = lines.flatMap(([who, text]) => (who === 'game' ? [] : [{ who, text }]));
  return add.length ? { ...story, pending: [...story.pending, ...add].slice(-PENDING_MAX) } : story;
}

/** A person's message has been shown: it no longer waits. */
export function shown(story: Story, who: Person, text: string): Story {
  const i = story.pending.findIndex((m) => m.who === who && m.text === text);
  return i < 0 ? story : { ...story, pending: story.pending.filter((_, j) => j !== i) };
}

/** A scene is shown once: whether it has been. */
export const said = (story: Story, key: string): boolean => story.said.includes(key);
export const say = (story: Story, key: string): Story => (said(story, key) ? story : { ...story, said: [...story.said, key] });

/** A message is kept for the menu. */
export function keep(story: Story, m: Message): Story {
  return { ...story, inbox: [...story.inbox, m].slice(-INBOX_MAX) };
}

/** The people met: those who have written, or whose message waits to be shown. */
export function met(story: Story): Who[] {
  return [...new Set([...story.inbox.map((m) => m.who), ...story.pending.map((m) => m.who)].filter((w) => w !== 'game'))];
}

// ---------------------------------------------------------------- what the story says

/** "Mira · the pump" */
export function sender(who: Who, names: Names | undefined): string {
  if (!names || who === 'game') return '';
  switch (who) {
    case 'pump':
      return `${names.pump} · the pump`;
    case 'flame':
      return `${names.flame} · the fire station`;
    case 'shield':
      return `${names.shield} · the police`;
    case 'neighbour':
      return `${names.neighbour} · your neighbour`;
    case 'friends':
      return 'Your friends';
  }
}

/** A person by name and station, for the game's own lines: "Theo at the fire station". */
export function atStation(kind: Exclude<JobKind, 'plain'>, names: Names | undefined): string {
  const where = { supply: 'the pump', rush: 'the fire station', clean: 'the police station' }[kind];
  const who = names ? { supply: names.pump, rush: names.flame, clean: names.shield }[kind] : '';
  return who ? `${who} at ${where}` : where;
}

export interface Goal {
  /** what to do, in a line */
  text: string;
  /** where the arrow can lead, if anywhere */
  way: 'bank' | 'station' | 'home' | null;
}

export interface GoalState extends Snapshot {
  /** the home town's name, once there is a first home */
  town: string;
  /** homes it takes before whole buildings are for sale */
  buildingsAfter: number;
}

/** What the open chapter asks, as it stands. */
export function goal(n: number, s: GoalState, story: Story): Goal {
  switch (n) {
    case 1:
      return { text: 'Get in a car and deliver a package.', way: null };
    case 2:
      return { text: 'One more delivery, and a flat of your own is in reach.', way: null };
    case 3:
      return s.homes
        ? { text: 'Repair your flat: take a job at a fuel, fire or police station. Their rings flash green.', way: 'station' }
        : { text: 'Buy a worn-down flat. After your deliveries, the game shows you where.', way: null };
    case 4:
      return { text: `Keep your cash safe from fines: pay it in at a bank in ${s.town || 'your home town'}.`, way: 'bank' };
    case 5: {
      const left = STATION_JOBS.filter((k) => !story.kinds.includes(k)).map((k) => atStation(k, story.names));
      return { text: `Do a job for ${list(left)}.`, way: 'station' };
    }
    case 6:
      return { text: 'Throw a party at your flat: stop beside it.', way: 'home' };
    case 7:
      return s.reno === 'buy' || s.reno === 'rest' || s.reno === 'paint'
        ? { text: 'Buy the rest of your building, repair it flat by flat, and choose its colour.', way: 'home' }
        : s.homes >= s.buildingsAfter
          ? { text: 'Own a whole building: stop beside one to see its price.', way: null }
          : { text: `Own a whole building. They are for sale once you have ${s.buildingsAfter} homes.`, way: null };
    default:
      return { text: 'Comes in a later update.', way: null };
  }
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Chapter 5 of 8 · The regulars" */
export const heading = (n: number): string => `Chapter ${n} of ${ALL} · ${CHAPTERS[n - 1]}`;

/** The scenes: what each person says, and when. Keys are kept in `Story.said`, so each is said once. */
export const SCENES = {
  /** the first flat is bought */
  neighbourWelcome: (worn: boolean): Array<[Who, string]> => [
    ['neighbour', worn ? 'Welcome to the house! The walls have been grey for years. Any of the stations nearby can bring what it needs.' : 'Welcome to the house! Good to have someone new on the stairs.'],
  ],
  /** the first package for the flat is taken: the person of that station, met for the first time */
  firstRepair: (kind: Exclude<JobKind, 'plain'>): Array<[Who, string]> =>
    [
      {
        supply: ['pump', "So you're the one in the grey flat. Here's your plaster. It's heavy: mind the corners."] as [Who, string],
        rush: ['flame', 'A part for your boiler. Your flat has been cold long enough. Quick!'] as [Who, string],
        clean: ['shield', "New windows for your flat. Drive by the book, or they don't arrive."] as [Who, string],
      }[kind],
    ],
  /** chapter 5: the people not yet met */
  regulars: (story: Story): Array<[Who, string]> => {
    const all: Array<[Who, string]> = [
      ['pump', "Heard you're new around here. I always have loads that need a careful driver. Come by the pump."],
      ['flame', 'Need someone quick. Come by the fire station.'],
      ['shield', 'If you can drive by the book, I have work for you. Police station, when you are ready.'],
    ];
    const seen = met(story);
    return all.filter(([w]) => !seen.includes(w));
  },
  /** a first job done for a person in chapter 5 */
  thanks: (kind: Exclude<JobKind, 'plain'>): Array<[Who, string]> =>
    [
      {
        supply: ['pump', "Delivered, and the load in one piece. You'll do."] as [Who, string],
        rush: ['flame', "That was quick. I'll call on you again."] as [Who, string],
        clean: ['shield', 'Clean all the way. Thank you.'] as [Who, string],
      }[kind],
    ],
  /** chapter 6 opens */
  housewarming: (): Array<[Who, string]> => [
    ['friends', "You've got a place and you didn't tell us?!"],
    ['friends', "We're coming tonight. Nobody got food."],
  ],
  /** chapter 6 is done */
  partyThanks: (): Array<[Who, string]> => [['friends', 'Best night in ages. Same again soon?']],
  /** chapter 7 opens */
  building: (s: Snapshot): Array<[Who, string]> => [
    s.reno === 'buy' || s.reno === 'rest' || s.reno === 'paint'
      ? ['neighbour', "The owner is selling the rest of the house. Honestly, you'd look after it better."]
      : ['neighbour', 'There are whole buildings for sale around here. You would look after one better than most.'],
  ],
  /** chapter 7 is done */
  buildingThanks: (): Array<[Who, string]> => [['neighbour', 'The whole house looks new. Thank you.']],
};

/** Which friend says a friends' message: the first, the second, the third, in turn. */
export function friendFor(story: Story): number {
  return story.turn % 3;
}
