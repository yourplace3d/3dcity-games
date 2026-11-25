/**
 * Parties at the player's homes (`game/party.ts`): the card that starts one, the symbol of its food
 * place, the card at the end with the invitation, and a friend's party opened from a link.
 *
 * The invitation asks once, softly, and takes no for an answer (the owner, 23 November: "so it doesn't
 * feel like pushing too much"): "Someone still missing for tonight's party?" with "Send them a link" or
 * "No, we're a full house". Sending earns nothing, and no link is counted.
 */

import { linkHome } from './challenge';
import { homeKey } from './game/events';
import type { Game } from './game/game';
import { dayOf, type Home } from './game/homes';
import { foodName, foodPlace, loadParties, narrowWalk, occasion, OCCASIONS, packParty, PARTY_MIN, PARTY_POINTS, pickFood, pointsDue, storeParties, WALK_MAX, type FoodSpot, type SentParty } from './game/party';
import { RING_CLEAR_M, ringAlong, serviceIcon } from './game/services';
import { POINTS_MAX } from './game/homePoints';
import type { World } from './game/world';
import type { RouteField } from './game/roads';
import type { LngLat } from './geo/projection';
import type { HomesUi } from './homesUi';
import { isCoords } from './homesList';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
/** 1:42, 0:58 */
export const clockText = (s: number) => {
  const r = Math.round(Math.max(0, s));
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
};
/** "12 s", "1:05" for a difference in time */
const gap = (s: number) => (s < 60 ? `${Math.round(s)} s` : clockText(s));
/** a door is the road beside the home: a lane a car may take (an old town's too) within this, else a main road within `DOOR_FAR` */
const DOOR_NEAR = 60;
const DOOR_FAR = 200;
/** the food places looked at for a home: straight-line distance (m) */
const LOOK_MIN = 250;
const LOOK_MAX = 1150;
const LOOK_MOST = 60;
/** a made-up food place is never further than this by road (m) */
const MADE_UP_FAR = 1600;
/** a home's food place this near the edge of the part of town loaded now (m) is kept without checking the road to it */
const EDGE_M = 150;
/** a car fits where a circle this wide (m, its half width and a little) is clear of walls */
const CAR_FIT = 1.05;

export interface PartyHost {
  game: Game;
  homes: () => HomesUi | null;
  toast: (text: string, kind?: 'good' | 'bad' | 'info', ms?: number) => void;
  /** a card over the game that waits for an answer; with no `no`, a single button */
  card: (title: string, text: string, yes: string, no: string, answer: (yes: boolean) => void, kicker?: string) => void;
  /** the game waits behind the party's own card (true), or goes on (false) */
  cover: (on: boolean) => void;
  /** the name of the place being played */
  place: () => string;
  /** the name written last time, and keeping a new one */
  name: () => string;
  keepName: (name: string) => void;
  /** a party from a link is over and its card closed: the link may leave the address */
  closed?: () => void;
  /** something kept changed (for saving online) */
  save?: () => void;
  /** a party has started: whatever run was on is over */
  started?: () => void;
}

/** Where the food goes at a home: the door or the corner, the walk up a narrow lane, and whether the whole way could be seen. */
interface Lay {
  ll: LngLat;
  walk: number;
  corner: boolean;
  known: boolean;
}

/** The party being played. */
interface Playing {
  /** the home, as `homeKey` names it, for the player's own party; null for a friend's */
  key: string | null;
  /** "your flat on Königstraße", "Lena's place" */
  where: string;
  /** "your", "Lena's", "your friend's": whose party it is */
  whose: string;
  /** "flat", for the player's own; '' for a friend's */
  kind: string;
  occasion: number;
  spot: FoodSpot;
  home: LngLat;
  door: LngLat;
  /** the last metres to the door on foot, up a lane too narrow for a car (0: none) */
  walk: number;
  /** the lanes to the door are too narrow for a car, and further than a party asks to walk: `door` is the corner */
  corner: boolean;
  /** "walk from here" has been said */
  told?: boolean;
  /** a friend's party from a link: their name and time */
  sent: SentParty | null;
}

/** Who sent their time back in a link ("Max", "a friend"); '' for the host's own invitation. */
export function backBy(s: SentParty): string {
  return s.back ? s.by || 'a friend' : '';
}

/** The line under the place's name as a party's link opens. */
export function arriveLine(s: SentParty): string {
  const back = backBy(s);
  return back ? `${cap(back)}’s time to beat: ${clockText(s.seconds)}` : `${s.name ? `${s.name}’s` : 'A friend’s'} ${occasion(s.occasion)}: you are invited`;
}

/** How a party ends at a home whose lanes are narrow: a word for the card, one for the pickup. */
function laneWords(walk: number, corner: boolean, whose: string): { card: string; say: string } {
  if (corner) return { card: ` The lanes to ${whose} door are too narrow for a car, so the friends meet you at the corner where a car can go.`, say: ': the friends meet you at the corner, the lanes are too narrow for a car' };
  if (walk) return { card: ` The lane to ${whose} door is too narrow for a car: park where it gets narrow and walk the last ${walk} m. The clock allows for it.`, say: `. Walk the last ${walk} m: the lane is too narrow for a car` };
  return { card: '', say: '' };
}

export class PartyUi {
  private store = loadParties();
  private playing: Playing | null = null;
  /** the food place's symbol, and the square it is on */
  private mark: { remove: () => void } | null = null;
  private markIn: World | null = null;
  /** the party just played, to send: what goes in the link */
  private finished: (SentParty & { own: boolean }) | null = null;
  /** the way by road to the door of a party up a narrow lane, for saying where to leave the car */
  private doorField: { world: World; f: ReturnType<World['roads']['field']> } | null = null;
  private laneT = 0;

  constructor(private readonly host: PartyHost) {
    host.game.onPartyEnd = (end, seconds) => this.ended(end, seconds);
    host.game.ticks.push((dt) => this.tick(dt));
    $('btn-party-send').addEventListener('click', () => void this.send());
    $('btn-party-no').addEventListener('click', () => this.close());
    $('party-link').addEventListener('focus', (e) => (e.target as HTMLInputElement).select());
  }

  private today(): string {
    return dayOf(Date.now());
  }

  /** Whether a party can be thrown at a home now: in the part of town being played, repaired, and nothing else on. */
  can(home: Home): boolean {
    const g = this.host.game;
    const homes = this.host.homes();
    return !!homes && homes.isHere(home) && !homes.wornDown(home) && !g.job && !g.party && !this.playing;
  }

  /** The home points a party now would pay: the first of the day, as many of `PARTY_POINTS` as fit under `POINTS_MAX`. */
  private pays(): number {
    if (!pointsDue(this.store, this.today())) return 0;
    return Math.max(0, Math.min(PARTY_POINTS, POINTS_MAX - (this.host.homes()?.pointsNow() ?? 0)));
  }

  /** The button beside a home: with the points, while a party would still pay them. */
  label(_home: Home): string {
    const n = this.pays();
    return n ? `Throw a party · ${n} home ${n === 1 ? 'point' : 'points'}` : 'Throw a party';
  }

  /** What the button depends on, so the panel is drawn again when it changes. */
  tag(): string {
    return `${this.pays()} ${!!this.playing}`;
  }

  /** On the job bar: what is on board. */
  hudLabel(): string {
    const p = this.playing;
    return p ? cap(p.spot.food === 'shop' ? 'drinks and snacks' : 'pizza') : 'Party';
  }

  /** For the menu: what the party is, while one is on. */
  pauseLine(): string {
    const p = this.playing;
    return p ? `You are fetching ${foodName(p.spot.food)} for ${p.whose} ${occasion(p.occasion)}.` : '';
  }

  /** The card that starts a party at a home: what it asks, and what it pays. */
  offer(home: Home): void {
    const homes = this.host.homes();
    const world = this.host.game.world;
    const lot = homes?.lotOfHome(home);
    if (!homes || !world || !lot || !this.can(home)) return;
    const key = homeKey(home);
    const plan = this.plan(world, key, lot);
    if (!plan) {
      this.host.toast('No way by road from here to a place for food: try another of your homes.', 'bad', 6000);
      return;
    }
    const { door, spot } = plan;
    const occ = Math.floor(Math.random() * OCCASIONS.length);
    const food = foodName(spot.food);
    const due = pointsDue(this.store, this.today());
    const pays = this.pays();
    const best = this.store.best[key];
    // a run of three under way, or one a friend sent, stops for the party
    const run = !this.host.game.run.over;
    const where = `your ${home.kind}${home.street ? ` on ${home.street}` : ''}`;
    const lane = laneWords(door.walk, door.corner, 'your');
    const at = door;
    const it = spot;
    this.host.card(
      `${cap(occasion(occ))} at your ${home.kind}`,
      `Friends are coming over tonight, and nobody got the food. Fetch ${food} from ${foodPlace(spot.food)}${spot.invented ? ' around the corner' : ''}: the pink sign, and the arrow shows the way. Then bring ${spot.food === 'shop' ? 'them' : 'it'} to your door before ${spot.food === 'shop' ? 'the drinks get warm' : 'it gets cold'}: the clock starts when you pick ${spot.food === 'shop' ? 'them' : 'it'} up.${lane.card}` +
        (pays === PARTY_POINTS ? ` A party is worth ${PARTY_POINTS} home points, once a day.` : pays ? ` Today it is worth ${pays} home ${pays === 1 ? 'point' : 'points'}: your points are nearly full.` : due ? ` Your home points are full, so this one is for fun: spend some on a home, and a party pays again.` : ` Today’s ${PARTY_POINTS} party points are yours already: this one is for fun.`) +
        (best ? ` Your best: ${clockText(best)} from pickup to door.` : '') +
        (run ? ' The run you are on stops here.' : ''),
      'Let’s go',
      'Not now',
      (yes) => {
        if (!yes || !this.can(home)) return;
        // the home's food place is kept as the party starts, with what the whole way showed
        if (plan.keep) {
          this.store = { ...this.store, places: { ...this.store.places, [key]: plan.keep } };
          storeParties(this.store);
          this.host.save?.();
        }
        this.begin({ key, where, whose: 'your', kind: home.kind, occasion: occ, spot: it, home: { lat: home.lat, lon: home.lon }, door: at.ll, walk: at.walk, corner: at.corner, sent: null });
      },
      'Party',
    );
  }

  /** A friend's party from a link: the card, then the same run, against their time. The player starts at their home. */
  startSent(s: SentParty): void {
    // the opener's own home: a friend's time sent back, played as their own party (its points and best time)
    const homes = this.host.homes();
    // (not the first flat while it is still worn down: no party there, as `can` says)
    const mine = homes?.mine().homes.find((h) => Math.abs(h.lat - s.home.lat) < 2e-5 && Math.abs(h.lon - s.home.lon) < 2e-5 && !homes.wornDown(h));
    const whose = mine ? 'your' : s.name ? `${s.name}’s` : 'your friend’s';
    const p: Playing = {
      key: mine ? homeKey(mine) : null,
      where: mine ? `your ${mine.kind}${mine.street ? ` on ${mine.street}` : ''}` : `${whose} place`,
      whose,
      kind: mine?.kind ?? '',
      occasion: s.occasion,
      spot: { food: s.food, invented: s.invented, shop: s.shop, pick: s.pick },
      home: s.home,
      door: s.door,
      walk: s.walk,
      corner: s.corner,
      sent: s,
    };
    const food = foodName(s.food);
    const it = s.food === 'shop' ? 'them' : 'it';
    const lane = laneWords(s.walk, s.corner, mine ? 'your' : s.name ? 'their' : 'the');
    const back = backBy(s);
    const fetch = `fetch ${it} from ${foodPlace(s.food)} with the pink sign (the arrow shows the way), and bring ${it} ${mine ? 'to your door' : 'back here'} before ${s.food === 'shop' ? 'the drinks get warm' : 'it gets cold'}. The clock starts at the pickup.${lane.card}`;
    const text = back
      ? `${cap(back)} brought ${food} to ${whose} ${occasion(s.occasion)} in ${clockText(s.seconds)}. Your turn: take a car, ${fetch}`
      : mine
        ? `Friends are coming over tonight, and nobody got the food. Take a car, ${fetch}${s.seconds ? ` The time in this link: ${clockText(s.seconds)}.` : ''}`
        : `${s.name || 'Your friend'} has friends over tonight, and ${food} ${s.food === 'shop' ? 'are' : 'is'} still missing. Take a car, ${fetch}${s.seconds ? ` ${cap(s.by || s.name || 'your friend')} did it in ${clockText(s.seconds)}.` : ''}`;
    this.host.card(
      mine ? `${cap(occasion(s.occasion))} at your ${mine.kind}` : `${cap(whose)} ${occasion(s.occasion)}`,
      text + (mine && this.pays() ? ` A party is worth ${this.pays()} home ${this.pays() === 1 ? 'point' : 'points'} today.` : ''),
      'Let’s go',
      '',
      () => this.begin(p),
      'Invitation',
    );
  }

  /** The party is called off from the menu. */
  callOff(): void {
    if (!this.playing) return;
    this.host.game.endParty();
    this.drop();
    this.host.toast('Party called off. The open jobs are back.', 'info');
    this.host.closed?.();
  }

  private begin(p: Playing): void {
    const g = this.host.game;
    this.playing = p;
    p.told = false;
    this.doorField = null;
    const food = p.spot.food === 'shop' ? 'Drinks and snacks are on board: get them' : 'The pizza is on board: get it';
    const lane = laneWords(p.walk, p.corner, p.whose);
    this.host.started?.();
    g.startParty({ pick: p.spot.pick, door: p.door, walk: p.walk, say: `${food} to ${p.where} before ${p.spot.food === 'shop' ? 'the drinks get warm' : 'it gets cold'}${lane.say}` });
    this.markFood();
  }

  /** The symbol of the food place, on the square being played. */
  private markFood(): void {
    this.mark?.remove();
    this.mark = null;
    const p = this.playing;
    const world = this.host.game.world;
    this.markIn = world;
    if (!p || !world) return;
    const [x, y] = world.proj.toLocal(p.spot.shop.lon, p.spot.shop.lat);
    if (Math.abs(x) > world.half || Math.abs(y) > world.half) return;
    this.mark = world.mark(serviceIcon(p.spot.food, p.spot.invented), x, y);
  }

  private drop(): void {
    this.mark?.remove();
    this.mark = null;
    this.playing = null;
  }

  private tick(dt: number): void {
    const g = this.host.game;
    if (!this.playing) return;
    // gone without an end: another place loaded, or a new run
    if (!g.party) {
      this.drop();
      return;
    }
    if (g.world !== this.markIn) this.markFood();
    // up a narrow lane: where to leave the car, said once as the car gets there, by road (not from a street
    // that only passes near), looked at twice a second
    const p = this.playing;
    this.laneT -= dt;
    if (p.walk && !p.told && g.job?.party && g.car && g.world && this.laneT <= 0) {
      this.laneT = 0.5;
      const [dx, dy] = g.world.proj.toLocal(p.door.lon, p.door.lat);
      const [x, y] = g.pos();
      if (Math.hypot(dx - x, dy - y) < p.walk + 40) {
        if (this.doorField?.world !== g.world) this.doorField = { world: g.world, f: g.world.roads.field(dx, dy) };
        const r = this.doorField.f && g.world.roads.route(this.doorField.f, x, y, 0);
        if (r && r.metres < p.walk + 15) {
          p.told = true;
          this.host.toast(`Leave the car here and walk the last bit: the lane to ${p.where} is too narrow for a car.`, 'info', 6000);
        }
      }
    }
  }

  /**
   * The way of a home's party: its food place, and where the food goes. A home keeps its food place once one
   * is picked ("built" once, in the owner's word): it is never picked again, wherever the part of town loaded
   * now ends. The lane at the door can be a yard's driveway no road leads to: then the street in front. A lane
   * too narrow for a car is walked, up to `WALK_MAX`; further than that, the street in front where a car gets
   * nearer, else the corner nearest the home where a car can go. `keep`: what to keep with the home as the party
   * starts (the food place, and what the whole way showed), or null.
   */
  private plan(world: World, key: string, lot: { x: number; y: number }): { door: Lay; spot: FoodSpot; keep: FoodSpot | null } | null {
    const kept = this.store.places[key];
    const doors = this.doorsOf(world, lot.x, lot.y);
    const nearer = (a: LngLat, b: LngLat) => {
      const [ax, ay] = world.proj.toLocal(a.lon, a.lat);
      const [bx, by] = world.proj.toLocal(b.lon, b.lat);
      return Math.hypot(ax - lot.x, ay - lot.y) < Math.hypot(bx - lot.x, by - lot.y);
    };
    let best: { door: Lay; spot: FoodSpot } | null = null;
    for (const d of doors) {
      // the road search from a door, once for both the food place and the way
      const f = world.roads.field(d.at[0], d.at[1]);
      if (!f) continue;
      const spot = kept ?? this.pickFoodFor(world, f, d.at);
      if (!spot) continue;
      const lay = this.lay(world, f, d.ll, spot);
      if (!lay) continue;
      if (!best || (best.door.corner && (!lay.corner || nearer(lay.ll, best.door.ll)))) best = { door: lay, spot };
      if (!best.door.corner) break;
    }
    // the home's food place, and no way from it that a car can take seen from this part of town (the road to
    // it runs outside it, say): this one party fetches from another place, and the home keeps its own, and its
    // best time
    if (!best && kept) {
      for (const d of doors) {
        const f = world.roads.field(d.at[0], d.at[1]);
        const spot = f && this.pickFoodFor(world, f, d.at);
        const lay = f && spot ? this.lay(world, f, d.ll, spot) : null;
        if (spot && lay) return { door: lay, spot, keep: null };
      }
    }
    if (!best) return null;
    const { door } = best;
    const keep = door.known ? { ...best.spot, lane: { walk: door.walk, corner: door.corner, door: door.ll } } : kept ? null : best.spot;
    return { ...best, keep };
  }

  /**
   * Where the food goes at a door, for the way from its food place: the door itself; up a lane too narrow
   * for a car, the door with the last metres on foot (`walk`), never more than `WALK_MAX`; beyond that, the
   * corner where the car stops (`corner`). Null where this door won't do: no road from the food place leads
   * to it (a yard's driveway), or the car would stop right at the food place.
   */
  private lay(world: World, f: RouteField, door: LngLat, spot: FoodSpot): Lay | null {
    const [px, py] = world.proj.toLocal(spot.pick.lon, spot.pick.lat);
    const half = world.half - 10;
    const inside = Math.abs(px) < half && Math.abs(py) < half;
    // a home's food place kept from before, on a street that runs into a building: this party fetches
    // from another place (`plan`)
    if (inside && !world.free(px, py, RING_CLEAR_M)) return null;
    const r = inside ? world.roads.route(f, px, py) : null;
    if (!r) {
      // well inside the part of town loaded now and no road to this door: another door
      if (inside && Math.abs(px) < half - EDGE_M && Math.abs(py) < half - EDGE_M) return null;
      // the food place out of it, or near its edge: as last worked out where the whole way could be seen
      return spot.lane ? { ll: spot.lane.door, walk: spot.lane.walk, corner: spot.lane.corner, known: false } : { ll: door, walk: 0, corner: false, known: false };
    }
    const n = narrowWalk(r.pts, (x, y) => !world.solids.inside(x, y) && !world.solids.push({ x, y }, CAR_FIT));
    if (!n) return { ll: door, walk: 0, corner: false, known: true };
    if (n.walk <= WALK_MAX) return { ll: door, walk: Math.max(5, Math.round(n.walk / 5) * 5), corner: false, known: true };
    // the corner where the car stops, unless that is right at the food place: then the food would be delivered as it is picked up
    if (r.metres - n.walk < PARTY_MIN) return null;
    return { ll: world.proj.toLngLat(n.stop[0], n.stop[1]), walk: 0, corner: true, known: true };
  }

  /** Where the food may be brought to at a home: the lane at its door, else the nearest main road. */
  private doorsOf(world: World, x: number, y: number): Array<{ at: [number, number]; ll: LngLat }> {
    return [world.roads.nearest(x, y, DOOR_NEAR, 'drive'), world.roads.nearest(x, y, DOOR_FAR, 'traffic')].flatMap((n) => {
      if (!n) return [];
      const at = world.roads.point(n.line, n.s);
      return [{ at, ll: world.proj.toLngLat(at[0], at[1]) }];
    });
  }

  /** A food place for a home that has none yet: of those a road leads to from the door (`f`), the best fit; else one made up. */
  private pickFoodFor(world: World, f: RouteField, door: [number, number]): FoodSpot | null {
    const half = world.half - 10;
    const [dx, dy] = door;
    const near = world.food
      .map((p) => ({ p, d: Math.hypot(p.x - dx, p.y - dy) }))
      .filter((c) => Math.abs(c.p.x) < half && Math.abs(c.p.y) < half);
    // the ones at a fitting distance first; a few dozen are enough to choose from
    const fit = near.filter((c) => c.d >= LOOK_MIN && c.d <= LOOK_MAX);
    const look = (fit.length ? fit : near).sort((a, b) => Math.abs(a.d - 650) - Math.abs(b.d - 650)).slice(0, LOOK_MOST);
    const cands = look.flatMap(({ p }) => {
      const n = world.roads.nearest(p.x, p.y, 150, 'traffic');
      // where a car can stand: not on a street the map has running into a building, a step along it at most
      const s = n && ringAlong(world.roads, (x, y, r) => world.free(x, y, r), n.line, n.s);
      if (!n || s === null) return [];
      const [rx, ry] = world.roads.point(n.line, s);
      const metres = world.roads.route(f, rx, ry, 0)?.metres;
      if (metres === undefined || !Number.isFinite(metres)) return [];
      return [{ metres, invented: !!p.invented, food: p.food, shop: world.proj.toLngLat(p.x, p.y), pick: world.proj.toLngLat(rx, ry) }];
    });
    let pick = pickFood(cands);
    // no food place on the map that a road leads to: one made up beside a street, at a fitting distance by
    // road (a spot across a river can be kilometres round by road)
    if (!pick) {
      const made: typeof cands = [];
      for (let i = 0; i < 12; i++) {
        const at = world.roads.randomPlace('traffic', dx, dy, i < 8 ? 500 : 250, i < 8 ? 1000 : 1400);
        if (!at) continue;
        const s = ringAlong(world.roads, (x, y, r) => world.free(x, y, r), at.line, at.s);
        if (s === null) continue;
        const [rx, ry] = world.roads.point(at.line, s);
        const metres = world.roads.route(f, rx, ry, 0)?.metres;
        if (metres === undefined || !Number.isFinite(metres) || metres > MADE_UP_FAR) continue;
        const [hx, hy] = world.roads.heading({ ...at, s });
        const side = world.roads.lines[at.line].w / 2 + 7;
        made.push({ metres, invented: true, food: 'restaurant', shop: world.proj.toLngLat(rx + hy * side, ry - hx * side), pick: world.proj.toLngLat(rx, ry) });
      }
      pick = pickFood(made);
    }
    if (!pick) return null;
    return { food: pick.food, invented: pick.invented, shop: pick.shop, pick: pick.pick };
  }

  /** The food got to the door, got cold, or was lost to a fine. */
  private ended(end: 'done' | 'cold' | 'lost', seconds: number): void {
    const p = this.playing;
    this.drop();
    if (!p) return;
    const food = foodName(p.spot.food);
    if (end !== 'done') {
      this.host.card(
        end === 'lost' ? `${cap(food)} ${p.spot.food === 'shop' ? 'are' : 'is'} gone` : `${cap(food)} got ${p.spot.food === 'shop' ? 'warm' : 'cold'}`,
        `${end === 'lost' ? `${cap(food)} didn’t make it through that` : `The clock ran out before ${food} got to ${p.where}`}. The friends are still waiting: the same place, the same way.`,
        'Try again',
        'Not now',
        (yes) => {
          if (!yes) return this.host.closed?.();
          if (!this.host.game.job && !this.host.game.party) this.begin(p);
        },
        'Party',
      );
      return;
    }
    const t = clockText(seconds);
    let text: string;
    // against the time in the link it came by
    const s = p.sent;
    const them = s ? s.by || s.name || 'your friend' : '';
    const d = s ? seconds - s.seconds : 0;
    const versus = !s?.seconds ? '' : Math.abs(d) < 0.5 ? `, just as fast as ${them}` : d < 0 ? `: ${gap(-d)} faster than ${them}` : `. ${cap(them)} was ${gap(d)} faster`;
    if (!p.key) {
      const own = this.host.homes()?.mine().homes.length ?? 0;
      text = `${cap(food)} got there in ${t} from the pickup${versus}.${own ? '' : ' A party of your own needs a home of your own: do a couple of deliveries, and you’ll be shown a cheap flat.'}`;
    } else {
      const key = p.key;
      // a run to another food place than the home's own (an older link) is no best time for it
      const ownRun = (() => {
        const kept = this.store.places[key];
        return !!kept && Math.abs(kept.pick.lat - p.spot.pick.lat) < 2e-5 && Math.abs(kept.pick.lon - p.spot.pick.lon) < 2e-5;
      })();
      const before = this.store.best[key];
      const due = pointsDue(this.store, this.today());
      const added = due ? (this.host.homes()?.partyPoints(PARTY_POINTS) ?? 0) : 0;
      // a party pays what fits under the most points that wait, once a day; with no room it pays nothing, and the day's points wait for a later party
      this.store = { ...this.store, paid: added ? this.today() : this.store.paid, best: ownRun ? { ...this.store.best, [key]: before ? Math.min(before, Math.round(seconds)) : Math.round(seconds) } : this.store.best };
      storeParties(this.store);
      this.host.save?.();
      const record = ownRun && before && seconds < before - 0.5 ? ` Your best yet, ${gap(before - seconds)} faster than before.` : '';
      const points = added ? ` +${added} home ${added === 1 ? 'point' : 'points'}.` : due ? ' Your home points are full: spend some on a home.' : ` Today’s party points are yours already; tomorrow’s party brings ${PARTY_POINTS} more.`;
      text = `${cap(food)} got to ${p.where} in ${t} from the pickup, ${p.spot.food === 'shop' ? 'still cold' : 'still warm'}${versus}.${record}${points}`;
    }
    this.finished = {
      own: !!p.key,
      // a friend sending their time back: it stays the host's party
      name: p.sent?.name ?? '',
      by: '',
      seconds: Math.round(seconds),
      place: p.sent?.place || this.host.place(),
      occasion: p.occasion,
      food: p.spot.food,
      invented: p.spot.invented,
      home: p.home,
      door: p.door,
      shop: p.spot.shop,
      pick: p.spot.pick,
      walk: p.walk,
      corner: p.corner,
      back: false,
    };
    this.endCard(p, text);
  }

  /** The end of a party: how it went, and once, softly, an invitation. */
  private endCard(p: Playing, text: string): void {
    const occ = occasion(p.occasion);
    const them = p.sent?.name || 'your friend';
    const guest = !p.key;
    $('party-title').textContent = guest ? `You brought ${foodName(p.spot.food)} to ${p.whose} ${occ}` : `${cap(occ)} can start`;
    $('party-text').textContent = text;
    $('party-ask').textContent = guest ? `Let ${them} know you made it?` : `Someone still missing for tonight’s ${occ}?`;
    $('btn-party-send').textContent = guest ? `Send ${them} your time` : 'Send them a link';
    $('btn-party-no').textContent = guest ? 'No, just keep driving' : 'No, we’re a full house';
    $<HTMLInputElement>('party-name').value = this.host.name();
    $('party-note').textContent = guest
      ? `The link is ${them}’s ${occ} again, with your time.`
      : `Whoever opens it starts at your ${p.kind} and fetches ${foodName(p.spot.food)} from the same place, against your ${clockText(this.finished?.seconds ?? 0)}.${this.store.warned ? '' : ` The link shows where your ${p.kind} is in the game.`}`;
    $('party-link').hidden = true;
    this.host.cover(true);
    $('party').hidden = false;
  }

  private async send(): Promise<void> {
    const f = this.finished;
    if (!f) return;
    const name = $<HTMLInputElement>('party-name').value.trim().slice(0, 16);
    if (name) this.host.keepName(name);
    if (f.own && !this.store.warned) {
      this.store = { ...this.store, warned: true };
      storeParties(this.store);
      this.host.save?.();
    }
    // the host's own party carries their name; a friend's time sent back carries the friend's as who set it,
    // and "a friend" where they gave none, so it is never read as the host's own time
    const code = packParty({ ...f, name: f.own ? name : f.name, by: f.own ? name : name || 'a friend', back: !f.own });
    const url = `${linkHome(location)}?p=${code}#${f.home.lat.toFixed(5)},${f.home.lon.toFixed(5)}`;
    const food = foodName(f.food);
    const occ = occasion(f.occasion);
    const text = f.own
      ? `${cap(occ)} at my place${f.place && !isCoords(f.place) ? ` in ${f.place}` : ''} tonight: can you bring ${food}? I got ${f.food === 'shop' ? 'them' : 'it'} there in ${clockText(f.seconds)}.`
      : `I brought ${food} to your ${occ} in ${clockText(f.seconds)}.`;
    const box = $<HTMLInputElement>('party-link');
    box.value = url;
    box.hidden = false;
    const note = $('party-note');
    const after = f.own ? 'Whoever opens it comes to your party.' : 'Sent.';
    // after one, the way out reads as the end of the list, not as a no
    $('btn-party-send').textContent = f.own ? 'Send it to someone else' : 'Send it again';
    $('btn-party-no').textContent = f.own ? 'That’s everyone' : 'Keep driving';
    try {
      // a phone offers its own list of apps to send with
      if (document.body.classList.contains('touch') && navigator.share) {
        await navigator.share({ text, url });
        note.textContent = after;
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      note.textContent = `Link copied. ${after}`;
    } catch {
      box.select();
      note.textContent = `Copy this link and send it. ${after}`;
    }
  }

  private close(): void {
    $('party').hidden = true;
    this.host.cover(false);
    this.finished = null;
    this.host.closed?.();
  }
}
