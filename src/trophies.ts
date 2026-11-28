/**
 * Trophies: things done in the game, each kept with the day it was first done (the owner, 23 November
 * 2026: "Real Estate and Trophies"). Nothing is paid for them and nothing can be bought with them. They
 * are called trophies, not badges, because "the badge" is already the police station's symbol.
 *
 * Their own look: a flat disc in the colour of their group with a plain sign on it, grey until earned.
 * Kept in the browser under `3da-trophies`, so saving online carries them along.
 *
 * 30 since 28 November 2026 (the owner, with all but one of the 18 earned: "We can now add some more of
 * these maybe?"). The list is the usual one of consoles and phones, on purpose (the owner: "We should not
 * need to reinvent it too much"): a badge grey until earned, a count at the top, and for a trophy that
 * counts something how far along it is. "Not a dent" is for the garage's car delivery, where it is the
 * whole point (`game/specials.ts`), not for a supply run as first built: a trophy must not change its
 * meaning once players have earned it. A trophy is earned in one of two ways: by what the player has (`earnedBy`, looked at once
 * a second, so a player who is further on earns what fits at once, in one line), or by something that
 * happens in play (`earnedIn`, from the game's events). A new one needs its line in `GROUPS`, its id in
 * `TrophyId`, and its rule in one of the two.
 */

import { kmBetween } from './game/bank';
import type { CarKind } from './game/cars';
import type { GameEvent } from './game/game';
import { money, T } from './i18n';

const STORE = '3da-trophies';
const DAY_MS = 86400000;
/** a place counts as another when it is at least this far from every place kept (km): a town apart */
const PLACE_KM = 15;
/** the most places kept: enough for the last trophy of places */
const PLACES_MAX = 40;
/** "Far from home": this far from the home town (km), which is mostly another continent */
export const FAR_KM = 5000;
/** "At first sight": this many points in Where am I?, which is the right city within 50 seconds and no wrong pick */
export const SIGHT_POINTS = 800;

export type TrophyId =
  | 'car' | 'delivery' | 'run' | 'home' | 'bank'
  | 'homes5' | 'homes10' | 'building' | 'painted' | 'renovated' | 'towns2' | 'towns5' | 'rent1000' | 'party' | 'story'
  | 'lost' | 'clean' | 'rush' | 'care' | 'book' | 'found' | 'bus' | 'deliveries100' | 'deliveries500'
  | 'places5' | 'places20' | 'far' | 'equator' | 'guessed' | 'sight';

export interface Trophy {
  id: TrophyId;
  name: string;
  /** how it is earned */
  how: string;
  /** the sign on the disc: SVG drawing on a 64 × 64 grid, in the dark ink */
  sign: string;
}

export interface Group {
  name: string;
  colour: string;
  trophies: Trophy[];
}

const house = (x: number, y: number, s: number) => `<path d="M${x} ${y - 14 * s}L${x + 13 * s} ${y - 2 * s}H${x + 9 * s}V${y + 12 * s}H${x - 9 * s}V${y - 2 * s}H${x - 13 * s}Z"/>`;
const word = (t: string, size: number) => `<text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="800" font-family="system-ui, sans-serif">${t}</text>`;

export const GROUPS: Group[] = [
  {
    name: T.trophyGroups[0],
    colour: '#5fd08a',
    trophies: [
      { id: 'car', name: T.trophyText.car[0], how: T.trophyText.car[1], sign: '<path d="M14 36l5-11h26l5 11v8H14z"/><circle cx="22" cy="45" r="5"/><circle cx="42" cy="45" r="5"/>' },
      { id: 'delivery', name: T.trophyText.delivery[0], how: T.trophyText.delivery[1], sign: '<path d="M16 24l16-7 16 7v18l-16 7-16-7z"/><path d="M32 31v18M16 24l16 7 16-7" fill="none" stroke="#5fd08a" stroke-width="2.5"/>' },
      { id: 'run', name: T.trophyText.run[0], how: T.trophyText.run[1], sign: '<path d="M21 14h4v38h-4z"/><path d="M25 15h20l-5 8 5 8H25z"/>' },
      { id: 'home', name: T.trophyText.home[0], how: T.trophyText.home[1], sign: house(32, 34, 1.2) },
      { id: 'bank', name: T.trophyText.bank[0], how: T.trophyText.bank[1], sign: '<path d="M14 26l18-10 18 10z"/><path d="M18 28h5v14h-5zM29.5 28h5v14h-5zM41 28h5v14h-5zM14 44h36v5H14z"/>' },
    ],
  },
  {
    name: T.trophyGroups[1],
    colour: '#ffd400',
    trophies: [
      { id: 'homes5', name: T.trophyText.homes5[0], how: T.trophyText.homes5[1], sign: word('5', 34) },
      { id: 'homes10', name: T.trophyText.homes10[0], how: T.trophyText.homes10[1], sign: word('10', 30) },
      { id: 'building', name: T.trophyText.building[0], how: T.trophyText.building[1], sign: '<path d="M20 12h24v40H20z"/><path d="M25 18h5v5h-5zM34 18h5v5h-5zM25 27h5v5h-5zM34 27h5v5h-5zM25 36h5v5h-5zM34 36h5v5h-5zM29 45h6v7h-6z" fill="#ffd400"/>' },
      { id: 'painted', name: T.trophyText.painted[0], how: T.trophyText.painted[1], sign: '<path d="M15 16h28v12H15z"/><path d="M43 21h5v13H31v6" fill="none" stroke="#16181c" stroke-width="4"/><path d="M28 40h6v12h-6z"/>' },
      { id: 'renovated', name: T.trophyText.renovated[0], how: T.trophyText.renovated[1], sign: '<g transform="rotate(40 32 32)"><path d="M29 22h6v33h-6z"/><path d="M19 11h26v12H19z"/></g>' },
      { id: 'towns2', name: T.trophyText.towns2[0], how: T.trophyText.towns2[1], sign: `${house(21, 36, 0.8)}${house(43, 36, 0.8)}` },
      { id: 'towns5', name: T.trophyText.towns5[0], how: T.trophyText.towns5[1], sign: `${house(32, 22, 0.58)}${house(21, 40, 0.58)}${house(43, 40, 0.58)}` },
      { id: 'rent1000', name: T.trophyText.rent1000[0], how: T.trophyText.rent1000[1], sign: word('$', 36) },
      { id: 'party', name: T.trophyText.party[0], how: T.trophyText.party[1], sign: '<path d="M32 54L13 21c12-7 26-7 38 0z"/><path d="M18 27c9-5 19-5 28 0" fill="none" stroke="#ffd400" stroke-width="2.5"/><circle cx="27" cy="33" r="3.2" fill="#ffd400"/><circle cx="37" cy="34" r="3.2" fill="#ffd400"/><circle cx="32" cy="43" r="2.8" fill="#ffd400"/>' },
      { id: 'story', name: T.trophyText.story[0], how: T.trophyText.story[1], sign: '<path d="M10 18c8-3 15-2 21 3v30c-6-5-13-6-21-3z"/><path d="M54 18c-8-3-15-2-21 3v30c6-5 13-6 21-3z"/>' },
    ],
  },
  {
    name: T.trophyGroups[2],
    colour: '#2bd4e0',
    trophies: [
      { id: 'lost', name: T.trophyText.lost[0], how: T.trophyText.lost[1], sign: '<path d="M12 40c8-14 20-18 32-16v-7l10 11-10 11v-7c-10-1-20 2-28 12z"/>' },
      { id: 'clean', name: T.trophyText.clean[0], how: T.trophyText.clean[1], sign: '<path d="M14 33l6-6 8 8 16-17 6 6-22 23z"/>' },
      { id: 'rush', name: T.trophyText.rush[0], how: T.trophyText.rush[1], sign: '<circle cx="32" cy="35" r="15" fill="none" stroke="#16181c" stroke-width="5"/><path d="M29 12h6v6h-6zM30 35V25h4v10z"/><path d="M32 33l7 5-2 3-7-5z"/>' },
      { id: 'care', name: T.trophyText.care[0], how: T.trophyText.care[1], sign: '<path d="M11 40l5-11h25l7 11v8H11z"/><circle cx="20" cy="49" r="5"/><circle cx="40" cy="49" r="5"/><path d="M36 17l6 6 11-12" fill="none" stroke="#16181c" stroke-width="4.5"/>' },
      { id: 'book', name: T.trophyText.book[0], how: T.trophyText.book[1], sign: '<path d="M32 10l19 6v15c0 11-7 19-19 24-12-5-19-13-19-24V16z"/><path d="M22 32l7 7 13-14" fill="none" stroke="#2bd4e0" stroke-width="5"/>' },
      { id: 'found', name: T.trophyText.found[0], how: T.trophyText.found[1], sign: '<circle cx="28" cy="28" r="12" fill="none" stroke="#16181c" stroke-width="6"/><path d="M36 38l4-4 12 12-4 4z"/>' },
      { id: 'bus', name: T.trophyText.bus[0], how: T.trophyText.bus[1], sign: '<path d="M9 44V24a5 5 0 0 1 5-5h36a5 5 0 0 1 5 5v20z"/><path d="M14 24h9v9h-9zM27 24h9v9h-9zM40 24h10v9H40z" fill="#2bd4e0"/><circle cx="20" cy="45" r="5.5"/><circle cx="44" cy="45" r="5.5"/>' },
      { id: 'deliveries100', name: T.trophyText.deliveries100[0], how: T.trophyText.deliveries100[1], sign: word('100', 22) },
      { id: 'deliveries500', name: T.trophyText.deliveries500[0], how: T.trophyText.deliveries500[1], sign: word('500', 22) },
    ],
  },
  {
    name: T.trophyGroups[3],
    colour: '#f08a24',
    trophies: [
      { id: 'places5', name: T.trophyText.places5[0], how: T.trophyText.places5[1], sign: '<path d="M32 52C22 40 18 33 18 26a14 14 0 0 1 28 0c0 7-4 14-14 26z"/><circle cx="32" cy="26" r="5" fill="#f08a24"/>' },
      { id: 'places20', name: T.trophyText.places20[0], how: T.trophyText.places20[1], sign: word('20', 28) },
      { id: 'far', name: T.trophyText.far[0], how: T.trophyText.far[1], sign: `${house(21, 41, 0.58)}<path d="M24 30c2-6 5-9 10-10" fill="none" stroke="#16181c" stroke-width="3" stroke-dasharray="3 3.5"/><path d="M44 39c-6-7-8-10-8-15a8 8 0 0 1 16 0c0 5-2 8-8 15z"/><circle cx="44" cy="24" r="3" fill="#f08a24"/>` },
      { id: 'equator', name: T.trophyText.equator[0], how: T.trophyText.equator[1], sign: '<circle cx="32" cy="32" r="17" fill="none" stroke="#16181c" stroke-width="4"/><ellipse cx="32" cy="32" rx="8" ry="17" fill="none" stroke="#16181c" stroke-width="2.5"/><path d="M13 29.5h38v5H13z"/>' },
      { id: 'guessed', name: T.trophyText.guessed[0], how: T.trophyText.guessed[1], sign: word('?', 38) },
      { id: 'sight', name: T.trophyText.sight[0], how: T.trophyText.sight[1], sign: '<path d="M8 32c7-10 15-15 24-15s17 5 24 15c-7 10-15 15-24 15S15 42 8 32z"/><circle cx="32" cy="32" r="9" fill="#f08a24"/><circle cx="32" cy="32" r="4"/>' },
    ],
  },
];

export const ALL: Trophy[] = GROUPS.flatMap((g) => g.trophies);

/** What the trophies are checked against, now and then. */
export interface Snapshot {
  car: boolean;
  delivered: number;
  homes: number;
  saved: number;
  building: boolean;
  painted: boolean;
  towns: number;
  rentPerDay: number;
  /** the story's last chapter is done */
  story?: boolean;
  /** a party has been thrown at a home of the player's */
  partied?: boolean;
  /** a home has been renovated after its walls wore down */
  renovated?: boolean;
  /** how far the furthest place played is from the home town (km); 0 with no home */
  fromHome?: number;
}

export interface Kept {
  /** each trophy earned, with the day it was earned on this device (`localDay`) */
  got: Partial<Record<TrophyId, number>>;
  /** the places played, each at least `PLACE_KM` from the others (`placeKey`) */
  places: string[];
}

export function readTrophies(raw: string | null): Kept {
  try {
    const k = JSON.parse(raw ?? 'null') as Partial<Kept> | null;
    const got: Kept['got'] = {};
    for (const t of ALL) {
      const d = (k?.got as Record<string, unknown> | undefined)?.[t.id];
      if (typeof d === 'number' && Number.isFinite(d) && d > 0) got[t.id] = Math.floor(d);
    }
    const places = Array.isArray(k?.places) ? k!.places.filter((p): p is string => typeof p === 'string').slice(0, PLACES_MAX) : [];
    return { got, places };
  } catch {
    return { got: {}, places: [] };
  }
}

/**
 * What a trophy that counts something counts: how much of it the player has, and how much it asks. Null for
 * the others.
 */
export function counted(id: TrophyId, s: Snapshot, places: number): [number, number] | null {
  switch (id) {
    case 'homes5':
      return [s.homes, 5];
    case 'homes10':
      return [s.homes, 10];
    case 'towns2':
      return [s.towns, 2];
    case 'towns5':
      return [s.towns, 5];
    case 'rent1000':
      return [s.rentPerDay, 1000];
    case 'deliveries100':
      return [s.delivered, 100];
    case 'deliveries500':
      return [s.delivered, 500];
    case 'places5':
      return [places, 5];
    case 'places20':
      return [places, 20];
    default:
      return null;
  }
}

/** "6 of 10", "$456 of $1,000": how far along a counting trophy is, in words. */
export function sofarText(id: TrophyId, [have, need]: [number, number]): string {
  const n = (v: number) => (id === 'rent1000' ? money(v) : String(Math.round(v)));
  return T.sofarOf(n(have), n(need));
}

/**
 * Which trophies a snapshot earns. `places`: how many places, a town apart, have been played; `across`:
 * places north and south of the equator are among those played.
 */
export function earnedBy(s: Snapshot, places: number, across = false): TrophyId[] {
  const out: TrophyId[] = [];
  // a trophy that counts something is earned when the count is full: one place for each number
  const full = (id: TrophyId): boolean => {
    const c = counted(id, s, places);
    return !!c && c[0] >= c[1];
  };
  if (s.car) out.push('car');
  if (s.delivered >= 1) out.push('delivery');
  if (s.homes >= 1) out.push('home');
  if (s.saved > 0) out.push('bank');
  if (full('homes5')) out.push('homes5');
  if (full('homes10')) out.push('homes10');
  if (s.building) out.push('building');
  if (s.painted) out.push('painted');
  if (s.renovated) out.push('renovated');
  if (full('towns2')) out.push('towns2');
  if (full('towns5')) out.push('towns5');
  if (full('rent1000')) out.push('rent1000');
  if (s.partied) out.push('party');
  if (full('deliveries100')) out.push('deliveries100');
  if (full('deliveries500')) out.push('deliveries500');
  if (full('places5')) out.push('places5');
  if (full('places20')) out.push('places20');
  if ((s.fromHome ?? 0) >= FAR_KM) out.push('far');
  if (across) out.push('equator');
  if (s.story) out.push('story');
  return out;
}

/**
 * Which trophies something that happened in play earns. `fullRun`: the run being scored is the game's own
 * run of three, not one a friend sent with another number of deliveries; `car`: what the player sits in.
 */
export function earnedIn(e: GameEvent, fullRun: boolean, car: CarKind | null): TrophyId[] {
  const out: TrophyId[] = [];
  if (e.kind === 'lost') out.push('lost');
  if (e.kind === 'run' && fullRun) out.push(...(e.fined ? (['run'] as const) : (['run', 'clean'] as const)));
  if (e.kind === 'found') out.push('found');
  // the garage's job is gone at a new dent, so a car handed over is one without
  if (e.kind === 'carDelivered') out.push('care');
  if (e.kind === 'delivered') {
    // a station's job done the way its card asks: time left on the fire station's; the police's is gone
    // at the first offence, so delivered means clean
    if (e.job === 'rush' && e.left >= 30) out.push('rush');
    if (e.job === 'clean') out.push('book');
    if (car === 'bus') out.push('bus');
  }
  return out;
}

/** A place as it is kept: its point, to about a kilometre. */
export function placeKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export class Trophies {
  private kept: Kept;
  /** the place being played: it counts for the furthest place though no more places are kept */
  private here: [number, number] | null = null;
  /** what the player had when last looked at: for how far along a counting trophy is */
  private last: Snapshot | null = null;
  /** said when trophies are earned: their names */
  onEarned: (names: string[]) => void = () => undefined;
  /** what is kept changed: for saving online */
  onStored: () => void = () => undefined;

  constructor() {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORE);
    } catch {
      /* private window: for this visit only */
    }
    this.kept = readTrophies(raw);
  }

  /** The day a trophy was earned, or null. */
  day(id: TrophyId): number | null {
    return this.kept.got[id] ?? null;
  }

  /** How many places, a town apart, have been played. */
  placesCount(): number {
    return this.kept.places.length;
  }

  count(): number {
    return Object.keys(this.kept.got).length;
  }

  /** Earn these, if not yet earned; say the new ones. */
  give(ids: TrophyId[], now = Date.now()): TrophyId[] {
    const fresh = ids.filter((id, i) => !this.kept.got[id] && ids.indexOf(id) === i);
    if (!fresh.length) return fresh;
    for (const id of fresh) this.kept.got[id] = localDay(now);
    this.store();
    this.onEarned(fresh.map((id) => ALL.find((t) => t.id === id)!.name));
    return fresh;
  }

  check(s: Snapshot, now = Date.now()): TrophyId[] {
    this.last = s;
    return this.give(earnedBy(s, this.kept.places.length, this.across()), now);
  }

  /**
   * How far along a trophy that counts something is, while it is not earned and something of it is there:
   * what the player has of what it asks. Null for the others, and until a place has been played on the page.
   */
  sofar(id: TrophyId): [number, number] | null {
    if (!this.last || this.kept.got[id]) return null;
    const c = counted(id, this.last, this.kept.places.length);
    return c && c[0] > 0 ? [Math.min(c[0], c[1]), c[1]] : null;
  }

  /** The places played, as points: those kept (one that is no point is left out), and the one being played. */
  private points(): Array<[number, number]> {
    const kept = this.kept.places.map((k) => k.split(',').map(Number) as [number, number]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    return this.here ? [...kept, this.here] : kept;
  }

  /** How far the furthest place played is from a point (km): from the home town, for "Far from home". */
  furthest(lat: number, lon: number): number {
    return this.points().reduce((far, [a, b]) => Math.max(far, kmBetween(a, b, lat, lon)), 0);
  }

  /** Places north and south of the equator have been played. */
  across(): boolean {
    const lats = this.points().map(([a]) => a);
    return lats.some((a) => a >= 0) && lats.some((a) => a < 0);
  }

  /** A place was played. */
  visit(lat: number, lon: number): void {
    const near = this.kept.places.some((k) => {
      const [a, b] = k.split(',').map(Number);
      return kmBetween(a, b, lat, lon) < PLACE_KM;
    });
    this.here = [lat, lon];
    if (near || this.kept.places.length >= PLACES_MAX) return;
    this.kept.places.push(placeKey(lat, lon));
    this.store();
  }

  private store(): void {
    try {
      localStorage.setItem(STORE, JSON.stringify({ v: 1, ...this.kept }));
      this.onStored();
    } catch {
      /* as above */
    }
  }
}

/** A trophy's disc: in its group's colour once earned, grey before. */
export function disc(t: Trophy, colour: string, earned: boolean): string {
  const fill = earned ? colour : '#3a3f47';
  const ink = earned ? '#16181c' : '#5b616b';
  // the signs' cut-outs are drawn in the group colour: grey them too
  const sign = earned ? t.sign : t.sign.replaceAll(colour, fill);
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="${earned ? '#16181c' : '#2a2e35'}"/><circle cx="32" cy="32" r="26" fill="${fill}"/><g fill="${ink}">${sign.replaceAll('#16181c', ink)}</g></svg>`;
}

/** The day on this device as a day number: the local date, counted as days since 1 January 1970. */
export function localDay(ms: number): number {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** "23.11.26": the day a trophy was earned (a local date, as `localDay` keeps it). */
export function dateOf(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCFullYear()).slice(2)}`;
}

/** The trophies, group by group, into the side menu. */
export function drawTrophies(list: HTMLElement, line: HTMLElement, t: Trophies): void {
  list.replaceChildren();
  line.textContent = T.trophiesLine(t.count(), ALL.length);
  for (const g of GROUPS) {
    const box = document.createElement('section');
    box.className = 'trophy-group';
    const head = document.createElement('div');
    head.className = 'town-head';
    const name = document.createElement('b');
    name.textContent = g.name;
    const sub = document.createElement('small');
    sub.textContent = T.trophiesEarnedOf(g.trophies.filter((x) => t.day(x.id) !== null).length, g.trophies.length);
    head.append(name, sub);
    const grid = document.createElement('ul');
    grid.className = 'trophies';
    for (const x of g.trophies) {
      const day = t.day(x.id);
      const li = document.createElement('li');
      li.className = day === null ? 'locked' : '';
      const icon = document.createElement('span');
      icon.className = 'disc';
      // a static drawing of this file's own
      icon.innerHTML = disc(x, g.colour, day !== null);
      const b = document.createElement('b');
      b.textContent = x.name;
      const s = document.createElement('small');
      s.textContent = day === null ? x.how : dateOf(day);
      li.append(icon, b, s);
      // the usual thin bar and its number, on a trophy that counts something and is on its way
      const far = day === null ? t.sofar(x.id) : null;
      if (far) {
        const bar = document.createElement('span');
        bar.className = 'sofar';
        const fill = document.createElement('i');
        fill.style.width = `${Math.round((far[0] / far[1]) * 100)}%`;
        fill.style.background = g.colour;
        bar.append(fill);
        const n = document.createElement('small');
        n.className = 'sofar-n';
        n.textContent = sofarText(x.id, far);
        li.append(bar, n);
      }
      grid.append(li);
    }
    box.append(head, grid);
    list.append(box);
  }
}
