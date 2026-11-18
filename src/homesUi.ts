/**
 * Homes on screen: the offer on the result card after a run, the "for sale" panel when the player
 * stops beside a building, the marks on owned buildings, and the rent waiting on return.
 * The rules and prices are in `game/homes.ts`.
 */

import type { Game } from './game/game';
import type { World } from './game/world';
import { canBuy, dayOf, homesIn, loadHomes, opensAfter, PAINTS, rentDue, rentFor, rentPerVisit, saveHomes, type Home, type Homes, type Lot } from './game/homes';
import { homePlate, inPlate, loadSaved, payFrom, storeSaved, type Plate } from './game/bank';
import { MAX_CASH } from './game/game';
import { serviceIcon } from './game/services';
import { pointInRing } from './geo/polygon';
import { countPlay } from './linkCount';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
/** how near a building one has to stop for its panel (m) */
const BESIDE_M = 7;
/** how near a bank one has to stop: its spot on the road, or the bank itself on foot (m) */
const BANK_ROAD_M = 9;
const BANK_M = 14;
/** how far from the end of a run an offer may lie (m) */
const OFFER_M = 500;

let homeIcon: HTMLCanvasElement | null = null;

/** A house on a yellow disc, for the roof of an owned building and the maps. */
function icon(): HTMLCanvasElement {
  if (homeIcon) return homeIcon;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fillStyle = '#16181c';
  g.fill();
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.fillStyle = '#ffd400';
  g.fill();
  g.fillStyle = '#16181c';
  g.beginPath();
  g.moveTo(64, 26);
  g.lineTo(100, 60);
  g.lineTo(90, 60);
  g.lineTo(90, 98);
  g.lineTo(38, 98);
  g.lineTo(38, 60);
  g.lineTo(28, 60);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd400';
  g.fillRect(57, 74, 14, 24);
  return (homeIcon = c);
}

let saleIcon: HTMLCanvasElement | null = null;

/** A dollar on a green disc: a flat for sale, where the first-home mission leads. */
function forSaleIcon(): HTMLCanvasElement {
  if (saleIcon) return saleIcon;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fillStyle = '#16181c';
  g.fill();
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.fillStyle = '#5fd08a';
  g.fill();
  g.fillStyle = '#16181c';
  g.font = '800 76px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 64, 68);
  return (saleIcon = c);
}

const MISSION = '3da-mission';
function loadMission(): 'none' | 'on' | 'done' {
  try {
    const v = localStorage.getItem(MISSION);
    return v === 'on' || v === 'done' ? v : 'none';
  } catch {
    return 'none';
  }
}
function storeMission(v: 'on' | 'done'): void {
  try {
    localStorage.setItem(MISSION, v);
  } catch {
    /* private window */
  }
}

function distanceTo(lot: Lot, x: number, y: number): number {
  const r = lot.poly.outer;
  if (pointInRing([x, y], r)) return 0;
  let best = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, ay] = r[j];
    const [bx, by] = r[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

/** "a 5-floor", "an 8-floor", "an 11-floor" */
const floorsA = (n: number) => `${/^(8|11|18)$|^8\d$/.test(String(n)) ? 'an' : 'a'} ${n}-floor`;
const on = (street: string) => (street ? ` on ${street}` : '');

/** "a flat in a 5-floor building on Lindenstraße" */
function describe(lot: Lot, what: 'flat' | 'house' | 'building'): string {
  if (what === 'house') return `a house${on(lot.street)}`;
  if (what === 'building') return `the whole ${lot.inHouse ? 'house' : 'building'}${on(lot.street)}, ${lot.units} flats`;
  return `a flat in ${floorsA(lot.floors)} ${lot.inHouse ? 'house' : 'building'}${on(lot.street)}`;
}

export interface HomesHost {
  game: Game;
  toast: (text: string, kind?: 'good' | 'bad' | 'info', ms?: number) => void;
  /** keep the cash (and say that something changed, for saving online) */
  save: () => void;
  /** the name of the place being played */
  place: () => string;
  /** the first home was just bought (what it is, its rent each day): saving online opens */
  firstHome?: (what: string, rent: string) => void;
  /** a card over the game that waits for an answer: the mission's offer */
  card?: (title: string, text: string, yes: string, no: string, answer: (yes: boolean) => void) => void;
}

export class HomesUi {
  private homes: Homes = loadHomes();
  private world: World | null = null;
  private marks = new Map<Lot, { remove: () => void }>();
  private lookT = 0;
  private welcomed = false;
  private readonly panel = document.getElementById('forsale')!;
  private readonly savedEl = document.getElementById('saved');
  /** cash paid in at a bank of the home plate (`game/bank.ts`) */
  private saved = loadSaved();
  /** the town of the first home, where the banks are */
  private plate: Plate | null = homePlate(this.homes);
  /** whether the square being played is in the home plate */
  private atPlate = false;
  /** the banks of the square, where the home plate's are shown: each with its spot on the road */
  private banks: Array<{ x: number; y: number; rx: number; ry: number; mark: { remove: () => void } }> = [];
  /** what the panel shows, so it is drawn again only when that changes */
  private shown = '';
  /** the first-home mission: offered once enough cash is made, done with the first home */
  private mission = loadMission();
  /** offered on this visit already (and put off) */
  private offered = false;
  /** where the mission leads: a part of town with cheap flats, in the square being played */
  private area: { x: number; y: number; rx: number; ry: number; from: number; marks: Array<{ remove: () => void }>; here: boolean } | null = null;

  constructor(private readonly host: HomesHost) {
    host.game.ticks.push((dt) => this.tick(dt));
    addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() !== 'b' || e.repeat || this.panel.hidden) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
      this.panel.querySelector<HTMLButtonElement>('button:not(.swatch)')?.click();
    });
  }

  /** which building of the square being played each home is */
  private owned = new Map<Lot, Home>();

  /** Home kept for a lot of the square being played. */
  private homeOf(lot: Lot): Home | undefined {
    return this.owned.get(lot);
  }

  private tick(dt: number): void {
    const { game } = this.host;
    if (game.world !== this.world) this.enter(game.world);
    if (!this.welcomed) {
      this.welcomed = true;
      this.payRent(true);
    }
    if (this.savedEl) {
      this.savedEl.hidden = !this.plate;
      const text = `Bank ${money(this.saved)}`;
      if (this.savedEl.textContent !== text) this.savedEl.textContent = text;
    }
    this.lookT -= dt;
    if (this.lookT > 0) return;
    this.lookT = 0.25;
    this.look();
    this.missionTick();
  }

  // ------------------------------------------------------------ the first-home mission

  private missionTick(): void {
    const { game } = this.host;
    const world = this.world;
    if (!world) return;
    if (this.homes.homes.length) {
      if (this.mission !== 'done') this.endMission();
      return;
    }
    if (this.mission === 'on') {
      if (!this.area) this.area = this.pickArea();
      const a = this.area;
      game.guide = a ? { x: a.rx, y: a.ry } : null;
      if (!a) return;
      const [px, py] = game.pos();
      if (!a.here && Math.hypot(a.x - px, a.y - py) < 110) {
        a.here = true;
        game.guide = null;
        this.host.toast(`Here: flats from ${money(a.from)}. Stop beside a building with a green $ sign to buy one.`, 'info', 9000);
      }
      if (a.here) game.guide = null;
      return;
    }
    if (this.mission !== 'none' || this.offered || !this.host.card) return;
    // between runs, with no package on board, and with the cash for the cheapest flat here
    if (!game.run.over || game.job) return;
    const cheapest = Math.min(...world.lots.filter((l) => l.kind === 'flats').map((l) => l.price));
    if (!Number.isFinite(cheapest) || game.cash < cheapest) return;
    this.offered = true;
    this.host.card(
      'Private mission: your first home',
      `You have ${money(game.cash)}: enough for a flat. Not far from here is a part of town where flats are cheap. Drive there, stop beside a building with a green $ sign, and buy your first flat. A home pays you rent each day you come back to the game.`,
      'Show me the place',
      'Later',
      (yes) => {
        if (!yes) return;
        this.mission = 'on';
        storeMission('on');
        this.missionTick();
      },
    );
  }

  /** A part of town near the player where flats are cheap: up to six of them marked, and a spot on the street to drive to. */
  private pickArea(): HomesUi['area'] {
    const { game } = this.host;
    const world = this.world!;
    const [px, py] = game.pos();
    // within reach, and not at the square's very edge, where the next square takes over
    const flats = world.lots
      .filter((l) => l.kind === 'flats' && !this.owned.has(l) && Math.hypot(l.x - px, l.y - py) < 800 && Math.max(Math.abs(l.x), Math.abs(l.y)) < world.half - 120)
      .sort((a, b) => a.price - b.price);
    if (!flats.length) return null;
    const affordable = flats.filter((l) => l.price <= game.cash);
    const cheap = affordable.length >= 3 ? affordable.slice(0, Math.max(5, Math.ceil(flats.length * 0.3))) : flats.slice(0, 5);
    let best = cheap[0];
    let score = -Infinity;
    for (const c of cheap) {
      // several cheap flats together, and near: a flat more is worth 200 m more to drive
      const s = cheap.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < 150).length * 100 - Math.hypot(c.x - px, c.y - py) / 2;
      if (s > score) {
        score = s;
        best = c;
      }
    }
    const group = cheap.filter((o) => Math.hypot(o.x - best.x, o.y - best.y) < 150).slice(0, 6);
    const x = group.reduce((s, l) => s + l.x, 0) / group.length;
    const y = group.reduce((s, l) => s + l.y, 0) / group.length;
    const n = world.roads.nearest(x, y, 200, 'traffic');
    const [rx, ry] = n ? world.roads.point(n.line, n.s) : [x, y];
    return { x, y, rx, ry, from: group[0].price, marks: group.map((l) => world.mark(forSaleIcon(), l.x, l.y)), here: false };
  }

  private dropArea(): void {
    for (const m of this.area?.marks ?? []) m.remove();
    this.area = null;
    this.host.game.guide = null;
  }

  private endMission(): void {
    this.dropArea();
    this.mission = 'done';
    storeMission('done');
  }

  /** A new square: mark the homes in it. */
  private enter(world: World): void {
    this.world = world;
    this.marks.clear();
    this.shown = '';
    this.owned = homesIn(this.homes, world.lots, (lon, lat) => world.proj.toLocal(lon, lat));
    for (const lot of this.owned.keys()) this.marks.set(lot, world.mark(icon(), lot.x, lot.y));
    this.banks = [];
    this.showBanks();
    // the mission's area is picked again in the new square
    this.area = null;
    this.host.game.guide = null;
    // painted homes
    for (const [lot, home] of this.owned) if (home.colour) world.model.paintBuilding(lot.poly, home.colour);
  }

  /** In the home plate, the banks' symbols: on the roof (or by the street, where one is made up) and on the maps. */
  private showBanks(): void {
    const world = this.world;
    if (!world) return;
    const mid = world.proj.toLngLat(0, 0);
    this.atPlate = inPlate(this.plate, mid.lat, mid.lon);
    if (!this.atPlate || this.banks.length) return;
    for (const b of world.banks) {
      const n = world.roads.nearest(b.x, b.y, 150, 'traffic');
      const [rx, ry] = n ? world.roads.point(n.line, n.s) : [b.x, b.y];
      this.banks.push({ x: b.x, y: b.y, rx, ry, mark: world.mark(serviceIcon('bank', !!b.invented), b.x, b.y) });
    }
  }

  /** What the player can spend here: the cash carried, and in the home plate the savings too. */
  private budget(): number {
    return this.host.game.cash + (this.atPlate ? this.saved : 0);
  }

  /** Pay cash in at a bank. */
  payIn(): number {
    const { game } = this.host;
    const amount = Math.min(Math.floor(game.cash), MAX_CASH - this.saved);
    if (amount < 1) return 0;
    game.cash -= amount;
    this.saved += amount;
    storeSaved(this.saved);
    this.host.save();
    this.host.toast(`${money(amount)} paid in. You have ${money(this.saved)} in the bank, safe from fines.`, 'good', 5000);
    this.shown = '';
    this.look();
    return amount;
  }

  /** Pay the rent of a new day, once. On arrival, say so. */
  payRent(arriving = false): number {
    if (!this.homes.homes.length) return 0;
    const due = rentDue(this.homes, Date.now());
    if (due < 1) return 0;
    this.homes.paidDay = dayOf(Date.now());
    saveHomes(this.homes);
    const before = this.host.game.cash;
    this.host.game.cash += due;
    this.host.save();
    // at the most cash one can hold, the rent is not added
    const got = this.host.game.cash - before;
    if (got < 1) return 0;
    if (arriving) countPlay('rent');
    const homes = this.homes.homes.length === 1 ? 'your home' : `your ${this.homes.homes.length} homes`;
    this.host.toast(arriving ? `Welcome back. Today ${homes} paid you ${money(got)} rent.` : `A new day: ${homes} paid you ${money(got)} rent.`, 'good', 9000);
    return got;
  }

  /** Buy a lot of the square being played. */
  buy(lot: Lot, what: 'flat' | 'house' | 'building'): boolean {
    const { game } = this.host;
    const had = this.homeOf(lot);
    // Prices are ranked within each loaded square, so a later square can value the same
    // building below what the flat cost. Credit that payment, but never refund cash on a buy.
    const price = what === 'building' ? Math.max(0, lot.whole - (had?.paid ?? 0)) : lot.price;
    const pay = payFrom(price, game.cash, this.saved, this.atPlate);
    if (!pay || !canBuy(this.homes, what) || (had && what !== 'building') || had?.kind === 'building') return false;
    // the rent so far goes out first, so the new home's rent starts now
    this.payRent();
    // a first home starts paying tomorrow
    const first = !this.homes.homes.length;
    if (first) this.homes.paidDay = dayOf(Date.now());
    game.cash -= pay.cash;
    if (pay.saved) {
      this.saved -= pay.saved;
      storeSaved(this.saved);
    }
    const ll = this.world!.proj.toLngLat(lot.x, lot.y);
    if (had) {
      had.kind = 'building';
      had.paid += price;
      had.rent = rentFor(had.paid);
    } else {
      const home: Home = { id: lot.id, lat: ll.lat, lon: ll.lon, kind: what, paid: price, rent: rentFor(price), street: lot.street, place: this.host.place(), at: Date.now() };
      this.homes.homes.push(home);
      this.owned.set(lot, home);
      this.marks.set(lot, this.world!.mark(icon(), lot.x, lot.y));
    }
    saveHomes(this.homes);
    this.host.save();
    countPlay('home', what);
    if (first) {
      this.endMission();
      // this town is now the home plate: its banks show
      this.plate = homePlate(this.homes);
      this.showBanks();
    }
    const mine = this.homeOf(lot)!;
    if (first && this.host.firstHome) this.host.firstHome(describe(lot, what), money(mine.rent));
    else this.host.toast(`It's yours: ${describe(lot, what)}.${pay.saved ? ` ${money(pay.saved)} of it came from the bank.` : ''} It pays ${money(mine.rent)} rent each day you come back.`, 'good', 6000);
    this.shown = '';
    this.look();
    return true;
  }

  /** Stopped beside a building that is for sale: show what it costs. */
  private look(): void {
    const { game } = this.host;
    const world = this.world;
    let found: Lot | null = null;
    let bank = false;
    if (world && game.speed() < 1.2 && !game.held) {
      const [px, py] = game.pos();
      bank = this.banks.some((b) => Math.hypot(b.rx - px, b.ry - py) < BANK_ROAD_M || Math.hypot(b.x - px, b.y - py) < BANK_M);
      let best = BESIDE_M;
      for (const lot of world.lots) {
        if (Math.abs(lot.x - px) > 120 || Math.abs(lot.y - py) > 120) continue;
        const d = distanceTo(lot, px, py);
        if (d < best) {
          best = d;
          found = lot;
        }
      }
    }
    if (bank) found = null;
    const shown = bank ? `bank ${game.cash} ${this.saved}` : found ? `${world!.lots.indexOf(found)} ${game.cash} ${this.saved} ${this.homes.homes.length} ${this.homeOf(found)?.colour ?? ''}` : '';
    if (shown === this.shown) return;
    this.shown = shown;
    this.panel.hidden = !shown;
    if (!shown) return;
    this.panel.replaceChildren();
    if (bank) {
      const title = document.createElement('b');
      title.textContent = 'Bank';
      const p = document.createElement('p');
      p.textContent = `You have ${money(this.saved)} here. Money in the bank is safe from fines and pays for homes in ${this.plate?.place || 'your home town'}.`;
      const b = document.createElement('button');
      const amount = Math.min(Math.floor(game.cash), MAX_CASH - this.saved);
      b.textContent = `Pay in ${money(Math.max(0, amount))}`;
      b.disabled = amount < 1;
      b.addEventListener('click', () => this.payIn());
      this.panel.append(title, p, b);
      return;
    }
    if (!found) return;
    const had = this.homeOf(found);
    const line = (text: string) => {
      const p = document.createElement('p');
      p.textContent = text;
      this.panel.append(p);
    };
    const button = (text: string, price: number, what: 'flat' | 'house' | 'building') => {
      const b = document.createElement('button');
      const open = canBuy(this.homes, what);
      b.textContent = open ? `${text}  ${money(price)}` : `${text}: opens ${opensAfter(what)}`;
      b.disabled = !open || this.budget() < price;
      b.addEventListener('click', () => this.buy(found!, what));
      this.panel.append(b);
    };
    const title = document.createElement('b');
    if (had) {
      title.textContent = had.kind === 'building' ? 'Your building' : had.kind === 'house' ? 'Your house' : 'Your flat';
      this.panel.append(title);
      line(`Pays ${money(had.rent)} rent each day you come back.`);
      if (had.kind === 'flat') button('Buy the rest of the building', Math.max(0, found.whole - had.paid), 'building');
      else this.paints(found, had);
      return;
    }
    title.textContent = 'For sale';
    this.panel.append(title);
    if (found.kind === 'house') {
      line(`A house${on(found.street)}. Pays ${money(rentFor(found.price))} rent each day you come back.`);
      button('Buy the house', found.price, 'house');
    } else {
      line(`Flats in ${floorsA(found.floors)} ${found.inHouse ? 'house' : 'building'}${on(found.street)}. One pays ${money(rentFor(found.price))} rent each day you come back.`);
      button('Buy a flat', found.price, 'flat');
      button(`Buy all ${found.units}`, found.whole, 'building');
    }
    if (this.budget() < found.price) line(`You have ${money(game.cash)}${this.atPlate && this.saved ? ` and ${money(this.saved)} in the bank` : ''}.`);
  }

  /** For a whole house or building: the colours it can be painted, and the map's own. */
  private paints(lot: Lot, home: Home): void {
    const row = document.createElement('div');
    row.className = 'paints';
    const swatch = (hex: string | null, name: string) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.title = name;
      b.setAttribute('aria-label', `Paint it ${name}`);
      if (hex) b.style.background = hex;
      else b.textContent = '×';
      if ((home.colour ?? null) === hex) b.classList.add('on');
      b.addEventListener('click', () => {
        if (hex) home.colour = hex;
        else delete home.colour;
        this.world?.model.paintBuilding(lot.poly, hex);
        saveHomes(this.homes);
        this.host.save();
        this.shown = '';
        this.look();
      });
      row.append(b);
    };
    for (const p of PAINTS) swatch(p.hex, p.name);
    swatch(null, 'its own colour again');
    const p = document.createElement('p');
    p.className = 'small';
    p.textContent = 'Paint it:';
    this.panel.append(p, row);
  }

  /**
   * After a run: rent paid out, and a home offered near where it ended. The dearest flat or house
   * the cash will buy, or the cheapest and what is missing; and a bigger one to save up for.
   */
  offer(box: HTMLElement): void {
    const { game } = this.host;
    const rent = this.payRent();
    box.replaceChildren();
    const world = this.world;
    if (!world) {
      box.hidden = true;
      return;
    }
    const [px, py] = game.pos();
    const free = world.lots.filter((l) => Math.hypot(l.x - px, l.y - py) < OFFER_M && !this.homeOf(l));
    const cash = this.budget();
    const p = (text: string, cls = '') => {
      const el = document.createElement('p');
      el.textContent = text;
      if (cls) el.className = cls;
      box.append(el);
      return el;
    };
    const owned = this.homes.homes.length;
    if (owned) p(`Your ${owned === 1 ? 'home pays' : `${owned} homes pay`} ${money(rentPerVisit(this.homes))} rent each day you come back${rent ? `. Paid today: ${money(rent)}` : ''}.`, 'small');
    if (!free.length) {
      box.hidden = !owned;
      return;
    }
    box.hidden = false;
    const open = (l: Lot) => canBuy(this.homes, l.kind === 'house' ? 'house' : 'flat');
    const affordable = free.filter((l) => open(l) && l.price <= cash).sort((a, b) => b.price - a.price || Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    const pick = affordable[0];
    const what = (l: Lot) => (l.kind === 'house' ? 'house' : 'flat');
    if (pick) {
      const head = document.createElement('b');
      head.textContent = `For sale near here: ${describe(pick, what(pick))}`;
      box.append(head);
      p(`${money(pick.price)}. You have ${money(cash)}${this.atPlate && this.saved ? ', counting the bank' : ''}. It pays ${money(rentFor(pick.price))} rent each day you come back.`);
      const b = document.createElement('button');
      b.className = 'buy';
      b.textContent = `Buy it for ${money(pick.price)}`;
      b.addEventListener('click', () => {
        if (this.buy(pick, what(pick))) this.offer(box);
      });
      box.append(b);
    } else {
      const cheap = [...free].filter(open).sort((a, b) => a.price - b.price)[0];
      if (!cheap) return;
      p(`The cheapest home near here is ${describe(cheap, what(cheap))}: ${money(cheap.price)}. ${money(cheap.price - cash)} more and it's yours.`);
    }
    // something bigger, to aim for: the nearest house or whole building that costs more
    const goal = free
      .filter((l) => canBuy(this.homes, l.kind === 'house' ? 'house' : 'building') && (l.kind === 'house' ? l.price : l.whole) > Math.max(cash, pick?.price ?? 0) * 1.5)
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
    if (goal) p(`Also near: ${describe(goal, goal.kind === 'house' ? 'house' : 'building')}, ${money(goal.kind === 'house' ? goal.price : goal.whole)}.`, 'small');
    p('Stop beside any building to see its price.', 'small');
  }
}
