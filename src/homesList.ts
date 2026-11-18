/**
 * The player's homes, wherever they stand. A new place is not a new game: cash and homes come
 * along to every place played, so a card lists the homes by town, with what each pays, and leads to
 * one. It opens from the start screen and from the pause card once the browser owns a home (`#homes`
 * in `index.html`, wired in `main.ts`).
 */

import { kmBetween } from './game/bank';
import type { Home } from './game/homes';
import { rentShare, type Reno } from './game/renovation';

/** homes this near the first home of a town are listed with it (km): the spread of a big city */
export const TOWN_KM = 15;
/** at most this many homes of one town are listed; the rest are counted */
const LIST_MAX = 40;

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export interface HomeLine {
  home: Home;
  /** "A flat on Lindenstraße" */
  what: string;
  /** what it pays on a day one comes back, as things stand */
  rent: number;
  /** how far the repairs have got, for the first home while it is being repaired */
  note: string;
}

export interface Town {
  /** the town's name, as a home there was bought under */
  place: string;
  /** the town of the first home, the home plate: its banks keep the player's savings */
  plate: boolean;
  homes: HomeLine[];
  /** what its homes pay on a day one comes back */
  rent: number;
}

/** Whether a place's name is only its coordinates (a link with a point and no name). */
export const isCoords = (place: string): boolean => /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(place.trim());

function what(h: Home): string {
  const on = h.street ? ` on ${h.street}` : '';
  return h.kind === 'building' ? `The whole building${on}` : h.kind === 'house' ? `A house${on}` : `A flat${on}`;
}

/** How far the repairs of the first home have got (`game/renovation.ts`). */
function repairs(r: Reno | null): string {
  if (!r) return '';
  if (r.stage === 'flat') return 'Worn down: no rent until it is repaired';
  if (r.stage === 'buy') return 'Repaired. The rest of the building is for sale';
  if (r.stage === 'rest') return `${1 + (r.fixed ?? 0)} of ${r.units ?? 2} flats repaired`;
  if (r.stage === 'paint') return 'Every flat repaired: paint for the outside comes next';
  return '';
}

/** The homes by town: the home plate first, then each town in the order a home was first bought there. */
export function homeTowns(homes: Home[], reno: Reno | null): Town[] {
  const towns: Array<Town & { lat: number; lon: number }> = [];
  homes.forEach((h, i) => {
    // the first home is the building of the first-home mission: it pays the share that is repaired
    const rent = i === 0 ? Math.round(h.rent * rentShare(reno)) : h.rent;
    let town = towns.find((t) => kmBetween(t.lat, t.lon, h.lat, h.lon) <= TOWN_KM);
    if (!town) towns.push((town = { place: '', plate: i === 0, homes: [], rent: 0, lat: h.lat, lon: h.lon }));
    town.homes.push({ home: h, what: what(h), rent, note: i === 0 ? repairs(reno) : '' });
    town.rent += rent;
    // a name rather than coordinates, where a home there was bought under one
    if (!town.place || (isCoords(town.place) && h.place && !isCoords(h.place))) town.place = h.place;
  });
  return towns.map(({ lat, lon, ...t }) => ({ ...t, place: t.place || `${lat.toFixed(2)}, ${lon.toFixed(2)}` }));
}

/** The towns and their homes into the card: each home with the way there, or to it in the town being played. */
export function drawHomes(
  list: HTMLElement,
  towns: Town[],
  act: { here: (h: Home) => boolean; show: (h: Home) => void; go: (t: Town, h: Home) => void },
): void {
  list.replaceChildren();
  for (const t of towns) {
    const box = document.createElement('div');
    box.className = t.plate ? 'town plate' : 'town';
    const head = document.createElement('div');
    head.className = 'town-head';
    const name = document.createElement('b');
    name.textContent = t.place;
    const sub = document.createElement('small');
    const count = t.homes.length === 1 ? '1 home' : `${t.homes.length} homes`;
    sub.textContent = `${count} · ${t.rent ? `${money(t.rent)} a day` : 'no rent yet'}${t.plate ? ' · your home plate, where the banks keep your savings' : ''}`;
    head.append(name, sub);
    const ul = document.createElement('ul');
    for (const l of t.homes.slice(0, LIST_MAX)) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = l.what;
      const s = document.createElement('small');
      s.textContent = l.rent ? [`Pays ${money(l.rent)} a day`, l.note].filter(Boolean).join(' · ') : l.note || 'No rent yet';
      text.append(b, s);
      const here = act.here(l.home);
      const go = document.createElement('button');
      go.type = 'button';
      go.textContent = here ? 'Show the way' : 'Go there';
      go.addEventListener('click', () => (here ? act.show(l.home) : act.go(t, l.home)));
      li.append(text, go);
      ul.append(li);
    }
    box.append(head, ul);
    if (t.homes.length > LIST_MAX) {
      const more = document.createElement('p');
      more.className = 'small';
      more.textContent = `and ${t.homes.length - LIST_MAX} more`;
      box.append(more);
    }
    list.append(box);
  }
}
