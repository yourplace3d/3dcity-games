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
 * - Chapter 5 is the one that cannot be done before it opens: it is where the people at the stations are
 *   met, and they write on its day. A job counts for someone who has written; the others' count from
 *   the day they write.
 * - A player who is further on starts where they are: what the browser already holds ticks chapters at
 *   once, silently (they are not counted as played).
 * - Chapter 8 is the tenants' dispute (`dispute.ts`): it happens in the home town, at a home there, and is
 *   done once it is settled, whichever way.
 *
 * Kept in the browser under `3da-story`, so saving online carries it along.
 */

import type { JobKind } from './services';
import type { Names } from './names';
import type { Stage } from './events';
import { FIXER_MIN } from './renovation';

const STORE = '3da-story';

export const CHAPTERS = ['Arrival', 'Making rent', 'A roof over your head', 'Safe money', 'The regulars', 'Housewarming', 'The whole building', 'Landlord'] as const;
/** chapters there are */
export const ALL = CHAPTERS.length;
/** chapters built so far: the rest come in an update */
export const BUILT = 8;
/** chapters that open as soon as the one before is done, on any day */
export const FREE = 3;
/** the chapter where the people at the stations are met: it cannot be done before it opens */
export const MEET = 5;
/** messages kept for the menu */
export const INBOX_MAX = 24;
/** people's messages waiting to be shown, kept so that a closed page loses none */
export const PENDING_MAX = 12;
/** lines kept for "The story so far" */
export const SOFAR_MAX = 20;
/** scenes kept as shown */
export const SAID_MAX = 200;

/** Who speaks: the game itself, or a person, each with a look of their own. */
export type Who = 'game' | 'pump' | 'flame' | 'shield' | 'neighbour' | 'friends' | 'tenants';
export type Person = Exclude<Who, 'game'>;
/**
 * A person's message waiting to be shown. `from`: who it is from, where the story's names don't say it (the
 * tenants of a home); `anywhere`: shown wherever the player is (a dispute's notes, which belong to a home
 * in the part of town being played), not only in the home town.
 */
export interface Pending {
  who: Person;
  text: string;
  from?: string;
  anywhere?: boolean;
}

/** The people at the stations, by the job their station hands out. */
export const PERSON_OF: Record<Exclude<JobKind, 'plain'>, Person> = { supply: 'pump', rush: 'flame', clean: 'shield' };
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
  /**
   * kinds of station job delivered, for chapter 5: before it opens, since the story began; from then on,
   * those of the people met by then and those delivered since
   */
  kinds: JobKind[];
  /** the scenes already shown, each once */
  said: string[];
  /** the messages, newest last */
  inbox: Message[];
  /** the people's messages still to be shown: they wait for a quiet moment, and for the home town */
  pending: Pending[];
  /** the friends' messages shown so far: the three take turns */
  turn: number;
  /** the people's names, drawn once from the home town */
  names?: Names;
  /** "The story so far": each choice made, and how it went, newest last */
  sofar: Array<{ day: string; text: string }>;
  /** the people's scenes offered, with the last day each was: offered once a day until played */
  offered: Record<string, string>;
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
  /** the first home is a whole building: the house the neighbour lives in */
  firstWhole?: boolean;
  /** tenants' disputes settled, in all */
  settled: number;
  /** where the open dispute stands, if one is open */
  dispute: Stage | null;
  /** a court's order has brought new tenants to a home */
  moved?: boolean;
}

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const WHO: Who[] = ['game', 'pump', 'flame', 'shield', 'neighbour', 'friends', 'tenants'];
const JOBS: JobKind[] = ['plain', 'supply', 'rush', 'clean'];

/** A story that has not begun. */
export function none(): Story {
  return { open: 0, opened: '', last: '', done: {}, first: '', kinds: [], said: [], inbox: [], pending: [], turn: 0, sofar: [], offered: {} };
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
      ? (k.pending as Array<{ who?: unknown; text?: unknown; from?: unknown; anywhere?: unknown } | null>)
          .flatMap((m): Pending[] =>
            m && typeof m.who === 'string' && m.who !== 'game' && WHO.includes(m.who as Who) && typeof m.text === 'string'
              ? [{ who: m.who as Person, text: m.text.slice(0, 400), ...(typeof m.from === 'string' && m.from ? { from: m.from.slice(0, 80) } : {}), ...(m.anywhere === true ? { anywhere: true } : {}) }]
              : [],
          )
          .slice(-PENDING_MAX)
      : [];
    const offered: Record<string, string> = {};
    if (k.offered && typeof k.offered === 'object') for (const [key, d] of Object.entries(k.offered)) if (isDay(d)) offered[key] = d;
    const sofar = Array.isArray(k.sofar) ? k.sofar.flatMap((l) => (l && isDay(l.day) && typeof l.text === 'string' ? [{ day: l.day, text: l.text.slice(0, 200) }] : [])).slice(-SOFAR_MAX) : [];
    const names = readNames(k.names);
    return {
      open,
      opened: isDay(k.opened) ? k.opened : '',
      last: isDay(k.last) ? k.last : '',
      done,
      first: isDay(k.first) ? k.first : '',
      kinds: Array.isArray(k.kinds) ? [...new Set(k.kinds.filter((j): j is JobKind => JOBS.includes(j)))] : [],
      // the newest kept, like every other list: a scene just played is never the one forgotten
      said: Array.isArray(k.said) ? [...new Set(k.said.filter((s): s is string => typeof s === 'string'))].slice(-SAID_MAX) : [],
      inbox,
      pending,
      turn: typeof k.turn === 'number' && Number.isInteger(k.turn) && k.turn >= 0 ? k.turn % 3 : 0,
      ...(names ? { names } : {}),
      sofar,
      offered,
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
    case 8:
      // a dispute settled, whichever way it went
      return s.settled >= 1;
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
    // the chapter where the people are met waits for its day: they write then, and their jobs count from there
    if ((n !== MEET || story.opened) && finished(n, s, story)) {
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
      // the people met so far keep the job done for them; the others write now, and theirs is still to do
      if (n === MEET) story.kinds = metKinds(story);
    }
    break;
  }
  // nothing moved: the same story, so nothing is written again
  return { story: changed ? story : before, finished: done, early, opened };
}

/** The kinds of station job done for someone who has written: what chapter 5 counts as it opens. */
function metKinds(story: Story): JobKind[] {
  const seen = met(story);
  return story.kinds.filter((k) => k !== 'plain' && seen.includes(PERSON_OF[k]));
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

/** A note from a person who isn't one of the story's names (the tenants), or that shows anywhere. */
export function addNote(story: Story, p: Pending): Story {
  return { ...story, pending: [...story.pending, p].slice(-PENDING_MAX) };
}

/** A line for "The story so far". */
export function record(story: Story, text: string, day: string): Story {
  return { ...story, sofar: [...story.sofar, { day, text }].slice(-SOFAR_MAX) };
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
    case 'tenants':
      return 'Your tenants';
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
  /** where the arrow can lead, if anywhere: `flats` is the part of town with the worn-down flats */
  way: 'bank' | 'station' | 'home' | 'flats' | null;
}

export interface GoalState extends Snapshot {
  /** the home town's name, once there is a first home */
  town: string;
  /** played away from the home town: the people of the stations are at home */
  away?: boolean;
  /** homes it takes before whole buildings are for sale */
  buildingsAfter: number;
  /** the home of the open dispute, as the lines name it: "your flat on Königstraße" */
  disputeAt?: string;
  /** chapter 3, before the first flat is offered: what the offer still waits for (too little cash; a run of three to end) */
  flatWaits?: 'cash' | 'run';
  /** chapter 8, before the tenants have written: a home here that waits to be renovated first, as the lines name it */
  renovateFirst?: string;
}

/** What the open chapter asks, as it stands. */
export function goal(n: number, s: GoalState, story: Story): Goal {
  switch (n) {
    case 1:
      return { text: 'Get in a car and deliver a package.', way: null };
    case 2:
      return { text: 'One more delivery, and a flat of your own is in reach.', way: null };
    case 3:
      if (s.homes) return { text: 'Repair your flat: take a job at a fuel, fire or police station. Their rings flash green.', way: 'station' };
      // shown where already: the arrow leads there
      if (s.reno === 'find') return { text: 'Buy a worn-down flat: stop beside a building with a green $ sign.', way: 'flats' };
      if (s.flatWaits === 'cash') return { text: `Buy a worn-down flat. One is offered once you carry $${FIXER_MIN}: a delivery or two more.`, way: null };
      if (s.flatWaits === 'run') return { text: 'Buy a worn-down flat. Finish your run, and the game shows you where.', way: null };
      return { text: 'Buy a worn-down flat. After your next delivery, the game shows you where.', way: null };
    case 4:
      return { text: `Keep your cash safe from fines: pay it in at a bank in ${s.town || 'your home town'}.`, way: 'bank' };
    case 5: {
      const kinds = STATION_JOBS.filter((k) => !story.kinds.includes(k));
      if (!kinds.length) return { text: 'Done: they all know you now.', way: null };
      // away, their stations are elsewhere, but a job at any station counts
      if (s.away) return { text: `Do a job at ${list(kinds.map((k) => ({ supply: 'a fuel station', rush: 'a fire station', clean: 'a police station' })[k]))}: they count wherever you are.`, way: 'station' };
      return { text: `Do a job for ${list(kinds.map((k) => atStation(k, story.names)))}.`, way: 'station' };
    }
    case 6:
      // a party at any home counts: a house or a building as well as the first flat
      return { text: `Throw a party at ${s.homes > 1 ? 'one of your homes' : 'your home'}: stop beside it.`, way: 'home' };
    case 7:
      // the first building, step by step: each line says the next step, and its way leads to it
      if (s.reno === 'buy') return { text: 'Buy the rest of your building: stop beside it. Then repair it flat by flat, and choose its colour.', way: 'home' };
      if (s.reno === 'rest') return { text: 'Repair your building flat by flat: each package from a fuel, fire or police station repairs one. Their rings flash green.', way: 'station' };
      if (s.reno === 'paint') return { text: 'Every flat is repaired. One more package from a station brings the paint for the outside.', way: 'station' };
      return s.homes >= s.buildingsAfter
        ? { text: 'Own a whole building: stop beside one to see its price.', way: null }
        : { text: `Own a whole building. They are for sale once you have ${s.buildingsAfter} homes.`, way: null };
    case 8: {
      const at = s.disputeAt || 'your home';
      switch (s.dispute) {
        case 'talk':
          return { text: `The tenants in ${at} have stopped paying: stop beside it and talk to them.`, way: 'home' };
        case 'insist':
          return { text: `Bring the part for ${at} from a fire station, in time.`, way: 'station' };
        case 'accept':
          return { text: `Bring what ${at} needs from a fuel station, with no new dent.`, way: 'station' };
        case 'court':
          return { text: `Drive the officers from a police station to ${at}, by the book.`, way: 'station' };
        case 'replace':
          return { text: `A package from any station brings the new boiler for ${at}.`, way: 'station' };
        case 'moving':
          return { text: `New tenants move into ${at} with your next delivery.`, way: null };
        default:
          // one thing at a time in a part of town: a home being renovated here comes first, and the tenants write after
          if (s.renovateFirst) return { text: `Your tenants have something to say. First ${s.renovateFirst} needs renovating: a package from any station brings what it needs.`, way: 'station' };
          return { text: `Your tenants have something to say: drive to one of your homes in ${s.town || 'your home town'}.`, way: 'home' };
      }
    }
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

/** How each person at the stations says hello, by the job their station hands out. */
export const HELLO: Record<Exclude<JobKind, 'plain'>, string> = {
  supply: "Heard you're new around here. I always have loads that need a careful driver. Come by the pump.",
  rush: 'Need someone quick. Come by the fire station.',
  clean: 'If you can drive by the book, I have work for you. Police station, when you are ready.',
};

/** The people at the stations have said hello (the scene's key): on chapter 5's day, or later to a player whose chapter 5 was ticked before they wrote. */
export const REGULARS = 'regulars';

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
  /** chapter 5: the people not yet met, who say hello */
  regulars: (story: Story): Array<[Who, string]> => {
    // not someone who has written (or whose message waits): the one who brought the first flat's repair
    const seen = met(story);
    return STATION_JOBS.flatMap((k): Array<[Who, string]> => (seen.includes(PERSON_OF[k]) ? [] : [[PERSON_OF[k], HELLO[k]]]));
  },
  /** a first job done for a person in chapter 5; `dented`: the car took harm on the way */
  thanks: (kind: Exclude<JobKind, 'plain'>, dented = false): Array<[Who, string]> =>
    [
      {
        supply: ['pump', dented ? "Delivered. A new dent on the way, but it's all here. You'll do." : "Delivered, and the load in one piece. You'll do."] as [Who, string],
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
  /** chapter 7 is done; `own`: by the house the neighbour lives in, not by a building bought elsewhere */
  buildingThanks: (own = true): Array<[Who, string]> => [['neighbour', own ? 'The whole house looks new. Thank you.' : 'A whole building of your own. It is in good hands.']],
  /** Mira's scene: what she asks, with the car in words ("a pink van") */
  findAsk: (car: string): string => `A customer left her keys in while she paid, and someone drove off in her car: ${car}. Whoever took it won't keep it long, it'll be parked somewhere near. Can you find it and bring it back?`,
  findThanks: (): Array<[Who, string]> => [['pump', "You found it! She's so happy she says drive it for the rest of the day. And this is from me."]],
  findWrecked: (): Array<[Who, string]> => [['pump', 'Well, you found it. The tow truck will do the rest. Thanks all the same.']],
};

// ---------------------------------------------------------------- the people's scenes

/** Mira's first scene: a customer's car to find and drive back (`find.ts`; the owner, 27 November). */
export const FIND_SCENE = 'find-car';

/**
 * Whether the pump's scene may be offered today: once chapter 5 is done and its people have said hello
 * (Mira is met), from the day after, once a day until it is played, and not while a chapter that opened
 * today is still to do: the day's chapter comes first (the brainstorm, section 13, point 6). A chapter left
 * open from an earlier day doesn't hold it.
 */
export function findDue(story: Story, today: string): boolean {
  const met5 = story.done[MEET];
  if (!met5 || met5.day === today || !said(story, REGULARS) || said(story, FIND_SCENE) || story.offered[FIND_SCENE] === today) return false;
  return !(story.open <= BUILT && story.opened === today);
}

/**
 * Whether the people at the stations are due to say hello (`SCENES.regulars`): once, when chapter 5 has
 * opened. Also in a story kept from the first live days, where a job of each kind done before the chapter's
 * day ticked it unseen, or where someone whose kind of job was done got no hello: they say it now.
 */
export const hellosDue = (story: Story): boolean => !said(story, REGULARS) && (!!story.done[MEET] || (story.open === MEET && !!story.opened));

/** The scene was offered today. */
export const offer = (story: Story, key: string, today: string): Story => ({ ...story, offered: { ...story.offered, [key]: today } });

/** Which friend says a friends' message: the first, the second, the third, in turn. */
export function friendFor(story: Story): number {
  return story.turn % 3;
}
