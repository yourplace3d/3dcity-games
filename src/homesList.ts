/**
 * The player's homes, wherever they stand. A new place is not a new game: cash and homes come
 * along to every place played, so the menu's Real estate tab lists the homes by town, with what each
 * pays, and leads to one (`#pane-estate` in `index.html`, drawn by `drawEstate` in `main.ts`).
 */

import { kmBetween } from './game/bank';
import type { Home } from './game/homes';
import { rentShare, type Reno } from './game/renovation';
import { T } from './i18n';

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
  return T.homeLine(h.kind, h.street);
}

/** How far the repairs of the first home have got (`game/renovation.ts`). */
function repairs(r: Reno | null): string {
  if (!r) return '';
  if (r.stage === 'flat') return T.repairsWorn;
  if (r.stage === 'buy') return T.repairsBuy;
  if (r.stage === 'rest') return T.repairsRest(1 + (r.fixed ?? 0), r.units ?? 2);
  if (r.stage === 'paint') return T.repairsPaint;
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
  act: { here: (h: Home) => boolean; show: (h: Home) => void; go: (t: Town, h: Home) => void; party?: (h: Home) => string | null; throwParty?: (h: Home) => void },
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
    const count = T.townHomes(t.homes.length);
    sub.textContent = T.townSub(count, t.rent ? money(t.rent) : null, t.plate);
    head.append(name, sub);
    const ul = document.createElement('ul');
    for (const l of t.homes.slice(0, LIST_MAX)) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = l.what;
      const s = document.createElement('small');
      s.textContent = l.rent ? [T.paysADay(money(l.rent)), l.note].filter(Boolean).join(' · ') : l.note || T.noRentYet;
      text.append(b, s);
      const here = act.here(l.home);
      const go = document.createElement('button');
      go.type = 'button';
      go.textContent = here ? T.onTheMap : T.goThere;
      go.addEventListener('click', () => (here ? act.show(l.home) : act.go(t, l.home)));
      li.append(text);
      // a party, where one can be thrown at this home now
      const party = act.party?.(l.home);
      if (party) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'party';
        b.textContent = party;
        b.addEventListener('click', () => act.throwParty?.(l.home));
        li.append(b);
      }
      li.append(go);
      ul.append(li);
    }
    box.append(head, ul);
    if (t.homes.length > LIST_MAX) {
      const more = document.createElement('p');
      more.className = 'small';
      more.textContent = T.andMore(t.homes.length - LIST_MAX);
      box.append(more);
    }
    list.append(box);
  }
}

