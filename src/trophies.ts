/**
 * Trophies: things done in the game, each kept with the day it was first done (the owner, 23 November
 * 2026: "Real Estate and Trophies"). Nothing is paid for them and nothing can be bought with them. They
 * are called trophies, not badges, because "the badge" is already the police station's symbol.
 *
 * Their own look: a flat disc in the colour of their group with a plain sign on it, grey until earned.
 * Kept in the browser under `3da-trophies`, so saving online carries them along.
 */

import { kmBetween } from './game/bank';

const STORE = '3da-trophies';
const DAY_MS = 86400000;
/** a place counts as another when it is at least this far from every place kept (km): a town apart */
const PLACE_KM = 15;
/** the most places kept: enough for the last trophy of places */
const PLACES_MAX = 40;

export type TrophyId =
  | 'car' | 'delivery' | 'run' | 'home' | 'bank'
  | 'homes5' | 'building' | 'painted' | 'towns2' | 'rent1000'
  | 'lost' | 'clean' | 'rush' | 'deliveries100'
  | 'places5' | 'places20' | 'guessed' | 'story';

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
    name: 'Getting started',
    colour: '#5fd08a',
    trophies: [
      { id: 'car', name: 'First car', how: 'Take a car', sign: '<path d="M14 36l5-11h26l5 11v8H14z"/><circle cx="22" cy="45" r="5"/><circle cx="42" cy="45" r="5"/>' },
      { id: 'delivery', name: 'First delivery', how: 'Deliver a package', sign: '<path d="M16 24l16-7 16 7v18l-16 7-16-7z"/><path d="M32 31v18M16 24l16 7 16-7" fill="none" stroke="#5fd08a" stroke-width="2.5"/>' },
      { id: 'run', name: 'A run of three', how: 'Finish a run of three deliveries', sign: '<path d="M21 14h4v38h-4z"/><path d="M25 15h20l-5 8 5 8H25z"/>' },
      { id: 'home', name: 'First home', how: 'Buy a home', sign: house(32, 34, 1.2) },
      { id: 'bank', name: 'Money in the bank', how: 'Pay cash in at a bank', sign: '<path d="M14 26l18-10 18 10z"/><path d="M18 28h5v14h-5zM29.5 28h5v14h-5zM41 28h5v14h-5zM14 44h36v5H14z"/>' },
    ],
  },
  {
    name: 'Real estate',
    colour: '#ffd400',
    trophies: [
      { id: 'homes5', name: 'Five homes', how: 'Own 5 homes', sign: word('5', 34) },
      { id: 'building', name: 'A whole building', how: 'Own a whole building', sign: '<path d="M20 12h24v40H20z"/><path d="M25 18h5v5h-5zM34 18h5v5h-5zM25 27h5v5h-5zM34 27h5v5h-5zM25 36h5v5h-5zM34 36h5v5h-5zM29 45h6v7h-6z" fill="#ffd400"/>' },
      { id: 'painted', name: 'A fresh coat', how: 'Paint a house or building you own', sign: '<path d="M15 16h28v12H15z"/><path d="M43 21h5v13H31v6" fill="none" stroke="#16181c" stroke-width="4"/><path d="M28 40h6v12h-6z"/>' },
      { id: 'towns2', name: 'Two towns', how: 'Own homes in two towns', sign: `${house(21, 36, 0.8)}${house(43, 36, 0.8)}` },
      { id: 'rent1000', name: '$1,000 a day', how: 'Own homes that pay $1,000 rent a day', sign: word('$', 36) },
      { id: 'story', name: 'The whole story', how: 'Play the story to its last chapter: settle a dispute with your tenants', sign: '<path d="M10 18c8-3 15-2 21 3v30c-6-5-13-6-21-3z"/><path d="M54 18c-8-3-15-2-21 3v30c6-5 13-6 21-3z"/>' },
    ],
  },
  {
    name: 'Driving',
    colour: '#2bd4e0',
    trophies: [
      { id: 'lost', name: 'Shaken off', how: 'Lose the police', sign: '<path d="M12 40c8-14 20-18 32-16v-7l10 11-10 11v-7c-10-1-20 2-28 12z"/>' },
      { id: 'clean', name: 'A clean run', how: 'Finish a run of three without being caught, wrecked or knocked out', sign: '<path d="M14 33l6-6 8 8 16-17 6 6-22 23z"/>' },
      { id: 'rush', name: 'Time to spare', how: 'Finish a rush job with 30 seconds left', sign: '<circle cx="32" cy="35" r="15" fill="none" stroke="#16181c" stroke-width="5"/><path d="M29 12h6v6h-6zM30 35V25h4v10z"/><path d="M32 33l7 5-2 3-7-5z"/>' },
      { id: 'deliveries100', name: '100 deliveries', how: 'Deliver 100 packages', sign: word('100', 22) },
    ],
  },
  {
    name: 'Places',
    colour: '#f08a24',
    trophies: [
      { id: 'places5', name: 'Five places', how: 'Play in 5 places, each a town or more apart', sign: '<path d="M32 52C22 40 18 33 18 26a14 14 0 0 1 28 0c0 7-4 14-14 26z"/><circle cx="32" cy="26" r="5" fill="#f08a24"/>' },
      { id: 'places20', name: 'Twenty places', how: 'Play in 20 places, each a town or more apart', sign: word('20', 28) },
      { id: 'guessed', name: 'City guessed', how: 'Guess a city right in Where am I?', sign: word('?', 38) },
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

/** Which trophies a snapshot earns. */
export function earnedBy(s: Snapshot, places: number): TrophyId[] {
  const out: TrophyId[] = [];
  if (s.car) out.push('car');
  if (s.delivered >= 1) out.push('delivery');
  if (s.homes >= 1) out.push('home');
  if (s.saved > 0) out.push('bank');
  if (s.homes >= 5) out.push('homes5');
  if (s.building) out.push('building');
  if (s.painted) out.push('painted');
  if (s.towns >= 2) out.push('towns2');
  if (s.rentPerDay >= 1000) out.push('rent1000');
  if (s.delivered >= 100) out.push('deliveries100');
  if (places >= 5) out.push('places5');
  if (places >= 20) out.push('places20');
  if (s.story) out.push('story');
  return out;
}

/** A place as it is kept: its point, to about a kilometre. */
export function placeKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export class Trophies {
  private kept: Kept;
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
    return this.give(earnedBy(s, this.kept.places.length), now);
  }

  /** A place was played. */
  visit(lat: number, lon: number): void {
    const near = this.kept.places.some((k) => {
      const [a, b] = k.split(',').map(Number);
      return kmBetween(a, b, lat, lon) < PLACE_KM;
    });
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
  line.textContent = `${t.count()} of ${ALL.length} earned. Nothing is paid for them: they are for you, and for showing friends.`;
  for (const g of GROUPS) {
    const box = document.createElement('section');
    box.className = 'trophy-group';
    const head = document.createElement('div');
    head.className = 'town-head';
    const name = document.createElement('b');
    name.textContent = g.name;
    const sub = document.createElement('small');
    sub.textContent = `${g.trophies.filter((x) => t.day(x.id) !== null).length} of ${g.trophies.length} earned`;
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
      grid.append(li);
    }
    box.append(head, grid);
    list.append(box);
  }
}
