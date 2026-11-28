/**
 * The garage on screen (the owner, 28 November 2026; the rules are in `game/garage.ts`): its symbol on the
 * roofs and the maps, and the panel when the player stops beside one. There a car driven up can be parked,
 * which keeps it; a kept car can be taken out, or sold to free its spot.
 *
 * A kept car taken out stands in the world like any car. It is not watched: left anywhere, wrecked or gone
 * with a part of town, it can be taken out again at any garage of its city, and the one that stood about
 * is taken away then. So there is nothing to park back and no way to lose a car.
 *
 * The panel is the one of a building for sale (`#forsale`), which the homes otherwise draw: beside a garage
 * they leave it alone (`HomesHost.garage`).
 *
 * The garage also hands out its own job, the car delivery (`game/specials.ts`): a special car stands by the
 * garage with the player in it, and goes to its owner without a new dent. A car so delivered is for sale in
 * the panel from then on. A customer's car that was not handed over stays on the street, and cannot be kept.
 */

import { SPECS, type Car } from './game/cars';
import type { Game } from './game/game';
import { buy, canKeep, carsAt, delivered, giveUp, loadGarage, PAINT_COST, park, priceOf, repaint, sell, sellable, SPOTS, storeGarage, type Garage, type KeptCar, type Make } from './game/garage';
import { serviceIcon } from './game/services';
import { careCar, careLevel, carePay, careWay, isSpecial, special, type SpecialId } from './game/specials';
import type { World } from './game/world';
import { money, T } from './i18n';

/** how near its spot on the road, or its symbol, one has to stop for a garage's panel (m): as at a bank */
const ROAD_M = 9;
const NEAR_M = 14;
/** a car taken out is stood this far along the street at most (m) */
const STAND_REACH_M = 48;


export interface GarageHost {
  game: Game;
  toast: (text: string, kind?: 'good' | 'bad' | 'info', ms?: number) => void;
  /** a city being guessed, the tour, a friend's run or party: no garage meanwhile */
  quiet?: () => boolean;
  /** what is kept changed: for saving online */
  stored?: () => void;
}

interface Spot {
  x: number;
  y: number;
  /** its spot on the road, and where along which street that is (-1: no street near) */
  rx: number;
  ry: number;
  line: number;
  s: number;
  lat: number;
  lon: number;
}

export class GarageUi {
  private readonly panel = document.getElementById('forsale')!;
  private garage: Garage = loadGarage();
  private world: World | null = null;
  private spots: Spot[] = [];
  /** kept cars taken out on this page, each with the car that stands for it in the world */
  private readonly out = new Map<number, Car>();
  /** what the panel shows, so it is drawn again only when that changes */
  private shown = '';
  /** the car whose "Sell" has been pressed once: the second press sells */
  private sure = 0;
  /** the special car of the delivery that is on */
  private caring: SpecialId | null = null;
  /** customers' cars that were not handed over: they stay on the street, and are not for keeping */
  private readonly customers = new WeakSet<Car>();

  constructor(private readonly host: GarageHost) {
    host.game.ticks.push(() => this.tick());
    host.game.onCare = (e, car, cash) => this.careOver(e, car, cash);
  }

  /** Whether the player has stopped beside a garage, with the game free for it: its panel is up. */
  here(): boolean {
    return this.spotHere() !== null;
  }

  /** The cars kept, for tests and add-ons. */
  kept(): readonly KeptCar[] {
    return this.garage.cars;
  }

  private tick(): void {
    const world = this.host.game.world;
    if (world && world !== this.world) this.enter(world);
    this.look();
  }

  /** A new part of town: the garages' symbols, on the roof (or by the street, where one is made up) and on the maps. */
  private enter(world: World): void {
    this.world = world;
    this.shown = '';
    this.spots = world.garages.map((g) => {
      const n = world.roads.nearest(g.x, g.y, 150, 'traffic');
      const [rx, ry] = n ? world.roads.point(n.line, n.s) : [g.x, g.y];
      const at = world.proj.toLngLat(g.x, g.y);
      world.mark(serviceIcon('garage', !!g.invented), g.x, g.y);
      return { x: g.x, y: g.y, rx, ry, line: n ? n.line : -1, s: n ? n.s : 0, lat: at.lat, lon: at.lon };
    });
  }

  /** The garage the player has stopped beside, when nothing else is on: a job, a party, a search and a run come first. */
  private spotHere(): Spot | null {
    const { game } = this.host;
    if (!this.world || this.host.quiet?.() || game.held || game.speed() >= 1.2 || game.job || game.party || game.find || !game.run.over) return null;
    const [px, py] = game.pos();
    return this.spots.find((b) => Math.hypot(b.rx - px, b.ry - py) < ROAD_M || Math.hypot(b.x - px, b.y - py) < NEAR_M) ?? null;
  }

  /** The kept car the player sits in, if it is one taken out on this page. */
  private mine(): number {
    const car = this.host.game.car;
    if (car) for (const [id, c] of this.out) if (c === car) return id;
    return 0;
  }

  private look(): void {
    const { game } = this.host;
    const spot = this.spotHere();
    if (!spot) {
      // left: a "Sell" pressed once is forgotten, and the panel goes, unless the homes have drawn a building
      // into it already this step (they look before the garage does)
      if (this.shown) {
        this.shown = '';
        this.sure = 0;
        if (this.panel.querySelector(':scope > b[data-garage]')) {
          this.panel.hidden = true;
          this.panel.replaceChildren();
        }
      }
      return;
    }
    const cars = carsAt(this.garage, spot.lat, spot.lon);
    const car = game.car;
    // what the panel says depends on: the car driven up, the cars kept, a press on "Sell", and whether a bus's paint can be paid
    const shown = `garage ${this.spots.indexOf(spot)} ${car ? `${car.kind}${car.colour}${car.look}` : 'foot'} ${this.mine()} ${cars.map((c) => `${c.id}${c.painted ? 'p' : ''}`).join(',')} ${this.sure} ${game.cash >= PAINT_COST} ${this.garage.done} ${this.garage.shown.map((id) => `${id}${game.cash >= special(id).price}`).join(',')}`;
    if (shown === this.shown) return;
    this.shown = shown;
    this.draw(spot, cars);
  }

  private draw(spot: Spot, cars: KeptCar[]): void {
    const { game } = this.host;
    const panel = this.panel;
    panel.hidden = false;
    panel.replaceChildren();
    const line = (text: string, small = false) => {
      const p = document.createElement('p');
      if (small) p.className = 'small';
      p.textContent = text;
      panel.append(p);
      return p;
    };
    const title = document.createElement('b');
    title.textContent = T.garage;
    // marks the panel as the garage's own, for when the player leaves
    title.dataset.garage = '1';
    panel.append(title);
    line(cars.length ? T.garageCars(cars.length, SPOTS) : T.garageEmpty(SPOTS));

    // the car driven up: park it, or, if it is a kept one, leave it here
    const car = game.car;
    const mine = this.mine();
    if (car && mine) {
      line(T.garageMine(this.nameOf(this.garage.cars.find((c) => c.id === mine)!)), true);
      const b = document.createElement('button');
      b.textContent = T.garageLeave;
      b.addEventListener('click', () => this.putBack(mine));
      panel.append(b);
    } else if (car && this.customers.has(car)) {
      line(T.garageCustomers, true);
    } else if (car && canKeep(car.kind)) {
      const b = document.createElement('button');
      const full = cars.length >= SPOTS;
      b.textContent = full ? T.garageFull : T.garagePark(car.kind);
      b.disabled = full;
      b.addEventListener('click', () => this.parkHere(spot));
      panel.append(b);
    } else if (car) {
      line(T.garageOnRails(car.kind as 'tram' | 'train'), true);
    }

    for (const c of cars) {
      if (c.id === mine) continue;
      const row = document.createElement('div');
      row.className = 'kept';
      const dot = document.createElement('i');
      dot.style.background = c.kind === 'police' ? '#f2f2ee' : c.kind === 'bus' && !c.painted ? '#e8b923' : c.colour;
      const name = document.createElement('span');
      name.textContent = T.garageCar(this.nameOf(c));
      const take = document.createElement('button');
      take.textContent = T.garageTake;
      take.addEventListener('click', () => this.take(spot, c.id));
      // what else can be done with it: sold; a bus painted first; a police car only given up
      const can = sellable(c);
      const sellB = document.createElement('button');
      sellB.className = 'sell';
      if (can === 'paint') {
        sellB.textContent = T.garagePaint(money(PAINT_COST));
        sellB.disabled = game.cash < PAINT_COST;
        sellB.addEventListener('click', () => this.paint(c.id));
      } else {
        sellB.textContent = can === 'no' ? (this.sure === c.id ? T.garageGiveUpSure : T.garageGiveUp) : this.sure === c.id ? T.garageSellSure(money(priceOf(c))) : T.garageSell(money(priceOf(c)));
        sellB.addEventListener('click', () => this.sellCar(c.id));
      }
      row.append(dot, name, take, sellB);
      panel.append(row);
    }
    const others = cars.filter((c) => c.id !== mine);
    if (others.some((c) => sellable(c) === 'no')) line(T.garagePoliceNote, true);
    if (others.some((c) => sellable(c) === 'paint')) line(T.garageBusNote, true);
    if (cars.length) line(T.garageNeverLost, true);

    // the garage's own job: a customer's car to its owner
    const head = (text: string) => {
      const b = document.createElement('b');
      b.className = 'part';
      b.textContent = text;
      panel.append(b);
    };
    head(T.careJob);
    line(T.careText, true);
    const job = document.createElement('button');
    job.className = 'care';
    job.textContent = T.careOffer(money(carePay(careLevel(this.garage.done))));
    job.addEventListener('click', () => this.deliver(spot));
    panel.append(job);

    // special cars delivered without a dent: for sale from then on
    if (this.garage.shown.length) head(T.saleHead);
    for (const id of this.garage.shown) {
      const s = special(id);
      const row = document.createElement('div');
      row.className = 'kept sale';
      const dot = document.createElement('i');
      dot.style.background = s.colour;
      const name = document.createElement('span');
      name.textContent = T.garageCar(id);
      const b = document.createElement('button');
      b.className = 'sell';
      b.textContent = T.saleBuy(money(s.price));
      b.disabled = game.cash < s.price || cars.length >= SPOTS;
      b.addEventListener('click', () => this.buyCar(spot, id));
      row.append(dot, name, b);
      panel.append(row);
    }
  }

  private keep(g: Garage): void {
    this.garage = g;
    storeGarage(g);
    this.host.stored?.();
    this.shown = '';
    this.sure = 0;
  }

  /** How a kept car is named: by its kind, or as the special car it is. */
  private nameOf(c: Make): KeptCar['kind'] | SpecialId {
    return c.special ?? c.kind;
  }

  /** The garage's job: a special car stands by the garage with the player in it, and its owner waits across town. */
  private deliver(spot: Spot): void {
    const { game } = this.host;
    if (this.spotHere() !== spot) return;
    const level = careLevel(this.garage.done);
    const s = careCar(level);
    const stand = this.standFor(spot, s.len ?? SPECS[s.kind].len);
    if (!stand) {
      this.host.toast(T.garageNoRoom, 'info', 5000);
      return;
    }
    const [near, far] = careWay(level);
    const was = this.mine();
    const c = game.startCare({ kind: s.kind, colour: s.colour, top: s.top, acc: s.acc, dent: s.dent, len: s.len, look: s.look }, stand, near, far, carePay(level));
    if (!c) {
      this.host.toast(T.careNone, 'info', 5000);
      return;
    }
    // a kept car the player came in goes back in, as when another is taken out
    if (was) this.fetch(was);
    this.caring = s.id;
    this.customers.add(c);
    this.shown = '';
    this.sure = 0;
    this.host.toast(T.careStart(s.id), 'info', 9000);
  }

  /** A car delivery is over: done well, it is one level up and that car is for sale; else nothing is lost. */
  private careOver(e: 'done' | 'dented' | 'lost', car: Car, cash: number): void {
    const id = this.caring;
    this.caring = null;
    if (e === 'done' && id) {
      const first = !this.garage.shown.includes(id);
      this.customers.delete(car);
      this.keep(delivered(this.garage, id));
      this.host.toast(T.careDone(money(cash), first ? id : null), 'good', 8000);
    } else this.host.toast(e === 'dented' ? T.careDented : T.careLost, 'bad', 6000);
  }

  /** Buy a special car that has been delivered: it is kept here from now on. */
  private buyCar(spot: Spot, id: SpecialId): void {
    const { game } = this.host;
    const price = special(id).price;
    if (this.spotHere() !== spot || game.cash < price) return;
    const r = buy(this.garage, id, spot.lat, spot.lon, Date.now());
    if (!r) return;
    game.cash -= price;
    this.keep(r.garage);
    this.host.toast(T.saleBought(id), 'good', 7000);
  }

  /** What makes a car in the world the car it is, as the garage keeps it. */
  private makeOf(car: Car): Make | null {
    if (!canKeep(car.kind) || this.customers.has(car)) return null;
    // a special car is kept as the car it is: its looks and numbers are that car's
    if (isSpecial(car.look)) return { kind: special(car.look).kind, colour: car.colour, special: car.look };
    const usual = SPECS[car.kind];
    return {
      kind: car.kind,
      colour: car.colour,
      ...(car.spec.top !== usual.top ? { top: car.spec.top } : {}),
      ...(car.spec.acc !== usual.acc ? { acc: car.spec.acc } : {}),
      ...(car.dent !== 1 ? { dent: car.dent } : {}),
      ...(car.kind === 'bus' && car.painted ? { painted: true } : {}),
    };
  }

  /** Park the car the player sits in: it is kept, and they stand where it stood. */
  private parkHere(spot: Spot): void {
    const { game } = this.host;
    const car = game.car;
    const make = car && this.makeOf(car);
    if (!car || !make || this.spotHere() !== spot || this.mine()) return;
    const r = park(this.garage, make, spot.lat, spot.lon, Date.now());
    if (!r) return;
    game.remove(car);
    this.keep(r.garage);
    this.host.toast(T.garageParked(this.nameOf(make)), 'good', 6000);
  }

  /** A kept car taken out is left at the garage: it goes back in, and the player stands where it stood. */
  private putBack(id: number): void {
    const c = this.out.get(id);
    if (!c || c !== this.host.game.car) return;
    this.host.game.remove(c);
    this.out.delete(id);
    this.shown = '';
  }

  /** The car that stands in the world for a kept one is taken away: it is in the garage again. */
  private fetch(id: number): void {
    const c = this.out.get(id);
    if (c && !c.gone) this.host.game.remove(c);
    this.out.delete(id);
  }

  /**
   * Take a kept car out: it stands on the street by the garage, and the player sits in it. A kept car they
   * came in goes back in; any other car they came in stays where it stands.
   */
  private take(spot: Spot, id: number): void {
    const { game } = this.host;
    const kept = this.garage.cars.find((c) => c.id === id);
    if (!kept || this.spotHere() !== spot) return;
    // wherever it was left, it is here again
    const was = this.mine();
    if (id !== was) this.fetch(id);
    const sp = kept.special ? special(kept.special) : null;
    const stand = this.standFor(spot, sp?.len ?? SPECS[kept.kind].len);
    if (!stand) {
      this.host.toast(T.garageNoRoom, 'info', 5000);
      return;
    }
    const c = sp
      ? game.place(sp.kind, stand.x, stand.y, stand.th, { colour: sp.colour, top: sp.top, acc: sp.acc, dent: sp.dent, len: sp.len, look: sp.look })
      : game.place(kept.kind, stand.x, stand.y, stand.th, { colour: kept.colour, top: kept.top, acc: kept.acc, dent: kept.dent, look: kept.painted ? 'painted' : '' });
    game.seat(c);
    if (was) this.fetch(was);
    this.out.set(id, c);
    this.shown = '';
    this.sure = 0;
  }

  /**
   * Sell a kept car, at the second press: its spot is free, and the car that stood for it is gone. A police
   * car is not sold: it is given up the same way, for nothing.
   */
  private sellCar(id: number): void {
    if (this.sure !== id) {
      this.sure = id;
      return;
    }
    const car = this.garage.cars.find((c) => c.id === id);
    if (!car) return;
    if (sellable(car) === 'no') {
      const g = giveUp(this.garage, id);
      if (!g) return;
      this.fetch(id);
      this.keep(g);
      this.host.toast(T.garageGivenUp, 'info', 5000);
      return;
    }
    const r = sell(this.garage, id);
    if (!r) return;
    this.fetch(id);
    this.host.game.cash += r.price;
    this.keep(r.garage);
    this.host.toast(T.garageSold(money(r.price)), 'good', 5000);
  }

  /** New paint for a kept bus, paid in cash: from then on it can be sold. One left about is fetched, to be painted. */
  private paint(id: number): void {
    const { game } = this.host;
    if (game.cash < PAINT_COST) return;
    const r = repaint(this.garage, id);
    if (!r) return;
    this.fetch(id);
    game.cash -= PAINT_COST;
    this.keep(r.garage);
    this.host.toast(T.garagePainted, 'good', 5000);
  }

  /**
   * Where a car of this length can stand by the garage: at the kerb or in the lane of its street, at the
   * garage's spot or a little along from it, clear of walls, water and other cars. Null where there is no room.
   */
  private standFor(spot: Spot, len: number): { x: number; y: number; th: number } | null {
    const world = this.world;
    if (!world || spot.line < 0) return null;
    const { game } = this.host;
    const road = world.roads.lines[spot.line];
    const half = len / 2;
    for (let d = 0; d <= STAND_REACH_M; d += 4) {
      for (const s of d ? [spot.s + d, spot.s - d] : [spot.s]) {
        if (s < half || s > road.len - half) continue;
        const p = { line: spot.line, s, dir: 1 as const };
        const [hx, hy] = world.roads.heading(p);
        for (const side of [road.w / 2 + 1, road.w / 4]) {
          const [x, y] = world.roads.lanePoint(p, side);
          const clear = [0, half - 0.8, -(half - 0.8)].every((t) => world.free(x + hx * t, y + hy * t, 1.2));
          const alone = game.cars.every((o) => o.gone || Math.hypot(o.x - x, o.y - y) > half + o.spec.len / 2 + 1.5);
          if (clear && alone) return { x, y, th: Math.atan2(hy, hx) };
        }
      }
    }
    return null;
  }
}
