/**
 * Homes on screen: the offer on the result card after a run, the "for sale" panel when the player
 * stops beside a building, the marks on owned buildings, and the rent waiting on return.
 * The rules and prices are in `game/homes.ts`.
 */

import type { Game } from './game/game';
import type { World } from './game/world';
import { canBuy, dayOf, homesIn, loadHomes, opensAfter, PAINTS, rentFor, saveHomes, type Home, type Homes, type Lot } from './game/homes';
import { FIXER_AFTER, FIXER_MIN, jobLines, loadReno, rentShare, storeReno, UNITS_MAX, UNITS_MIN, wantsJob, WORN, type Reno } from './game/renovation';
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
  /** the first home was just bought (what it is, its rent each day; worn down: no rent until repaired): saving online opens */
  firstHome?: (what: string, rent: string, worn: boolean) => void;
  /** a card over the game that waits for an answer (the mission's); with no `no`, a single button */
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
  /** the new player's way to a first home and its building (`game/renovation.ts`); null: not begun */
  private reno: Reno | null = loadReno(this.homes.homes.length > 0);
  /** offered on this visit already (and put off) */
  private offered = false;
  /** the notes after the first deliveries, said on this visit */
  private noted = new Set<string>();
  /** where the mission leads: a part of town with worn-down flats, in the square being played */
  private area: { x: number; y: number; rx: number; ry: number; lots: Lot[]; marks: Array<{ remove: () => void }>; here: boolean } | null = null;
  /** the arrow points at the player's building until they get there (to buy the rest, or to paint it) */
  private toBuilding = false;

  constructor(private readonly host: HomesHost) {
    host.game.ticks.push((dt) => this.tick(dt));
    host.game.onSpecialTaken = () => this.specialTaken();
    host.game.onSpecialDone = () => this.specialDone();
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

  // ------------------------------------------------------------ the first home and its building

  private setReno(r: Reno): void {
    this.reno = r;
    storeReno(r);
    this.host.save();
    this.syncSpecial();
  }

  /** A package from any station goes to the building, while it waits for one. */
  private syncSpecial(): void {
    const r = this.reno;
    const first = this.homes.homes[0];
    this.host.game.special = r && first && wantsJob(r) ? { at: { lat: first.lat, lon: first.lon }, say: jobLines(r) } : null;
  }

  /** The first home, the building being repaired: its lot in the square being played, if it is in it. */
  private renoLot(): Lot | null {
    const first = this.homes.homes[0];
    if (!first) return null;
    for (const [lot, home] of this.owned) if (home === first) return lot;
    return null;
  }

  /** What a home pays on a day one comes back: the first home only the share that is repaired. */
  private rentOf(home: Home): number {
    return home === this.homes.homes[0] ? Math.round(home.rent * rentShare(this.reno)) : home.rent;
  }

  private rentPerVisit(): number {
    return this.homes.homes.reduce((s, h) => s + this.rentOf(h), 0);
  }

  /** What a worn-down flat sells for: what the player had when it was offered, never more than the flat. */
  private fixerPrice(lot: Lot): number {
    const offered = this.reno?.price ?? Math.floor(this.host.game.cash / 10) * 10;
    return Math.max(10, Math.min(lot.price, offered));
  }

  private say(text: string, kind: 'good' | 'info' = 'info', ms = 9000): void {
    // after the line a delivery itself brings
    setTimeout(() => this.host.toast(text, kind, ms), 2600);
  }

  private missionTick(): void {
    const { game } = this.host;
    const world = this.world;
    if (!world) return;
    const r = this.reno;
    const first = this.homes.homes[0];
    this.syncSpecial();
    if (r?.stage === 'find') {
      if (this.homes.homes.length) {
        // a home was bought some other way: nothing to repair
        this.dropArea();
        this.setReno({ stage: 'done' });
        return;
      }
      if (!this.area) this.area = this.pickArea();
      const a = this.area;
      game.guide = a && !a.here ? { x: a.rx, y: a.ry } : null;
      if (!a) return;
      const [px, py] = game.pos();
      if (!a.here && Math.hypot(a.x - px, a.y - py) < 110) {
        a.here = true;
        game.guide = null;
        this.host.toast(`Here: worn-down flats for ${money(this.fixerPrice(a.lots[0]))}. Stop beside a building with a green $ sign to buy one.`, 'info', 9000);
      }
      return;
    }
    if (r?.stage === 'buy' && first) {
      // enough for the rest of the building: say so once, and point the way
      const lot = this.renoLot();
      if (lot && !this.noted.has('rest') && this.budget() >= Math.max(0, lot.whole - first.paid)) {
        this.noted.add('rest');
        this.toBuilding = true;
        this.host.toast(`You have enough for the rest of your building: ${money(Math.max(0, lot.whole - first.paid))}. Follow the arrow and stop beside it.`, 'good', 9000);
      }
    }
    if (this.toBuilding) {
      const lot = this.renoLot();
      const n = lot && world.roads.nearest(lot.x, lot.y, 200, 'traffic');
      const [px, py] = game.pos();
      if (!lot || !n || Math.hypot(lot.x - px, lot.y - py) < 40 || game.job) {
        if (lot && Math.hypot(lot.x - px, lot.y - py) < 40) this.toBuilding = false;
        if (game.guide && !game.job) game.guide = null;
      } else {
        const [rx, ry] = world.roads.point(n.line, n.s);
        game.guide = { x: rx, y: ry };
      }
    }
    if (r) return;
    if (this.homes.homes.length) {
      this.setReno({ stage: 'done' });
      return;
    }
    // no home yet: a word after the first delivery, and the offer after the second
    const d = game.delivered;
    if (d === 1 && !this.noted.has('one')) {
      this.noted.add('one');
      this.say('One more delivery, and you can buy yourself some property: your first flat.');
    }
    if (d < FIXER_AFTER || game.cash < FIXER_MIN || this.offered || !this.host.card) return;
    if (!game.run.over) {
      if (!this.noted.has('run')) {
        this.noted.add('run');
        this.say('Enough for a first flat. Finish the run, and you will be shown where.');
      }
      return;
    }
    if (game.job) return;
    this.offered = true;
    const price = Math.floor(game.cash / 10) * 10;
    this.host.card(
      'Private mission: your first home',
      `You have ${money(game.cash)}. Not far from here, a few buildings have flats with worn-down walls, and they sell cheap: one is yours for ${money(price)}. Drive there, stop beside a building with a green $ sign, and buy it.`,
      'Show me the place',
      'Later',
      (yes) => {
        if (!yes) return;
        this.setReno({ stage: 'find', price });
        this.missionTick();
      },
    );
  }

  /** A part of town near the player with cheap flats in buildings of a few flats: up to six marked, and a spot on the street to drive to. */
  private pickArea(): HomesUi['area'] {
    const { game } = this.host;
    const world = this.world!;
    const [px, py] = game.pos();
    // within reach, and not at the square's very edge, where the next square takes over
    const all = world.lots.filter((l) => l.kind === 'flats' && !this.owned.has(l) && Math.hypot(l.x - px, l.y - py) < 800 && Math.max(Math.abs(l.x), Math.abs(l.y)) < world.half - 120);
    // a building of 3 to 5 flats, so that repairing it is a few jobs; else the smallest there are
    const fit = all.filter((l) => l.units >= UNITS_MIN && l.units <= UNITS_MAX);
    const flats = (fit.length >= 2 ? fit : [...all].sort((a, b) => a.units - b.units).slice(0, 12)).sort((a, b) => a.price - b.price);
    if (!flats.length) return null;
    const cheap = flats.slice(0, Math.max(5, Math.ceil(flats.length * 0.3)));
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
    // their walls look it
    for (const l of group) world.model.paintBuilding(l.poly, WORN);
    return { x, y, rx, ry, lots: group, marks: group.map((l) => world.mark(forSaleIcon(), l.x, l.y)), here: false };
  }

  private dropArea(keep?: Lot): void {
    for (const m of this.area?.marks ?? []) m.remove();
    for (const l of this.area?.lots ?? []) if (l !== keep) this.world?.model.paintBuilding(l.poly, null);
    this.area = null;
    this.host.game.guide = null;
  }

  /** A package for the building is on board: the first time, the whole plan. */
  private specialTaken(): void {
    const r = this.reno;
    if (!r || r.told || !this.host.card) return;
    this.setReno({ ...r, told: true });
    const others = Math.max(1, (r.units ?? 2) - 1);
    this.host.card(
      'Mission: repair your building',
      `This package goes to your building. ${r.stage === 'flat' ? 'Your flat’s walls are worn down, and it pays no rent until it is repaired: deliver this, and it is. ' : ''}Then the rest of the building is yours to buy: ${others} more ${others === 1 ? 'flat' : 'flats'}. Each package from a fuel, fire or police station repairs one flat, and each repaired flat adds rent. When every flat is done, the outside gets a fresh coat in the colour you choose. Between them, any other job pays as always.`,
      'Let’s go',
      '',
      () => undefined,
    );
  }

  /** A package reached the building: the next step. */
  private specialDone(): void {
    const r = this.reno;
    const first = this.homes.homes[0];
    if (!r || !first) return;
    const units = r.units ?? 2;
    if (r.stage === 'flat') {
      this.setReno({ ...r, stage: 'buy' });
      const lot = this.renoLot();
      const rest = lot ? ` Next, the rest of the building: ${units - 1} ${units - 1 === 1 ? 'flat' : 'flats'} for ${money(Math.max(0, lot.whole - first.paid))}. Stop beside it to buy.` : '';
      this.say(`Your flat is repaired: from tomorrow it pays ${money(first.rent)} each day you come back.${rest}`, 'good', 10000);
    } else if (r.stage === 'rest') {
      const fixed = (r.fixed ?? 0) + 1;
      if (fixed >= units - 1) {
        this.setReno({ ...r, stage: 'paint', fixed });
        this.say('Every flat is repaired. One more package from a station: paint for the outside.', 'good', 10000);
      } else {
        this.setReno({ ...r, fixed });
        this.say(`Flat ${fixed + 1} of ${units} is repaired: it adds ${money(first.rent / units)} rent from tomorrow. The station symbols blink for the next.`, 'good', 9000);
      }
    } else if (r.stage === 'paint') {
      this.setReno({ stage: 'done' });
      const lot = this.renoLot();
      if (lot) this.world?.model.paintBuilding(lot.poly, first.colour ?? null);
      this.toBuilding = true;
      this.host.card?.(
        'Your building is done',
        `All ${units} flats are repaired, and the building pays ${money(first.rent)} each day you come back. The paint is there: follow the arrow, stop beside your building, and choose its colour.`,
        'Go on',
        '',
        () => undefined,
      );
    }
    this.shown = '';
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
    // painted homes; the building being repaired still has its worn-down walls
    const first = this.homes.homes[0];
    const worn = this.reno && this.reno.stage !== 'done';
    for (const [lot, home] of this.owned) {
      if (worn && home === first) world.model.paintBuilding(lot.poly, WORN);
      else if (home.colour) world.model.paintBuilding(lot.poly, home.colour);
    }
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
    const today = dayOf(Date.now());
    if (!this.homes.homes.length || today === this.homes.paidDay) return 0;
    // the day counts as paid even when nothing was due (a worn-down flat), so a repair pays from tomorrow
    this.homes.paidDay = today;
    saveHomes(this.homes);
    const due = this.rentPerVisit();
    if (due < 1) return 0;
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
  /** Whether a kind of home can be bought at a lot: the rest of the building being repaired opens early. */
  private open(lot: Lot, what: 'flat' | 'house' | 'building'): boolean {
    if (canBuy(this.homes, what)) return true;
    return what === 'building' && this.reno?.stage === 'buy' && this.homeOf(lot) === this.homes.homes[0];
  }

  /** A worn-down flat of the mission, sold for less. */
  private worn(lot: Lot): boolean {
    return this.reno?.stage === 'find' && !this.homes.homes.length && !!this.area?.lots.includes(lot);
  }

  buy(lot: Lot, what: 'flat' | 'house' | 'building'): boolean {
    const { game } = this.host;
    const had = this.homeOf(lot);
    const worn = what === 'flat' && this.worn(lot);
    // Prices are ranked within each loaded square, so a later square can value the same
    // building below what the flat cost. Credit that payment, but never refund cash on a buy.
    const price = what === 'building' ? Math.max(0, lot.whole - (had?.paid ?? 0)) : worn ? this.fixerPrice(lot) : lot.price;
    const pay = payFrom(price, game.cash, this.saved, this.atPlate);
    if (!pay || !this.open(lot, what) || (had && what !== 'building') || had?.kind === 'building') return false;
    const restOfReno = !!had && had === this.homes.homes[0] && this.reno?.stage === 'buy';
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
      this.dropArea(worn ? lot : undefined);
      // a worn-down flat is repaired, building and all; any other first home has nothing to repair
      this.setReno(worn ? { stage: 'flat', units: lot.units } : { stage: 'done' });
      if (worn) this.world!.model.paintBuilding(lot.poly, WORN);
      // this town is now the home plate: its banks show
      this.plate = homePlate(this.homes);
      this.showBanks();
    }
    const mine = this.homeOf(lot)!;
    if (restOfReno) {
      this.setReno({ ...this.reno!, stage: 'rest', fixed: 0 });
      this.toBuilding = false;
      const others = lot.units - 1;
      this.host.toast(`The whole building is yours.${pay.saved ? ` ${money(pay.saved)} of it came from the bank.` : ''} The other ${others} ${others === 1 ? 'flat needs' : 'flats need'} repairing: the station symbols blink again, and each repaired flat adds rent.`, 'good', 10000);
    } else if (first && this.host.firstHome) this.host.firstHome(describe(lot, what), money(mine.rent), worn);
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
    const shown = bank ? `bank ${game.cash} ${this.saved}` : found ? `${world!.lots.indexOf(found)} ${game.cash} ${this.saved} ${this.homes.homes.length} ${this.homeOf(found)?.colour ?? ''} ${this.reno?.stage ?? ''} ${this.reno?.fixed ?? ''}` : '';
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
      const open = this.open(found!, what);
      b.textContent = open ? `${text}  ${money(price)}` : `${text}: opens ${opensAfter(what)}`;
      b.disabled = !open || this.budget() < price;
      b.addEventListener('click', () => this.buy(found!, what));
      this.panel.append(b);
    };
    const title = document.createElement('b');
    if (had) {
      title.textContent = had.kind === 'building' ? 'Your building' : had.kind === 'house' ? 'Your house' : 'Your flat';
      this.panel.append(title);
      const r = this.reno;
      if (had === this.homes.homes[0] && r && r.stage !== 'done' && r.stage !== 'find') {
        const units = r.units ?? found.units;
        if (r.stage === 'flat') line('The walls are worn down: it pays no rent until it is repaired. Take a package from a blinking fuel, fire or police station.');
        else if (r.stage === 'buy') {
          line(`Repaired: pays ${money(had.rent)} rent each day you come back. The other ${units - 1 === 1 ? 'flat is' : `${units - 1} flats are`} for sale.`);
          button('Buy the rest of the building', Math.max(0, found.whole - had.paid), 'building');
        } else if (r.stage === 'rest') line(`${1 + (r.fixed ?? 0)} of ${units} flats repaired: pays ${money(this.rentOf(had))} rent each day you come back. A package from a blinking station repairs the next.`);
        else line(`Every flat is repaired: pays ${money(had.rent)} rent each day you come back. One more package from a station brings the paint for the outside.`);
        return;
      }
      line(`Pays ${money(had.rent)} rent each day you come back.`);
      if (had.kind === 'flat') button('Buy the rest of the building', Math.max(0, found.whole - had.paid), 'building');
      else this.paints(found, had);
      return;
    }
    title.textContent = 'For sale';
    this.panel.append(title);
    if (this.worn(found)) {
      const price = this.fixerPrice(found);
      title.textContent = 'For sale, worn down';
      line(`A flat in ${floorsA(found.floors)} building${on(found.street)}, ${found.units} flats. The walls are worn down: it pays rent once it is repaired. ${money(price)}${price < found.price ? `, not ${money(found.price)}` : ''}.`);
      button('Buy the worn-down flat', price, 'flat');
      if (this.budget() < price) line(`You have ${money(game.cash)}: a delivery or two more.`);
      return;
    }
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
    if (owned) p(`Your ${owned === 1 ? 'home pays' : `${owned} homes pay`} ${money(this.rentPerVisit())} rent each day you come back${rent ? `. Paid today: ${money(rent)}` : ''}.`, 'small');
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
