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
import { foodName, foodPlace, loadParties, narrowWalk, occasion, OCCASIONS, packParty, PARTY_POINTS, pickFood, pointsDue, storeParties, WALK_MAX, type FoodSpot, type SentParty } from './game/party';
import { serviceIcon } from './game/services';
import type { World } from './game/world';
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

  constructor(private readonly host: PartyHost) {
    host.game.onPartyEnd = (done, seconds) => this.ended(done, seconds);
    host.game.ticks.push(() => this.tick());
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

  /** The button beside a home: with the points, while a party still pays them today. */
  label(_home: Home): string {
    return pointsDue(this.store, this.today()) ? `Throw a party · ${PARTY_POINTS} home points` : 'Throw a party';
  }

  /** What the button depends on, so the panel is drawn again when it changes. */
  tag(): string {
    return `${pointsDue(this.store, this.today())} ${!!this.playing}`;
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
    // the lane at the door can be a yard's driveway that no road leads to: then the street in front. A lane
    // too narrow for a car is walked, up to `WALK_MAX`; further than that, the street in front if a car gets
    // to it, else the corner nearest the home where a car can go
    let door: { ll: LngLat; walk: number; corner: boolean } | null = null;
    let spot: FoodSpot | null = null;
    for (const d of this.doorsOf(world, lot.x, lot.y)) {
      const s = this.foodFor(world, key, d.at);
      if (!s) continue;
      const lay = this.lay(world, d.at, s);
      const nearer = (a: LngLat, b: LngLat) => {
        const [ax, ay] = world.proj.toLocal(a.lon, a.lat);
        const [bx, by] = world.proj.toLocal(b.lon, b.lat);
        return Math.hypot(ax - lot.x, ay - lot.y) < Math.hypot(bx - lot.x, by - lot.y);
      };
      if (!door || (door.corner && (!lay.corner || nearer(lay.ll, door.ll)))) {
        door = lay;
        spot = s;
      }
      if (!door.corner) break;
    }
    if (!door || !spot) {
      this.host.toast('No way by road from here to a place for food: try another of your homes.', 'bad', 6000);
      return;
    }
    const occ = Math.floor(Math.random() * OCCASIONS.length);
    const food = foodName(spot.food);
    const due = pointsDue(this.store, this.today());
    const best = this.store.best[key];
    const run = !this.host.game.run.over && this.host.game.run.done > 0;
    const where = `your ${home.kind}${home.street ? ` on ${home.street}` : ''}`;
    const lane = laneWords(door.walk, door.corner, 'your');
    const at = door;
    const it = spot;
    this.host.card(
      `${cap(occasion(occ))} at your ${home.kind}`,
      `Friends are coming over tonight, and nobody got the food. Fetch ${food} from ${foodPlace(spot.food)}${spot.invented ? ' around the corner' : ''}: the pink sign, and the arrow shows the way. Then bring ${spot.food === 'shop' ? 'them' : 'it'} to your door before ${spot.food === 'shop' ? 'the drinks get warm' : 'it gets cold'}: the clock starts when you pick ${spot.food === 'shop' ? 'them' : 'it'} up.${lane.card}` +
        (due ? ` A party is worth ${PARTY_POINTS} home points, once a day.` : ` Today’s ${PARTY_POINTS} party points are yours already: this one is for fun.`) +
        (best ? ` Your best: ${clockText(best)} from pickup to door.` : '') +
        (run ? ' Your run of three stops here.' : ''),
      'Let’s go',
      'Not now',
      (yes) => {
        if (!yes || !this.can(home)) return;
        this.begin({ key, where, whose: 'your', kind: home.kind, occasion: occ, spot: it, home: { lat: home.lat, lon: home.lon }, door: at.ll, walk: at.walk, corner: at.corner, sent: null });
      },
      'Party',
    );
  }

  /** A friend's party from a link: the card, then the same run, against their time. The player starts at their home. */
  startSent(s: SentParty): void {
    const whose = s.name ? `${s.name}’s` : 'your friend’s';
    const p: Playing = {
      key: null,
      where: `${whose} place`,
      whose,
      kind: '',
      occasion: s.occasion,
      spot: { food: s.food, invented: s.invented, shop: s.shop, pick: s.pick },
      home: s.home,
      door: s.door,
      walk: s.walk,
      corner: s.corner,
      sent: s,
    };
    const food = foodName(s.food);
    const lane = laneWords(s.walk, s.corner, s.name ? 'their' : 'the');
    this.host.card(
      `${cap(whose)} ${occasion(s.occasion)}`,
      `${s.name || 'Your friend'} has friends over tonight, and ${food} ${s.food === 'shop' ? 'are' : 'is'} still missing. Take a car, fetch ${s.food === 'shop' ? 'them' : 'it'} from ${foodPlace(s.food)} with the pink sign (the arrow shows the way), and bring ${s.food === 'shop' ? 'them' : 'it'} back here before ${s.food === 'shop' ? 'the drinks get warm' : 'it gets cold'}. The clock starts at the pickup.${lane.card}${s.seconds ? ` ${s.by || s.name || 'Your friend'} did it in ${clockText(s.seconds)}.` : ''}`,
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
    const food = p.spot.food === 'shop' ? 'Drinks and snacks are on board: get them' : 'The pizza is on board: get it';
    const lane = laneWords(p.walk, p.corner, p.whose);
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

  private tick(): void {
    const g = this.host.game;
    if (!this.playing) return;
    // gone without an end: another place loaded, or a new run
    if (!g.party) {
      this.drop();
      return;
    }
    if (g.world !== this.markIn) this.markFood();
    // up a narrow lane: where to leave the car, said once as the car gets there
    const p = this.playing;
    if (p.walk && !p.told && g.job?.party && g.car && g.world) {
      const [dx, dy] = g.world.proj.toLocal(p.door.lon, p.door.lat);
      const [x, y] = g.pos();
      if (Math.hypot(dx - x, dy - y) < p.walk + 20) {
        p.told = true;
        this.host.toast(`Leave the car here and walk the last bit: the lane to ${p.where} is too narrow for a car.`, 'info', 6000);
      }
    }
  }

  /**
   * Where the food goes at a door, for the way from its food place: the door itself; up a lane too narrow
   * for a car, the door with the last metres on foot (`walk`), never more than `WALK_MAX`; beyond that, the
   * corner where the car stops (`corner`).
   */
  private lay(world: World, door: [number, number], spot: FoodSpot): { ll: LngLat; walk: number; corner: boolean } {
    const ll = world.proj.toLngLat(door[0], door[1]);
    const f = world.roads.field(door[0], door[1]);
    const [px, py] = world.proj.toLocal(spot.pick.lon, spot.pick.lat);
    const r = f && world.roads.route(f, px, py);
    if (!r) return { ll, walk: 0, corner: false };
    const n = narrowWalk(r.pts, (x, y) => !world.solids.inside(x, y) && !world.solids.push({ x, y }, CAR_FIT));
    if (!n) return { ll, walk: 0, corner: false };
    if (n.walk <= WALK_MAX) return { ll, walk: Math.max(5, Math.round(n.walk / 5) * 5), corner: false };
    return { ll: world.proj.toLngLat(n.stop[0], n.stop[1]), walk: 0, corner: true };
  }

  /** Where the food may be brought to at a home: the lane at its door, else the nearest main road. */
  private doorsOf(world: World, x: number, y: number): Array<{ at: [number, number]; ll: LngLat }> {
    return [world.roads.nearest(x, y, DOOR_NEAR, 'drive'), world.roads.nearest(x, y, DOOR_FAR, 'traffic')].flatMap((n) => {
      if (!n) return [];
      const at = world.roads.point(n.line, n.s);
      return [{ at, ll: world.proj.toLngLat(at[0], at[1]) }];
    });
  }

  /**
   * The food place of a home's party: the one kept for it, while the roads still lead there; else one
   * picked now and kept, so that the home's party run stays the same ("built" once, in the owner's word).
   */
  private foodFor(world: World, key: string, door: [number, number]): FoodSpot | null {
    const f = world.roads.field(door[0], door[1]);
    if (!f) return null;
    const half = world.half - 10;
    const reach = (ll: LngLat): number | null => {
      const [x, y] = world.proj.toLocal(ll.lon, ll.lat);
      if (Math.abs(x) > half || Math.abs(y) > half) return null;
      return world.roads.route(f, x, y, 0)?.metres ?? null;
    };
    const kept = this.store.places[key];
    if (kept && reach(kept.pick) !== null) return kept;
    const [dx, dy] = door;
    const near = world.food
      .map((p) => ({ p, d: Math.hypot(p.x - dx, p.y - dy) }))
      .filter((c) => Math.abs(c.p.x) < half && Math.abs(c.p.y) < half);
    // the ones at a fitting distance first; a few dozen are enough to choose from
    const fit = near.filter((c) => c.d >= LOOK_MIN && c.d <= LOOK_MAX);
    const look = (fit.length ? fit : near).sort((a, b) => Math.abs(a.d - 650) - Math.abs(b.d - 650)).slice(0, LOOK_MOST);
    const cands = look.flatMap(({ p }) => {
      const n = world.roads.nearest(p.x, p.y, 150, 'traffic');
      if (!n) return [];
      const [rx, ry] = world.roads.point(n.line, n.s);
      const metres = world.roads.route(f, rx, ry, 0)?.metres;
      if (metres === undefined || !Number.isFinite(metres)) return [];
      return [{ metres, invented: !!p.invented, food: p.food, shop: world.proj.toLngLat(p.x, p.y), pick: world.proj.toLngLat(rx, ry) }];
    });
    let pick = pickFood(cands);
    // no food place on the map that a road leads to: one made up beside a street at a fitting distance
    for (let i = 0; i < 12 && !pick; i++) {
      const at = world.roads.randomPlace('traffic', dx, dy, i < 8 ? 500 : 250, i < 8 ? 1000 : 1400);
      if (!at) continue;
      const [rx, ry] = world.roads.point(at.line, at.s);
      const metres = world.roads.route(f, rx, ry, 0)?.metres;
      if (metres === undefined || !Number.isFinite(metres)) continue;
      const [hx, hy] = world.roads.heading(at);
      const side = world.roads.lines[at.line].w / 2 + 7;
      pick = { metres, invented: true, food: 'restaurant', shop: world.proj.toLngLat(rx + hy * side, ry - hx * side), pick: world.proj.toLngLat(rx, ry) };
    }
    if (!pick) return null;
    const spot: FoodSpot = { food: pick.food, invented: pick.invented, shop: pick.shop, pick: pick.pick };
    this.store = { ...this.store, places: { ...this.store.places, [key]: spot } };
    storeParties(this.store);
    this.host.save?.();
    return spot;
  }

  /** The food got to the door, or got cold. */
  private ended(done: boolean, seconds: number): void {
    const p = this.playing;
    this.drop();
    if (!p) return;
    const food = foodName(p.spot.food);
    if (!done) {
      this.host.card(
        `${cap(food)} got ${p.spot.food === 'shop' ? 'warm' : 'cold'}`,
        `The clock ran out before ${food} got to ${p.where}. The friends are still waiting: the same place, the same way.`,
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
    if (p.sent) {
      const s = p.sent;
      const them = s.by || s.name || 'your friend';
      const d = seconds - s.seconds;
      const versus = !s.seconds ? '' : Math.abs(d) < 0.5 ? `, just as fast as ${them}` : d < 0 ? `: ${gap(-d)} faster than ${them}` : `. ${cap(them)} was ${gap(d)} faster`;
      const own = this.host.homes()?.mine().homes.length ?? 0;
      text = `${cap(food)} got there in ${t} from the pickup${versus}.${own ? '' : ' A party of your own needs a home of your own: do a couple of deliveries, and you’ll be shown a cheap flat.'}`;
    } else {
      const key = p.key!;
      const before = this.store.best[key];
      const due = pointsDue(this.store, this.today());
      const added = due ? (this.host.homes()?.partyPoints(PARTY_POINTS) ?? 0) : 0;
      // points that did not fit (the most wait already) are not used up: the next party today pays them
      this.store = { ...this.store, paid: added ? this.today() : this.store.paid, best: { ...this.store.best, [key]: before ? Math.min(before, Math.round(seconds)) : Math.round(seconds) } };
      storeParties(this.store);
      this.host.save?.();
      const record = before && seconds < before - 0.5 ? ` Your best yet, ${gap(before - seconds)} faster than before.` : '';
      const points = added ? ` +${added} home points.` : due ? ' Your home points are full: spend some on a home.' : ` Today’s party points are yours already; tomorrow’s party brings ${PARTY_POINTS} more.`;
      text = `${cap(food)} got to ${p.where} in ${t} from the pickup, ${p.spot.food === 'shop' ? 'still cold' : 'still warm'}.${record}${points}`;
    }
    this.finished = {
      own: !p.sent,
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
    };
    this.endCard(p, text);
  }

  /** The end of a party: how it went, and once, softly, an invitation. */
  private endCard(p: Playing, text: string): void {
    const occ = occasion(p.occasion);
    const them = p.sent?.name || 'your friend';
    $('party-title').textContent = p.sent ? `You brought ${foodName(p.spot.food)} to ${p.whose} ${occ}` : `${cap(occ)} can start`;
    $('party-text').textContent = text;
    $('party-ask').textContent = p.sent ? `Let ${them} know you made it?` : `Someone still missing for tonight’s ${occ}?`;
    $('btn-party-send').textContent = p.sent ? `Send ${them} your time` : 'Send them a link';
    $('btn-party-no').textContent = p.sent ? 'No, just keep driving' : 'No, we’re a full house';
    $<HTMLInputElement>('party-name').value = this.host.name();
    $('party-note').textContent = p.sent
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
    }
    // the host's own party carries their name; a friend's time sent back carries the friend's as who set it
    const code = packParty({ ...f, name: f.own ? name : f.name, by: name });
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
