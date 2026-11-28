/**
 * Homes on screen: the offer on the result card after a run, the "for sale" panel when the player
 * stops beside a building, the marks on owned buildings, and the rent waiting on return.
 * The rules and prices are in `game/homes.ts`.
 */

import type { Game } from './game/game';
import type { World } from './game/world';
import { canBuy, dayOf, doorPoint, homesIn, loadHomes, opensAfter, PAINTS, rentFor, saveHomes, type Home, type Homes, type Lot } from './game/homes';
import { FIXER_AFTER, FIXER_MIN, jobLines, loadReno, rentShare, storeReno, UNITS_MAX, UNITS_MIN, wantsJob, WORN, type Reno } from './game/renovation';
import { homePlate, inPlate, loadSaved, payFrom, storeSaved, type Plate } from './game/bank';
import { caughtCost, lessonDue, loadLesson, nearestBank, remindAt, remindDue, REMIND_ARROW_S, REMIND_GAP_S, storeLesson, type Lesson, type LessonNow } from './game/bankMission';
import { dayNumber, eventDue, homeKey, loadEvents, renovateLines, renovationCandidates, storeEvents, thanks, type EventNow, type Events, type HomeEvent, type Stage } from './game/events';
import { after, answer, choiceText, CLOCK_FITS, courtBill, disputeCandidates, fits, kindsFor, LIGHT_LOAD, LOWER_DAYS, lowered, note, officerDone, officerOrder, pickMood, pickupLines, replaceCost, storyLine, tenantsOf, welcome, type Tenants } from './game/dispute';
import { dailyReady, deliveriesFor, earn, pointsFor, POINTS_MAX, loadDaily, loadPoints, storePoints, FLAT_POINTS, HOUSE_POINTS, type Daily } from './game/homePoints';
import { MAX_CASH } from './game/game';
import { serviceIcon } from './game/services';
import { pointInRing } from './geo/polygon';
import { countPlay } from './linkCount';
import { money, T } from './i18n';
import type { Case } from './lang/en';

/**
 * How to get to the menu from a line over the game: with a mouse, the line itself is clicked; on a touch
 * screen the lines take no taps, as the steering pad lies under them, so it is the house button.
 */
const toMenu = () => (document.body.classList.contains('touch') ? T.toMenuTouch : T.toMenuClick);
/** how near a building one has to stop for its panel (m) */
const BESIDE_M = 7;
/** on foot, this near a home's door (its green ring) to go in (m) */
const DOOR_M = 3.5;
/** in the car, stopped this near a door: a word to get out and walk there (m) */
const PARK_NEAR_DOOR_M = 45;
/** seconds inside the tenants' door before the talk's card, while their voices are heard */
const INSIDE_S = 2.2;
/** how near a bank one has to stop: its spot on the road, or the bank itself on foot (m) */
const BANK_ROAD_M = 9;
const BANK_M = 14;
/** how far from the end of a run an offer may lie (m) */
const OFFER_M = 500;
/** seconds of play before the rent is said, so the place's name across the screen is read first */
const RENT_AFTER_S = 3.4;
/** the first this many times, the line on rent says where to find the homes */
const RENT_NOTES = 5;
const NOTES_STORE = '3da-rentnotes';
/** said once to a player with homes: buying now takes home points (new on 23 November 2026) */
const POINTS_NOTE = '3da-pointsnote';
/** seconds of play before it is said: after the place's name and the rent */
const POINTS_NOTE_S = 9;

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

/** "your flat on Lindenstraße", "your house", for the lines about one of the player's homes; `c`: its case in the sentence */
export const homeName = (h: Home, c: Case = 'nom') => T.homeRef(h.kind, h.street, c);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "a flat in a 5-floor building on Lindenstraße" */
function describe(lot: Lot, what: 'flat' | 'house' | 'building'): string {
  return T.describeLot(what, lot.street, lot.floors, !!lot.inHouse, lot.units);
}

export interface HomesHost {
  game: Game;
  /** a line over the game; with `tap`, tapping it does that */
  toast: (text: string, kind?: 'good' | 'bad' | 'info', ms?: number, tap?: () => void) => void;
  /** keep the cash (and say that something changed, for saving online) */
  save: () => void;
  /** the name of the place being played */
  place: () => string;
  /** the first home was just bought (what it is, its rent each day; worn down: no rent until repaired): saving online opens */
  firstHome?: (what: string, rent: string, worn: boolean) => void;
  /** a card over the game that waits for an answer (the mission's); with no `no`, a single button; `later`: a third button, which answers nothing */
  card?: (title: string, text: string, yes: string, no: string, answer: (yes: boolean) => void, kicker?: string, later?: string) => void;
  /** the side menu with the homes (real estate and trophies) */
  openHomes?: () => void;
  /** nothing may give the place away now (a city is being guessed): no way to the list of homes */
  quiet?: () => boolean;
  /** something lies over the game (the menu, the big map, a card): keys do nothing to the panel under it */
  blocked?: () => boolean;
  /** parties at the homes (`partyUi.ts`): whether one can be thrown at a home now, its button, and the card that starts it */
  party?: { can: (home: Home) => boolean; label: (home: Home) => string; tag: () => string; offer: (home: Home) => void };
  /** the story's name for a card, when it is the open chapter's own (`storyUi.ts`): the first home's, the bank's, the tenants' dispute's */
  kicker?: (what: 'home' | 'bank' | 'dispute') => string | undefined;
  /**
   * The story's people (`storyUi.ts`): a note from the tenants or the officer, kept with the messages
   * (`strip`: shown over the game too, else only kept); a line for "The story so far"; the officer's name;
   * the names the story's people already have, which no tenant gets.
   */
  people?: {
    note: (who: 'tenants' | 'shield', from: string, text: string, strip: boolean) => void;
    record: (text: string) => void;
    officer: () => string;
    names: () => string[];
  };
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
  /** the deliveries made when the first flat was last offered: put off ("Later"), it is offered again after the next one */
  private offeredAt = -1;
  /** the notes after the first deliveries, said on this visit */
  private noted = new Set<string>();
  /** where the mission leads: a part of town with worn-down flats, in the square being played */
  private area: { x: number; y: number; rx: number; ry: number; lots: Lot[]; marks: Array<{ remove: () => void }>; here: boolean } | null = null;
  /**
   * The home the arrow points at until the player gets there: the building being repaired (to buy
   * the rest of it, or to paint it), or a home picked from the list of homes.
   */
  private wayTo: Home | null = null;
  /** the point the arrow shows on the way to `wayTo`: kept, so that only this arrow is taken down, never another's */
  private homeGuide: { x: number; y: number } | null = null;
  /** the line on the rent of the day, waiting for the place's name to be read (`RENT_AFTER_S`) */
  private rentLine: (() => string) | null = null;
  private rentLineT = 0;
  /** home points (`game/homePoints.ts`): earned by deliveries, taken by homes */
  private points = loadPoints();
  /** the free home of the day: when it was last taken, and the last day a delivery was made */
  private daily: Daily = loadDaily();
  /** the deliveries counted for points so far */
  private counted = -1;
  /** seconds of play left before the line on home points; null: not to be said */
  private pointsNoteT: number | null = null;
  /** learning to use the bank (`game/bankMission.ts`) */
  private lesson: Lesson = loadLesson(this.saved > 0);
  /** this visit: seconds played, the deliveries before it, the seconds since the last reminder */
  private playedS = 0;
  private deliveredBefore = -1;
  private sinceRemind = REMIND_GAP_S - 60;
  /** seconds left of the arrow to the bank after a reminder */
  private remindArrow = 0;
  /** the way to the nearest bank was asked for (the money box, or the menu): the arrow, until the player is there */
  private bankWay = false;
  /** things that happen at the homes (`game/events.ts`) */
  private events: Events = loadEvents(this.homes.homes.length > 0);
  /** seconds of play when this last put a card up, so that two do not follow at once */
  private cardAtS = -60;
  /** the home whose event the package on board is for */
  private carrying: string | null = null;
  /** the deliveries when the court's order was carried out: the next one brings the new tenants */
  private movingAfter = -1;
  /** the home whose tenants were asked to talk, until the player walks away from its door, so the card comes once a visit */
  private talked: Home | null = null;
  /** the home whose door the player was told to walk to, until they drive off, so it is said once a stop */
  private toldDoor: Home | null = null;
  /** the home the player has just gone in at (`Game.goInside`): its card comes when they are out again */
  private goneIn: Home | null = null;
  /** a home's door, worked out once for the square loaded (`doorPoint`) */
  private doorKept: { world: World; home: Home; at: { x: number; y: number } } | null = null;
  /** the bank the arrow points at, and the point it shows (kept, so the arrow can be told from others') */
  private bankTarget: HomesUi['banks'][number] | null = null;
  private bankGuide: { x: number; y: number } | null = null;
  /** the mission to the bank, said on this visit */
  private lessonSaid = false;

  constructor(private readonly host: HomesHost) {
    host.game.ticks.push((dt) => this.tick(dt));
    host.game.onSpecialTaken = () => this.specialTaken();
    host.game.onSpecialDone = (dented) => this.specialDone(dented);
    host.game.onSpecialLost = (why) => this.specialLost(why);
    // the court's order carried out: the next delivery brings the new tenants
    host.game.events.push((e) => {
      if (e.kind === 'delivered' && host.game.delivered > this.movingAfter) this.moveIn();
    });
    addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() !== 'b' || e.repeat || this.panel.hidden || this.host.blocked?.()) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
      this.panel.querySelector<HTMLButtonElement>('button:not(.swatch):not(.party):not(.talk)')?.click();
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
      this.deliveredBefore = game.delivered;
      this.payRent(true);
      // a player with homes, once: buying now takes home points
      let told = true;
      try {
        told = !!localStorage.getItem(POINTS_NOTE);
      } catch {
        /* private window: nothing kept, so nothing said */
      }
      if (this.homes.homes.length && !told) this.pointsNoteT = POINTS_NOTE_S;
    }
    this.playedS += dt;
    this.sinceRemind += dt;
    if (this.remindArrow > 0) this.remindArrow -= dt;
    // a point for each delivery
    if (this.counted < 0 || game.delivered < this.counted) this.counted = game.delivered;
    if (game.delivered > this.counted) {
      const more = game.delivered - this.counted;
      this.counted = game.delivered;
      // a delivery today: the day's free home is there
      this.daily.played = dayOf(Date.now());
      this.setPoints(earn(this.points, more), true);
    }
    if (this.rentLine !== null) {
      this.rentLineT -= dt;
      if (this.rentLineT <= 0) {
        this.sayRent(this.rentLine());
        this.rentLine = null;
      }
    }
    if (this.pointsNoteT !== null) {
      this.pointsNoteT -= dt;
      if (this.pointsNoteT <= 0 && !game.job && !game.party && !this.host.quiet?.()) {
        this.pointsNoteT = null;
        this.sayPointsNote();
      }
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
    this.bankTick();
    this.eventTick();
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
    if (r && first && wantsJob(r)) {
      this.host.game.special = { at: { lat: first.lat, lon: first.lon }, say: jobLines(r) };
      return;
    }
    // a home with something a package solves: one in the part of town being played first; with none here,
    // the one the stations served last (the game keeps the way to its door a little beyond its part of
    // town: a station across that line would hand its package to another home's name, as an ordinary job)
    const open = this.events.open.flatMap((e) => {
      const h = this.homeOfEvent(e);
      return h && (e.kind === 'renovate' || kindsFor(e.stage ?? 'talk')) ? [{ e, h }] : [];
    });
    const was = this.host.game.special?.at;
    const o = [...open].reverse().find((x) => this.lotOf(x.h)) ?? open.find((x) => was && x.h.lat === was.lat && x.h.lon === was.lon) ?? open.at(-1);
    if (!o) {
      this.host.game.special = null;
      return;
    }
    const { e, h } = o;
    const at = { lat: h.lat, lon: h.lon };
    if (e.kind === 'renovate') {
      this.host.game.special = { at, say: renovateLines(this.nameOf(h, 'acc')) };
      return;
    }
    // a dispute: only the stations its stage takes, and an easier job for the choice that fits
    const stage = e.stage ?? 'talk';
    const fit = fits(e.mood ?? 'broken', stage);
    this.host.game.special = {
      at,
      say: pickupLines(stage, e.mood ?? 'broken', (c) => this.nameOf(h, c), this.host.people?.officer() || T.twoOfficers),
      kinds: kindsFor(stage) ?? undefined,
      ...(fit && stage === 'insist' ? { clock: CLOCK_FITS } : {}),
      ...(fit && stage === 'accept' ? { light: LIGHT_LOAD } : {}),
    };
  }

  /** A home's building in the square being played, if it is in it. */
  private lotOf(home: Home | undefined): Lot | null {
    if (!home) return null;
    for (const [lot, h] of this.owned) if (h === home) return lot;
    return null;
  }

  /** The first home, the building being repaired: its lot in the square being played, if it is in it. */
  private renoLot(): Lot | null {
    return this.lotOf(this.homes.homes[0]);
  }

  /** What the player owns, for the list of homes: the homes, the repairs under way, the savings. */
  mine(): { homes: Home[]; reno: Reno | null; saved: number } {
    return { homes: this.homes.homes, reno: this.reno, saved: this.saved };
  }

  /** The way to a home gives the arrow up to another (the story's way to a station). */
  dropWay(): void {
    if (this.homeGuide && this.host.game.guide === this.homeGuide) this.host.game.guide = null;
    this.wayTo = null;
    this.homeGuide = null;
  }

  /**
   * The way to the worn-down flats of the first-home mission, for the story's "Show the way": 'arrow' when
   * the arrow leads there, 'here' once the player is among them, 'none' where this part of town has none.
   */
  flatsWay(): 'arrow' | 'here' | 'none' {
    const a = this.area;
    if (this.reno?.stage !== 'find' || !a) return 'none';
    // there once, and driven off since: the arrow leads back
    const [px, py] = this.host.game.pos();
    if (a.here && Math.hypot(a.x - px, a.y - py) > 150) a.here = false;
    return a.here ? 'here' : 'arrow';
  }

  /** Where the home town is: the first home's place, which the banks and the story go by. */
  homeTownAt(): { lat: number; lon: number } | null {
    return this.plate ? { lat: this.plate.lat, lon: this.plate.lon } : null;
  }

  /** Whether the square being played is in the home town: the first home's, where the banks are. */
  atHomeTown(): boolean {
    return this.atPlate;
  }

  /** The home town's name, as it was when the first home was bought; '' before there is one. */
  homeTownName(): string {
    return this.plate?.place ?? '';
  }

  /** Whether a home stands in the square being played. */
  isHere(home: Home): boolean {
    return !!this.lotOf(home);
  }

  /** Where a home stands in the square being played, for the big map; null when it is not in it. */
  spotOf(home: Home): { x: number; y: number } | null {
    const lot = this.lotOf(home);
    return lot ? { x: lot.x, y: lot.y } : null;
  }

  /** The arrow points the way to a home in the square being played, until the player gets there. */
  showWay(home: Home): boolean {
    if (!this.lotOf(home)) return false;
    this.wayTo = home;
    // point at once, not at the next look around
    this.lookT = 0;
    return true;
  }

  /** What a home pays on a day one comes back: the first home only the share that is repaired. */
  private rentOf(home: Home): number {
    const rent = home === this.homes.homes[0] ? Math.round(home.rent * rentShare(this.reno)) : home.rent;
    // a lower rent agreed in a dispute, for a week
    return (this.events?.lower?.[homeKey(home)] ?? -1) >= dayNumber(Date.now()) ? lowered(rent) : rent;
  }

  private rentPerVisit(): number {
    return this.homes.homes.reduce((s, h) => s + this.rentOf(h), 0);
  }

  /** What a worn-down flat sells for: what the player had when it was offered, never more than the flat. */
  private fixerPrice(lot: Lot): number {
    const offered = this.reno?.price ?? Math.floor(this.host.game.cash / 10) * 10;
    return Math.max(10, Math.min(lot.price, offered));
  }

  /** A card over the game (`HomesHost.card`), counted for the time between cards (`AFTER_CARD_S`). */
  private card(title: string, text: string, yes: string, no: string, answer: (yes: boolean) => void, kicker?: string, later?: string): void {
    this.cardAtS = this.playedS;
    this.host.card?.(title, text, yes, no, answer, kicker, later);
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
        this.host.toast(T.fixersHere(money(this.fixerPrice(a.lots[0]))), 'info', 9000);
      }
      return;
    }
    if (r?.stage === 'buy' && first) {
      // enough for the rest of the building: say so once, and point the way
      const lot = this.renoLot();
      if (lot && !this.noted.has('rest') && this.budget() >= Math.max(0, lot.whole - first.paid)) {
        this.noted.add('rest');
        this.wayTo = first;
        this.host.toast(T.restAffordable(money(Math.max(0, lot.whole - first.paid))), 'good', 9000);
      }
    }
    // tenants who want to talk: their door shows as a small green ring, and a way asked for leads to it,
    // not to the street in front (which in Paris can be a block away from a house in a courtyard)
    const talking = this.talkingHome();
    const door = talking ? this.doorOf(talking) : null;
    game.visit = door;
    if (this.wayTo && this.wayTo === talking && door) {
      if (!game.job && !game.party) {
        // kept the same, so that the story's arrow can tell it is the home's
        if (!this.homeGuide || this.homeGuide.x !== door.x || this.homeGuide.y !== door.y) this.homeGuide = { ...door };
        game.guide = this.homeGuide;
      }
    } else if (this.wayTo) {
      const lot = this.lotOf(this.wayTo);
      const n = lot && world.roads.nearest(lot.x, lot.y, 200, 'traffic');
      const [px, py] = game.pos();
      // on a job or a party the arrow is theirs: the way to the home waits
      if (!lot || !n || Math.hypot(lot.x - px, lot.y - py) < 40 || game.job || game.party) {
        if (lot && Math.hypot(lot.x - px, lot.y - py) < 40) this.wayTo = null;
        if (game.guide && game.guide === this.homeGuide && !game.job && !game.party) game.guide = null;
      } else {
        const [rx, ry] = world.roads.point(n.line, n.s);
        this.homeGuide = { x: rx, y: ry };
        game.guide = this.homeGuide;
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
      this.say(T.oneMoreForFlat);
    }
    if (d < FIXER_AFTER || game.cash < FIXER_MIN || this.offeredAt === d || !this.host.card) return;
    if (!game.run.over) {
      if (!this.noted.has('run')) {
        this.noted.add('run');
        this.say(T.enoughForFlat);
      }
      return;
    }
    if (game.job || game.party) return;
    this.offeredAt = d;
    const price = Math.floor(game.cash / 10) * 10;
    this.card(
      T.firstHomeMission,
      T.firstHomeMissionText(money(game.cash), money(price)),
      T.showPlace,
      T.later,
      (yes) => {
        if (!yes) return;
        this.setReno({ stage: 'find', price });
        this.missionTick();
      },
      this.host.kicker?.('home'),
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
    const sp = this.host.game.special;
    const h = !wantsJob(r) && sp ? this.events.open.map((e) => this.homeOfEvent(e)).find((o) => o && o.lat === sp.at.lat && o.lon === sp.at.lon) : undefined;
    this.carrying = h ? homeKey(h) : null;
    // the plan of the first-home mission, the first time a package for its building is taken
    if (this.carrying || !r || !wantsJob(r) || r.told || !this.host.card) return;
    this.setReno({ ...r, told: true });
    const others = Math.max(1, (r.units ?? 2) - 1);
    this.card(
      T.repairMission,
      T.repairMissionText(r.stage === 'flat', others),
      T.letsGo,
      '',
      () => undefined,
    );
  }

  /** A package reached the building: the next step. `dented`: the car took harm on the way. */
  private specialDone(dented = false): void {
    const r = this.reno;
    const first = this.homes.homes[0];
    if (this.carrying) {
      const key = this.carrying;
      this.carrying = null;
      this.eventDone(key, dented);
      return;
    }
    if (!r || !first) return;
    const units = r.units ?? 2;
    if (r.stage === 'flat') {
      this.setReno({ ...r, stage: 'buy' });
      const lot = this.renoLot();
      const rest = lot ? T.flatRepairedRest(units - 1, money(Math.max(0, lot.whole - first.paid))) : '';
      this.say(T.flatRepaired(money(first.rent), rest, !!this.host.party), 'good', 10000);
    } else if (r.stage === 'rest') {
      const fixed = (r.fixed ?? 0) + 1;
      if (fixed >= units - 1) {
        this.setReno({ ...r, stage: 'paint', fixed });
        this.say(T.allFlatsRepaired, 'good', 10000);
      } else {
        this.setReno({ ...r, fixed });
        this.say(T.flatNRepaired(fixed + 1, units, money(first.rent / units)), 'good', 9000);
      }
    } else if (r.stage === 'paint') {
      this.setReno({ stage: 'done' });
      this.setEvents({ ...this.events, renovated: { ...this.events.renovated, [homeKey(first)]: dayNumber(Date.now()) } });
      const lot = this.renoLot();
      if (lot) this.world?.model.paintBuilding(lot.poly, first.colour ?? null);
      this.wayTo = first;
      this.card(
        T.buildingDone,
        T.buildingDoneText(units, money(first.rent)),
        T.goOn,
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
    this.guideBank(false);
    this.showBanks();
    // a way to the bank asked for ends where there is none: another town, or a part of town without one
    if (!this.bankHere()) this.bankWay = false;
    // the mission's area is picked again in the new square
    this.area = null;
    this.host.game.guide = null;
    // the way to a home is not kept when the game goes on to another town
    if (this.wayTo) {
      const [x, y] = world.proj.toLocal(this.wayTo.lon, this.wayTo.lat);
      if (Math.hypot(x, y) > 5000) this.wayTo = null;
    }
    // painted homes; the building being repaired still has its worn-down walls
    const first = this.homes.homes[0];
    const worn = this.reno && this.reno.stage !== 'done';
    for (const [lot, home] of this.owned) {
      if ((worn && home === first) || this.renovating(home)) world.model.paintBuilding(lot.poly, WORN);
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
    this.remindArrow = 0;
    this.sinceRemind = 0;
    this.bankWay = false;
    this.guideBank(false);
    if (this.lesson.stage !== 'done') {
      const was = this.lesson.stage;
      this.setLesson({ stage: 'done', rent: this.lesson.rent });
      // the mission to the bank ends with a card; paid in without being asked, a line is enough
      if (was === 'go' && this.host.card) {
        // the panel first: once the card is up, the game waits and the panel is not drawn again
        this.shown = '';
        this.look();
        this.card(
          T.moneySafe,
          T.moneySafeText(money(amount), money(this.saved)),
          T.keepDriving,
          '',
          () => undefined,
          T.kickerKnow,
        );
        return amount;
      }
    }
    this.host.toast(T.paidIn(money(amount), money(this.saved)), 'good', 5000);
    this.shown = '';
    this.look();
    return amount;
  }

  // ------------------------------------------------------------ learning to use the bank

  private setLesson(l: Lesson): void {
    this.lesson = l;
    storeLesson(l);
    this.host.save();
  }

  /** The square is in the home plate, and has a bank. */
  private bankHere(): boolean {
    return this.atPlate && this.banks.length > 0;
  }

  /** The arrow to the nearest bank, on or off. It gives way to the way to a home, and to any other arrow. */
  private guideBank(on: boolean): void {
    const { game } = this.host;
    if (!on) {
      if (this.bankGuide && game.guide === this.bankGuide) game.guide = null;
      this.bankGuide = null;
      this.bankTarget = null;
      return;
    }
    // a way to a home in this square goes first; one to a home elsewhere shows no arrow, so it does not
    if ((this.wayTo && this.lotOf(this.wayTo)) || (game.guide && game.guide !== this.bankGuide)) return;
    if (!this.bankTarget || !this.banks.includes(this.bankTarget)) {
      const [px, py] = game.pos();
      this.bankTarget = nearestBank(this.banks, px, py);
      this.bankGuide = this.bankTarget && { x: this.bankTarget.rx, y: this.bankTarget.ry };
    }
    if (this.bankGuide) game.guide = this.bankGuide;
  }

  /**
   * The way to the nearest bank, asked for by the player: the arrow shows it until they are there, like a
   * mission's, though it is none (the owner, 23 November). Asked again, it is turned off (`toggle`; the
   * story's "Show the way" only ever turns it on). Outside the home town, it says where the banks are.
   */
  wayToBank(toggle = true): void {
    const { toast } = this.host;
    if (!this.plate) {
      toast(T.noBankYet, 'info', 6000);
      return;
    }
    if (this.host.quiet?.() || !this.bankHere()) {
      toast(
        this.host.quiet?.()
          ? T.banksHomeOnly
          : this.atPlate
            ? T.noBankHere
            : T.banksIn(this.plate.place || T.yourHomeTown),
        'info',
        6000,
      );
      return;
    }
    // already at a bank: nothing to point to
    {
      const [px, py] = this.host.game.pos();
      const at = nearestBank(this.banks, px, py);
      if (at && Math.hypot(at.rx - px, at.ry - py) < BANK_ROAD_M * 2) {
        toast(T.atBank, 'info', 4000);
        return;
      }
    }
    // on the way to pay in for the first time, the arrow stays until the cash is in; it is turned off only when it shows
    if (toggle && this.bankWay && this.bankArrow() && this.lesson.stage !== 'go') {
      this.bankWay = false;
      this.remindArrow = 0;
      this.guideBank(false);
      toast(T.bankWayOff, 'info', 3000);
      return;
    }
    // asked for: it goes before the way to a home, whose arrow goes too
    if (this.wayTo && this.host.game.guide && this.host.game.guide !== this.bankGuide) this.host.game.guide = null;
    this.wayTo = null;
    this.bankWay = true;
    this.bankTarget = null;
    this.guideBank(true);
    const { game } = this.host;
    toast(game.party ? T.bankAfterParty : game.job ? T.bankAfterJob : this.bankArrow() ? T.bankArrow : T.bankWhenFree, 'info', 5000);
  }

  /** Whether the player has banks: a home, and so a home town. */
  hasBanks(): boolean {
    return !!this.plate;
  }

  /** Whether the arrow points to a bank now (another way, to a home, can have it). */
  private bankArrow(): boolean {
    return !!this.bankGuide && this.host.game.guide === this.bankGuide;
  }

  private bankTick(): void {
    const { game } = this.host;
    if (!this.world || !this.homes.homes.length) return;
    // a city being guessed: the mission's card and the reminders would name or hint at the home town
    if (this.host.quiet?.()) {
      this.bankWay = false;
      this.guideBank(false);
      return;
    }
    // the way asked for ends at the bank
    if (this.bankWay && this.bankTarget) {
      const [px, py] = game.pos();
      if (Math.hypot(this.bankTarget.rx - px, this.bankTarget.ry - py) < BANK_ROAD_M * 2) this.bankWay = false;
    }
    const n: LessonNow = {
      today: dayOf(Date.now()),
      bankHere: this.bankHere(),
      cash: game.cash,
      deliveredHere: game.delivered - Math.max(0, this.deliveredBefore),
      playedS: this.playedS,
      busy: !!game.job || !!game.party || this.rentLine !== null,
    };
    const l = this.lesson;
    if (l.stage === 'go') {
      if (!n.bankHere) return;
      // the cash went on something else: ask again another day
      if (game.cash < 1) {
        this.guideBank(false);
        this.setLesson({ stage: 'offer', later: n.today, rent: true });
        return;
      }
      this.guideBank(true);
      if (!this.lessonSaid) {
        this.lessonSaid = true;
        this.host.toast(this.bankArrow() ? T.toBankArrow : T.toBank, 'info', 7000);
      }
      return;
    }
    if (this.host.card && lessonDue(l, n)) {
      this.lessonSaid = true;
      this.cardAtS = this.playedS;
      const place = this.plate?.place || T.yourHomeTown;
      this.card(
        T.keepCashSafe,
        T.keepCashSafeText(money(game.cash), money(caughtCost(game.cash)), place),
        T.showBank,
        T.later,
        (yes) => {
          if (!yes) {
            this.setLesson({ stage: 'offer', later: n.today, rent: true });
            return;
          }
          this.setLesson({ stage: 'go', rent: true });
          this.guideBank(true);
        },
        this.host.kicker?.('bank') ?? T.kickerKnow,
      );
      return;
    }
    if (remindDue(l, n, this.rentPerVisit(), this.sinceRemind)) {
      this.sinceRemind = 0;
      this.remindArrow = REMIND_ARROW_S;
      this.guideBank(true);
      this.host.toast(T.cashReminder(money(game.cash), money(caughtCost(game.cash)), this.bankArrow()), 'info', 9000);
    }
    // the reminder's arrow, for a while; a package on board has its own
    this.guideBank(this.bankWay || (this.remindArrow > 0 && n.bankHere && game.cash >= remindAt(this.rentPerVisit()) / 2));
  }

  /** Pay the rent of a new day, once. On arrival, say so. `covered`: a card lies over the lines, so no way to the menu in them. */
  payRent(arriving = false, covered = false): number {
    const today = dayOf(Date.now());
    if (!this.homes.homes.length || today === this.homes.paidDay) return 0;
    // the day counts as paid even when nothing was due (a worn-down flat), so a repair pays from tomorrow
    this.homes.paidDay = today;
    saveHomes(this.homes);
    const due = this.rentPerVisit();
    if (due < 1) return 0;
    // the rent of a home with something to solve waits at it
    const held = this.holdRent();
    const before = this.host.game.cash;
    this.host.game.cash += due - held;
    this.host.save();
    // at the most cash one can hold, the rent is not added
    const got = this.host.game.cash - before;
    if (got < 1 && !held) return 0;
    if (arriving && got >= 1) countPlay('rent');
    // rent came in on a return: the mission to the bank may come
    if (arriving && got >= 1 && !this.lesson.rent) this.setLesson({ ...this.lesson, rent: true });
    // the homes that paid: those with nothing open
    const paying = this.homes.homes.length - this.events.open.filter((e) => this.homeOfEvent(e)).length;
    // worded when it is said: a city being guessed by then hides the street of a home
    const text = () => T.rentLine(arriving, paying, got >= 1 ? money(got) : null, held ? this.heldLine(held) : '');
    if (arriving) {
      // once the place's name has been read
      this.rentLine = text;
      this.rentLineT = RENT_AFTER_S;
    } else if (covered) this.host.toast(text(), 'good', 9000);
    else this.sayRent(text());
    return got;
  }

  /** The line on rent: the first few times, with the way to the list of homes. */
  private sayRent(text: string): void {
    let n = 0;
    try {
      n = Number(localStorage.getItem(NOTES_STORE)) || 0;
    } catch {
      /* private window: the note every time */
    }
    const open = this.host.openHomes;
    if (n >= RENT_NOTES || !open || this.host.quiet?.()) {
      this.host.toast(text, 'good', 9000);
      return;
    }
    try {
      localStorage.setItem(NOTES_STORE, String(n + 1));
    } catch {
      /* as above */
    }
    this.host.toast(T.seeHomes(text, toMenu()), 'good', 12000, open);
  }

  // ------------------------------------------------------------ things that happen at the homes

  private setEvents(e: Events): void {
    this.events = e;
    storeEvents(e);
    this.host.save();
    this.shown = '';
  }

  /** "your flat on Königstraße"; while a city is guessed, "your flat", as the street would give it away. */
  private nameOf(h: Home, c: Case = 'nom'): string {
    return this.host.quiet?.() ? T.homeRef(h.kind, '', c) : homeName(h, c);
  }

  /** The event open at a home, if any. */
  private eventOf(home: Home): HomeEvent | undefined {
    const key = homeKey(home);
    return this.events.open.find((e) => e.home === key);
  }

  /** Whether a home waits for renovating: its walls are worn meanwhile. */
  private renovating(home: Home): boolean {
    return this.eventOf(home)?.kind === 'renovate';
  }

  private homeOfEvent(e: HomeEvent): Home | undefined {
    return this.homes.homes.find((h) => homeKey(h) === e.home);
  }

  /** For the list of homes: what is open at a home, and the rent waiting there. */
  eventNote(home: Home): string {
    const e = this.eventOf(home);
    if (!e) return '';
    const so = e.waiting ? T.soFar(money(e.waiting)) : '';
    if (e.kind === 'renovate') return T.needsRenovating(so);
    return T.tenantsNote(e.stage === 'moving', so, T.disputeNote[e.stage ?? 'talk']);
  }

  /** A day's rent of the homes with nothing open: what comes in as cash each day now. */
  rentPaying(): number {
    return this.homes.homes.reduce((s, h) => s + (this.eventOf(h) ? 0 : this.rentOf(h)), 0);
  }

  /** A day's rent of the homes with something open goes to wait at them. Returns how much. */
  private holdRent(): number {
    let held = 0;
    for (const e of this.events.open) {
      const h = this.homeOfEvent(e);
      if (!h) continue;
      const r = this.rentOf(h);
      e.waiting += r;
      held += r;
    }
    if (held) this.setEvents({ ...this.events });
    return held;
  }

  /** " $384 waits at your flat on Königstraße until it is renovated." */
  private heldLine(held: number): string {
    const open = this.events.open.filter((e) => this.homeOfEvent(e));
    const homes = open.map((e) => this.homeOfEvent(e)!);
    const where = homes.length === 1 ? this.nameOf(homes[0], 'dat') : T.nOfYourHomes(homes.length, 'dat');
    const done = open.every((e) => e.kind === 'renovate') ? 'renovate' : open.every((e) => e.kind === 'dispute') ? 'dispute' : 'mixed';
    return T.heldLine(money(held), where, homes.length !== 1, done);
  }

  /** Whether something may happen at a home now, and if so, it does: for now, a home needs renovating. */
  private eventTick(): void {
    const { game } = this.host;
    if (!this.world || !this.homes.homes.length || !this.host.card) return;
    if (this.host.quiet?.() || this.host.blocked?.()) return;
    const n: EventNow = {
      today: dayOf(Date.now()),
      playedS: this.playedS,
      deliveredHere: game.delivered - Math.max(0, this.deliveredBefore),
      sinceCardS: this.playedS - this.cardAtS,
      // the first-home mission has the stations' packages while it wants one
      busy: !!game.job || !!game.party || !!game.find || this.rentLine !== null || wantsJob(this.reno),
    };
    if (!eventDue(this.events, n)) return;
    // one thing at a time in a part of town: the stations' packages go to one home, and a dispute takes only one kind
    if (this.events.open.some((e) => this.lotOf(this.homeOfEvent(e)))) return;
    const today = dayNumber(Date.now());
    const can = renovationCandidates(this.homes.homes, this.events, today, (h) => !!this.lotOf(h));
    // the tenants' dispute: once the story's chapter 8 has settled one, it comes as an event too
    const argue = this.events.settled > 0 ? this.disputeCandidates(today) : [];
    if (!can.length && !argue.length) return;
    if (argue.length && (!can.length || Math.random() < 0.5)) {
      this.beginDispute(argue[Math.floor(Math.random() * argue.length)], false);
      return;
    }
    const h = can[Math.floor(Math.random() * can.length)];
    this.setEvents({ ...this.events, open: [...this.events.open, { home: homeKey(h), kind: 'renovate', began: n.today, waiting: 0 }], last: n.today });
    const lot = this.lotOf(h);
    if (lot) this.world.model.paintBuilding(lot.poly, WORN);
    this.syncSpecial();
    this.cardAtS = this.playedS;
    this.card(
      T.needsRenovatingTitle(h.kind),
      T.needsRenovatingText(homeName(h, 'gen'), money(this.rentOf(h)), game.run.over),
      T.gotIt,
      '',
      () => undefined,
    );
  }

  /**
   * Money in: as cash, and at the most cash one can hold, the rest to the bank, as far as it holds. Says
   * where it went, for the line that tells it.
   */
  private credit(amount: number): string {
    const before = this.host.game.cash;
    this.host.game.cash += amount;
    const got = this.host.game.cash - before;
    const banked = Math.min(amount - got, MAX_CASH - this.saved);
    if (banked > 0) {
      this.saved += banked;
      storeSaved(this.saved);
    }
    this.host.save();
    const lost = Math.max(0, amount - got - Math.max(0, banked));
    return T.credited(banked > 0 ? money(banked) : null, lost > 0 ? money(lost) : null);
  }

  /** Money paid to the player by a scene of the story: as cash, the rest to the bank at the most cash one can hold. */
  payOut(amount: number): void {
    const extra = this.credit(amount);
    if (extra) this.host.toast(extra.trim(), 'info', 7000);
  }

  /** A bill: from the cash first, then, in the home town, the bank; never below nothing. Returns what was paid. */
  private charge(amount: number): number {
    const game = this.host.game;
    const cash = Math.min(Math.max(0, Math.floor(game.cash)), amount);
    game.cash -= cash;
    // the bank pays only where it can be used: in the home town
    const bank = this.atPlate ? Math.min(this.saved, amount - cash) : 0;
    if (bank > 0) {
      this.saved -= bank;
      storeSaved(this.saved);
    }
    this.host.save();
    return cash + bank;
  }

  /** A package reached a home with something to solve: it is solved, and the rent that waited is paid. */
  private eventDone(key: string, dented = false): void {
    const e = this.events.open.find((o) => o.home === key);
    const h = e && this.homeOfEvent(e);
    if (!e || !h) return;
    if (e.kind === 'dispute') {
      this.disputeStep(e, h, (e.stage ?? 'talk') === 'accept' ? !dented : true);
      return;
    }
    const tip = thanks(this.rentOf(h));
    const before = this.host.game.cash;
    this.host.game.cash += e.waiting + tip;
    const got = this.host.game.cash - before;
    // at the most cash one can hold, the rest goes to the bank, as far as it holds
    const banked = Math.min(e.waiting + tip - got, MAX_CASH - this.saved);
    if (banked > 0) {
      this.saved += banked;
      storeSaved(this.saved);
    }
    this.host.save();
    this.setEvents({ ...this.events, open: this.events.open.filter((o) => o !== e), renovated: { ...this.events.renovated, [key]: dayNumber(Date.now()) } });
    const lot = this.lotOf(h);
    if (lot) this.world?.model.paintBuilding(lot.poly, h.colour ?? null);
    this.syncSpecial();
    const lost = Math.max(0, e.waiting + tip - got - Math.max(0, banked));
    const extra = T.credited(banked > 0 ? money(banked) : null, lost > 0 ? money(lost) : null);
    this.say(T.renovated(this.nameOf(h), e.waiting ? money(e.waiting) : null, money(tip), extra), 'good', 10000);
  }

  // ------------------------------------------------------------ the tenants' dispute (`game/dispute.ts`)

  /** The home here whose tenants wait to talk, if there is one. */
  private talkingHome(): Home | null {
    const e = this.events.open.find((o) => o.kind === 'dispute' && (o.stage ?? 'talk') === 'talk' && this.lotOf(this.homeOfEvent(o)));
    return (e && this.homeOfEvent(e)) || null;
  }

  /** Where one walks in to a home: its door (`doorPoint`), from the street the way to it leads to. */
  private doorOf(h: Home): { x: number; y: number } | null {
    const world = this.world;
    const lot = this.lotOf(h);
    if (!world || !lot) return null;
    const kept = this.doorKept;
    if (kept && kept.world === world && kept.home === h) return kept.at;
    const n = world.roads.nearest(lot.x, lot.y, 200, 'traffic');
    if (!n) return null;
    const [x, y] = doorPoint(lot.poly.outer, world.roads.point(n.line, n.s), (fx, fy) => world.free(fx, fy, 0.4));
    this.doorKept = { world, home: h, at: { x, y } };
    return this.doorKept.at;
  }

  /**
   * The tenants talk to the player who has got out and walked in: on foot at their door (the green ring) or
   * beside their building. In the car, stopped near it, a word to get out; the card comes once a visit.
   */
  private doorTick(): void {
    const { game } = this.host;
    const h = this.talkingHome();
    const door = h && this.doorOf(h);
    const lot = h && this.lotOf(h);
    if (!h || !door || !lot) {
      this.talked = this.toldDoor = null;
      return;
    }
    // in through the door: their voices, then out again where one went in, and the choice
    if (this.goneIn) {
      if (game.inside) return;
      const was = this.goneIn;
      this.goneIn = null;
      if (was === h) {
        game.onSound('door');
        this.talk(h);
        return;
      }
    }
    const [px, py] = game.pos();
    const toDoor = Math.hypot(door.x - px, door.y - py);
    const ready = !!this.host.card && !this.host.blocked?.() && !this.host.quiet?.() && !game.job && !game.party && !game.find;
    if (game.car) {
      this.talked = null;
      const near = toDoor < PARK_NEAR_DOOR_M || distanceTo(lot, px, py) < BESIDE_M;
      if (!near || game.speed() >= 1.2) {
        if (game.speed() >= 1.2) this.toldDoor = null;
        return;
      }
      if (this.toldDoor !== h && ready) {
        this.toldDoor = h;
        this.host.toast(T.tenantsGetOut, 'info', 7000);
      }
      return;
    }
    const at = toDoor < DOOR_M || distanceTo(lot, px, py) < BESIDE_M;
    if (!at) {
      if (toDoor > DOOR_M * 3) this.talked = null;
      return;
    }
    if (this.talked === h || !ready) return;
    this.talked = h;
    this.goneIn = h;
    game.goInside(INSIDE_S);
    game.onSound('door');
    // the voices behind the door: cross over the cold flat, worried over the money
    game.onSound(this.eventOf(h)?.mood === 'tight' ? 'mumbleSad' : 'mumbleAngry');
  }

  /** A home's tenants: the same until the court's order brings new ones. */
  private tenantsAt(h: Home): Tenants {
    const key = homeKey(h);
    return tenantsOf({ key, lat: h.lat, lon: h.lon }, this.events.moved[key] ?? 0, this.host.people?.names() ?? []);
  }

  /** "Lena and Max · your flat on Königstraße": who a tenants' note is from. */
  private tenantsFrom(h: Home, t = this.tenantsAt(h)): string {
    return `${t.names} · ${this.nameOf(h)}`;
  }

  /** The homes where a dispute may begin now, as an event: in this part of town, with nothing open, bought a while ago, none there lately. */
  private disputeCandidates(today: number): Home[] {
    const open = new Set(this.events.open.map((e) => e.home));
    const homes = this.homes.homes.map((h) => ({ h, at: h.at, key: homeKey(h) }));
    return disputeCandidates(homes, open, this.events.disputed, today, (x) => !!this.lotOf(x.h)).map((x) => x.h);
  }

  /** The dispute open now, for the story: the chapter's first. */
  dispute(): { stage: Stage; home: Home; chapter: boolean; here: boolean } | null {
    const all = this.events.open.filter((e) => e.kind === 'dispute' && this.homeOfEvent(e));
    const e = all.find((o) => o.chapter) ?? all[0];
    if (!e) return null;
    const home = this.homeOfEvent(e)!;
    return { stage: e.stage ?? 'talk', home, chapter: !!e.chapter, here: !!this.lotOf(home) };
  }

  /** A home in this part of town that waits to be renovated: the story's dispute begins only once it is. */
  renovatingHere(): Home | null {
    return this.homes.homes.find((h) => this.lotOf(h) && this.renovating(h)) ?? null;
  }

  /** Disputes settled, in all: the story's chapter 8 is done with the first. */
  settled(): number {
    return this.events.settled;
  }

  /** Whether a court's order has brought new tenants to one of the homes: the story's last line says so. */
  movedOut(): boolean {
    return Object.values(this.events.moved).some((n) => n > 0);
  }

  /**
   * The story's chapter 8 asks for its dispute: it begins at a home in the part of town being played, a
   * whole building first, when nothing else is on. Returns whether it began.
   */
  startDispute(): boolean {
    const { game } = this.host;
    if (!this.world || !this.host.card || this.host.quiet?.() || this.host.blocked?.()) return false;
    if (game.job || game.party || game.find || !game.run.over || this.rentLine !== null || wantsJob(this.reno)) return false;
    if (this.events.open.some((e) => e.kind === 'dispute' && e.chapter) || this.playedS - this.cardAtS < 8) return false;
    // one thing at a time in a part of town: a renovation open here is done first
    if (this.events.open.some((e) => this.lotOf(this.homeOfEvent(e)))) return false;
    const here = this.homes.homes.filter((h) => this.lotOf(h));
    const h = here.find((x) => x.kind === 'building') ?? here.find((x) => x.kind === 'house') ?? here[0];
    if (!h) return false;
    this.beginDispute(h, true);
    return true;
  }

  /** The tenants stop paying and write: their rent waits at the building, and the way leads there. */
  private beginDispute(h: Home, chapter: boolean): void {
    const today = dayOf(Date.now());
    const key = homeKey(h);
    const mood = pickMood();
    this.setEvents({
      ...this.events,
      open: [...this.events.open, { home: key, kind: 'dispute', began: today, waiting: 0, mood, stage: 'talk', ...(chapter ? { chapter: true } : {}) }],
      last: today,
      disputed: { ...this.events.disputed, [key]: dayNumber(Date.now()) },
    });
    this.syncSpecial();
    const t = this.tenantsAt(h);
    const words = note(mood, t, h.kind);
    // the card says it: the note is kept with the messages
    this.host.people?.note('tenants', this.tenantsFrom(h, t), words, false);
    this.card(
      T.noteTitle,
      T.noteText(words, t.names, t.what, this.nameOf(h, 'dat'), money(this.rentOf(h))),
      T.showWay,
      T.later,
      (yes) => {
        if (yes) this.showWay(h);
      },
      this.host.kicker?.('dispute') ?? T.yourTenants,
    );
  }

  /** Stopped beside a home whose tenants want to talk: their words, and the choice. */
  private talk(h: Home): void {
    const e = this.eventOf(h);
    if (!e || e.kind !== 'dispute' || (e.stage ?? 'talk') !== 'talk') return;
    const t = this.tenantsAt(h);
    const mood = e.mood ?? 'broken';
    this.card(
      T.talkTitle,
      choiceText(mood, t, h.kind),
      T.insistAll,
      T.acceptPart,
      (insist) => this.choose(h, insist ? 'insist' : 'accept'),
      this.host.kicker?.('dispute') ?? T.yourTenants,
      T.notNow,
    );
  }

  /** The choice is made: the job it asks for, from the stations whose rings now flash green. */
  private choose(h: Home, stage: 'insist' | 'accept'): void {
    const e = this.eventOf(h);
    if (!e || e.kind !== 'dispute' || (e.stage ?? 'talk') !== 'talk') return;
    this.setEvents({ ...this.events, open: this.events.open.map((o) => (o === e ? { ...o, stage } : o)) });
    // the way to their door is done: the stations' rings are next
    if (this.wayTo === h) this.dropWay();
    this.syncSpecial();
    const fit = fits(e.mood ?? 'broken', stage);
    const when = T.ringsGreen(this.host.game.run.over);
    this.say(
      stage === 'insist' ? T.choseInsist(when, fit) : T.choseAccept(h.kind !== 'house', when, fit),
      'info',
      9000,
    );
  }

  /**
   * A dispute's package arrived (`ok`: in time and, for the load, with no new dent), or did not: what follows.
   * `late`: it did not because the clock ran out, not because it was lost on the way.
   */
  private disputeStep(e: HomeEvent, h: Home, ok: boolean, late = true): void {
    const stage = e.stage ?? 'talk';
    const next = after(stage, ok);
    const t = this.tenantsAt(h);
    const from = this.tenantsFrom(h, t);
    const kicker = this.host.kicker?.('dispute') ?? T.yourTenants;
    const said = answer(stage, ok, e.mood ?? 'broken', h.kind);
    if (said) this.host.people?.note('tenants', from, said, true);
    const line = storyLine(stage, ok, h.street, late);
    if (line) this.host.people?.record(line);
    if (next === 'settled') {
      this.settle(e, h, stage, ok);
      return;
    }
    const rent = this.rentOf(h);
    if (stage === 'court' && next === 'moving') {
      // carried out: the bill now, from the rent that waited first; the new tenants with the next delivery
      this.movingAfter = this.host.game.delivered;
      const bill = courtBill(rent);
      const fromRent = Math.min(e.waiting, bill);
      const paid = fromRent + this.charge(bill - fromRent);
      this.setEvents({ ...this.events, open: this.events.open.map((o) => (o === e ? { ...o, stage: next, waiting: o.waiting - fromRent } : o)) });
      this.syncSpecial();
      this.host.people?.note('shield', '', officerDone(), true);
      const how = fromRent >= bill ? 'rent' : fromRent > 0 ? 'both' : 'money';
      this.say(T.courtDone(t.names, this.nameOf(h, 'dat'), money(bill), how, paid < bill ? money(bill - paid) : null), 'info', 11000);
      return;
    }
    this.setEvents({ ...this.events, open: this.events.open.map((o) => (o === e ? { ...o, stage: next } : o)) });
    this.syncSpecial();
    if (next === 'court' && stage === 'insist') {
      const officer = this.host.people?.officer() || null;
      this.host.people?.note('shield', '', officerOrder(h.kind), true);
      this.card(
        T.courtTitle,
        T.courtText(t.names, this.nameOf(h, 'dat'), officer, money(courtBill(rent))),
        T.gotIt,
        '',
        () => undefined,
        kicker,
      );
      return;
    }
    if (next === 'replace' && stage === 'accept') {
      this.card(
        T.boilerTitle,
        T.boilerText(this.nameOf(h, 'dat'), money(replaceCost(rent)), T.ringsGreen(this.host.game.run.over)),
        T.gotIt,
        '',
        () => undefined,
        kicker,
      );
      return;
    }
    // the court's order or the new boiler, not there: they wait
    if (stage === 'court') this.say(T.officersWait, 'info', 7000);
    else if (stage === 'replace') this.say(T.boilerWaits(this.nameOf(h, 'acc')), 'info', 7000);
  }

  /** A package for a home with something to solve did not get there. A dispute's choice turns on it; anything else waits. */
  private specialLost(why: 'late' | 'caught' | 'offence' | 'dropped'): void {
    const key = this.carrying;
    this.carrying = null;
    const e = key ? this.events.open.find((o) => o.home === key) : undefined;
    const h = e && this.homeOfEvent(e);
    if (!e || !h || e.kind !== 'dispute') return;
    // put down by a new run or another place: nothing went wrong on the way, it can be fetched again
    if (why === 'dropped') return;
    this.disputeStep(e, h, false, why === 'late');
  }

  /** The dispute is settled: the rent that waited, with the tip or the cost of a new boiler; the lower rent agreed. */
  private settle(e: HomeEvent, h: Home, stage: Stage, ok: boolean): void {
    const key = homeKey(h);
    const rent = this.rentOf(h);
    const tip = stage === 'insist' ? thanks(rent) : 0;
    const cost = stage === 'replace' ? replaceCost(rent) : 0;
    const agreed = stage === 'accept' || stage === 'replace';
    const today = dayNumber(Date.now());
    this.setEvents({
      ...this.events,
      open: this.events.open.filter((o) => o !== e),
      settled: this.events.settled + 1,
      // the gap before the next dispute there counts from today, and nothing new begins today
      disputed: { ...this.events.disputed, [key]: today },
      last: dayOf(Date.now()),
      ...(agreed ? { lower: { ...this.events.lower, [key]: today + LOWER_DAYS } } : {}),
      // the tenants it went well with come to the next party there
      ...(ok && stage !== 'replace' ? { glad: [...this.events.glad.filter((g) => g !== key), key] } : {}),
    });
    this.syncSpecial();
    const net = e.waiting + tip - cost;
    const extra = net > 0 ? this.credit(net) : '';
    const paid = net < 0 ? this.charge(-net) : 0;
    const waited = e.waiting ? money(e.waiting) : null;
    const where = cap(this.nameOf(h));
    let text: string;
    if (stage === 'insist') text = T.settledInsist(where, waited, money(tip));
    else if (stage === 'accept') text = T.settledAccept(where, waited, money(this.rentOf(h)));
    else text = T.settledReplace(where, money(cost), waited, paid ? money(paid) : null);
    this.say(text + extra, 'good', 11000);
  }

  /** The new tenants move in, with the delivery after the court's order: the rent that waited is paid. */
  private moveIn(): void {
    const e = this.events.open.find((o) => o.kind === 'dispute' && o.stage === 'moving');
    const h = e && this.homeOfEvent(e);
    if (!e || !h) return;
    const key = homeKey(h);
    this.setEvents({
      ...this.events,
      open: this.events.open.filter((o) => o !== e),
      settled: this.events.settled + 1,
      moved: { ...this.events.moved, [key]: (this.events.moved[key] ?? 0) + 1 },
      // the gap before the next dispute there counts from today, and nothing new begins today
      disputed: { ...this.events.disputed, [key]: dayNumber(Date.now()) },
      last: dayOf(Date.now()),
    });
    this.syncSpecial();
    const t = this.tenantsAt(h);
    this.host.people?.note('tenants', this.tenantsFrom(h, t), welcome(), true);
    const extra = e.waiting ? this.credit(e.waiting) : '';
    this.say(T.newTenants(this.nameOf(h, 'dat'), t.names, t.what, e.waiting ? money(e.waiting) : null, extra), 'good', 10000);
  }

  /** The tenants it went well with at a home come to the party there, once: the line that says so, or ''. */
  guests(key: string): string {
    if (!this.events.glad.includes(key)) return '';
    const h = this.homes.homes.find((x) => homeKey(x) === key);
    this.setEvents({ ...this.events, glad: this.events.glad.filter((g) => g !== key) });
    if (!h) return '';
    const t = this.tenantsAt(h);
    return T.guests(t.names, t.two);
  }

  // ------------------------------------------------------------ home points

  /** Once, to a player with homes: what home points are, with the way to the menu. */
  private sayPointsNote(): void {
    try {
      localStorage.setItem(POINTS_NOTE, '1');
    } catch {
      /* as above */
    }
    this.host.toast(
      T.pointsNote(FLAT_POINTS, HOUSE_POINTS, this.housesOpen(), toMenu()),
      'info',
      14000,
      this.host.openHomes,
    );
  }

  /**
   * Home points from a party (`partyUi.ts`): `n` more, up to `POINTS_MAX`. A party is play, like a
   * delivery, so after it the day's home without a realtor is there too. Returns the points added.
   */
  partyPoints(n: number): number {
    const before = this.points;
    this.daily.played = dayOf(Date.now());
    this.setPoints(earn(this.points, n), true);
    return this.points - before;
  }

  /** A home's building in the square being played, with its middle and outline; null when it is not in it. */
  lotOfHome(home: Home): Lot | null {
    return this.lotOf(home);
  }

  /** Whether a home is the first one while it is still worn down, before its flat is repaired. */
  wornDown(home: Home): boolean {
    return home === this.homes.homes[0] && (this.reno?.stage === 'flat' || this.reno?.stage === 'find');
  }

  /** Home points now: one for each delivery, up to `POINTS_MAX`. */
  pointsNow(): number {
    return this.points;
  }

  /** The free home of the day: 'ready', 'later' (after the first delivery today) or 'used'; null before the first home. */
  dailyNow(): 'ready' | 'later' | 'used' | null {
    if (!this.homes.homes.length) return null;
    const today = dayOf(Date.now());
    return this.daily.used === today ? 'used' : this.daily.played === today ? 'ready' : 'later';
  }

  /** Whether houses can be bought yet (`HOUSES_AFTER`). */
  housesOpen(): boolean {
    return canBuy(this.homes, 'house');
  }

  /** The line on the day's home without a realtor: there, after the first delivery, or bought. */
  dailyLine(): string {
    const d = this.dailyNow();
    const houses = this.housesOpen();
    if (d === 'ready') return T.dailyReady(houses);
    if (d === 'later') return T.dailyLater(houses);
    return T.dailyUsed(houses);
  }

  /** Points, and the day's free home, kept; `changed`: the day's free home changed even if the points did not. */
  private setPoints(p: number, changed = false): void {
    if (p === this.points && !changed) return;
    this.points = p;
    storePoints(p, this.daily);
    this.host.save();
    this.shown = '';
  }

  /** The points a home takes: none for the first home, nor for the rest of its building in the first-home mission. */
  private cost(lot: Lot, what: 'flat' | 'house' | 'building'): number {
    if (!this.homes.homes.length) return 0;
    const had = this.homeOf(lot);
    if (what === 'building' && had && had === this.homes.homes[0] && this.reno?.stage === 'buy') return 0;
    return pointsFor(what, what === 'building' ? lot.units - (had ? 1 : 0) : 1);
  }

  /** Whether buying this now would take the day's free home: a flat or house that would otherwise take points. */
  private daySpends(lot: Lot, what: 'flat' | 'house' | 'building'): boolean {
    return what !== 'building' && this.cost(lot, what) > 0 && dailyReady(this.daily, dayOf(Date.now()));
  }

  /** Deliveries still missing before this can be bought: 0 when it can be now. */
  private waitFor(lot: Lot, what: 'flat' | 'house' | 'building'): number {
    return deliveriesFor(this.points, this.cost(lot, what), this.daily, dayOf(Date.now()), what !== 'building' && this.homes.homes.length > 0);
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
    const daily = this.daySpends(lot, what);
    const need = daily ? 0 : this.cost(lot, what);
    if (!pay || need > this.points || !this.open(lot, what) || (had && what !== 'building') || had?.kind === 'building') return false;
    const restOfReno = !!had && had === this.homes.homes[0] && this.reno?.stage === 'buy';
    // the rent so far goes out first, so the new home's rent starts now
    this.payRent();
    // a first home starts paying tomorrow
    const first = !this.homes.homes.length;
    if (first) this.homes.paidDay = dayOf(Date.now());
    game.cash -= pay.cash;
    if (daily) this.daily.used = dayOf(Date.now());
    if (need || daily) this.setPoints(this.points - need, daily);
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
      // the day of the first home: nothing happens at it until the next day, or a long first visit
      if (!this.events.first) this.setEvents({ ...this.events, first: dayOf(Date.now()) });
      // home points were there from this player's first home: the note on them is not news
      try {
        localStorage.setItem(POINTS_NOTE, '1');
      } catch {
        /* private window */
      }
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
      this.wayTo = null;
      const others = lot.units - 1;
      this.host.toast(T.boughtBuilding(pay.saved ? money(pay.saved) : null, others), 'good', 10000);
    } else if (first && this.host.firstHome) {
      this.cardAtS = this.playedS;
      this.host.firstHome(describe(lot, what), money(mine.rent), worn);
    }
    else this.host.toast(T.bought(describe(lot, what), pay.saved ? money(pay.saved) : null, money(mine.rent), !!this.host.party), 'good', 8000);
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
      // on a job, only the job: nothing to buy until it is done (the owner, 23 November); a party alike
      if (!game.job && !game.party && !game.find) for (const lot of world.lots) {
        if (Math.abs(lot.x - px) > 120 || Math.abs(lot.y - py) > 120) continue;
        const d = distanceTo(lot, px, py);
        if (d < best) {
          best = d;
          found = lot;
        }
      }
    }
    if (bank) found = null;
    this.doorTick();
    const shown = bank ? `bank ${game.cash} ${this.saved}` : found ? `${world!.lots.indexOf(found)} ${game.cash} ${this.saved} ${this.homes.homes.length} ${this.homeOf(found)?.colour ?? ''} ${this.reno?.stage ?? ''} ${this.reno?.fixed ?? ''} ${this.points} ${this.dailyNow()} ${this.host.party?.tag() ?? ''}` : '';
    if (shown === this.shown) return;
    this.shown = shown;
    this.panel.hidden = !shown;
    if (!shown) return;
    this.panel.replaceChildren();
    if (bank) {
      const title = document.createElement('b');
      title.textContent = T.bank;
      const p = document.createElement('p');
      p.textContent = T.bankPanel(money(this.saved), (!this.host.quiet?.() && this.plate?.place) || T.yourHomeTown);
      const b = document.createElement('button');
      const amount = Math.min(Math.floor(game.cash), MAX_CASH - this.saved);
      b.textContent = T.payIn(money(Math.max(0, amount)));
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
      const need = this.cost(found!, what);
      const wait = this.waitFor(found!, what);
      const day = this.daySpends(found!, what);
      b.textContent = !open
        ? T.btnOpens(text, opensAfter(what))
        : need > POINTS_MAX && what === 'building'
          ? T.btnTooBig(text)
          : wait
            ? T.btnAfter(text, money(price), wait)
            : T.btnPrice(text, money(price), day, need);
      b.disabled = !open || wait > 0 || this.budget() < price;
      b.addEventListener('click', () => this.buy(found!, what));
      this.panel.append(b);
    };
    // a party at this home, where one can be thrown now
    const partyButton = (home: Home) => {
      const party = this.host.party;
      if (!party?.can(home)) return;
      const b = document.createElement('button');
      b.className = 'party';
      b.textContent = party.label(home);
      b.addEventListener('click', () => party.offer(home));
      this.panel.append(b);
    };
    const title = document.createElement('b');
    if (had) {
      title.textContent = T.yourKind(had.kind);
      this.panel.append(title);
      const r = this.reno;
      if (had === this.homes.homes[0] && r && r.stage !== 'done' && r.stage !== 'find') {
        const units = r.units ?? found.units;
        if (r.stage === 'flat') line(T.panelWorn);
        else if (r.stage === 'buy') {
          line(T.panelRepaired(money(had.rent), units - 1));
          button(T.buyRest, Math.max(0, found.whole - had.paid), 'building');
        } else if (r.stage === 'rest') line(T.panelRest(1 + (r.fixed ?? 0), units, money(this.rentOf(had))));
        else line(T.panelAllRepaired(money(had.rent)));
        partyButton(had);
        return;
      }
      const note = this.eventNote(had);
      line(note ? T.panelNotePays(note, money(had.rent)) : T.panelPays(money(had.rent)));
      const open = this.eventOf(had);
      if (open?.kind === 'dispute' && (open.stage ?? 'talk') === 'talk' && game.car) line(T.tenantsGetOut);
      else if (open?.kind === 'dispute' && (open.stage ?? 'talk') === 'talk') {
        const b = document.createElement('button');
        b.className = 'talk';
        b.textContent = T.talkTenants;
        b.addEventListener('click', () => this.talk(had));
        this.panel.append(b);
      }
      if (had.kind === 'flat') button(T.buyRest, Math.max(0, found.whole - had.paid), 'building');
      else {
        this.paints(found, had);
        if (this.renovating(had)) line(T.colourLater);
      }
      // after the buying and the paint, so those keep their look
      partyButton(had);
      return;
    }
    title.textContent = T.forSale;
    this.panel.append(title);
    if (this.worn(found)) {
      const price = this.fixerPrice(found);
      title.textContent = T.forSaleWorn;
      line(T.saleWorn(found.floors, found.street, found.units, money(price), price < found.price ? money(found.price) : null));
      button(T.buyWorn, price, 'flat');
      if (this.budget() < price) line(T.cashShort(money(game.cash)));
      return;
    }
    if (found.kind === 'house') {
      line(T.saleHouse(found.street, money(rentFor(found.price))));
      button(T.buyHouse, found.price, 'house');
    } else {
      line(T.saleFlats(found.floors, !!found.inHouse, found.street, money(rentFor(found.price))));
      button(T.buyFlat, found.price, 'flat');
      button(T.buyAll(found.units), found.whole, 'building');
    }
    if (this.budget() < found.price) line(T.youHave(money(game.cash), this.atPlate && this.saved ? money(this.saved) : null));
    if (this.homes.homes.length) {
      const p = document.createElement('p');
      p.className = 'small';
      p.textContent = T.pointsPanel(this.points, FLAT_POINTS, HOUSE_POINTS, this.dailyLine());
      this.panel.append(p);
    }
  }

  /** For a whole house or building: the colours it can be painted, and the map's own. */
  private paints(lot: Lot, home: Home): void {
    const row = document.createElement('div');
    row.className = 'paints';
    const swatch = (hex: string | null, name: string) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.title = name;
      b.setAttribute('aria-label', T.paintIt(name));
      if (hex) b.style.background = hex;
      else b.textContent = '×';
      if ((home.colour ?? null) === hex) b.classList.add('on');
      b.addEventListener('click', () => {
        if (hex) home.colour = hex;
        else delete home.colour;
        // while it waits for renovating, its walls stay worn: the colour goes on once it is renovated
        if (!this.renovating(home)) this.world?.model.paintBuilding(lot.poly, hex);
        saveHomes(this.homes);
        this.host.save();
        this.shown = '';
        this.look();
      });
      row.append(b);
    };
    for (const p of PAINTS) swatch(p.hex, T.paints[p.name] ?? p.name);
    swatch(null, T.ownColour);
    const p = document.createElement('p');
    p.className = 'small';
    p.textContent = T.paintLabel;
    this.panel.append(p, row);
  }

  /**
   * After a run: rent paid out, and a home offered near where it ended. The dearest flat or house
   * the cash will buy, or the cheapest and what is missing; and a bigger one to save up for.
   */
  offer(box: HTMLElement): void {
    const { game } = this.host;
    // the result card lies over the lines
    const rent = this.payRent(false, true);
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
    if (owned) p(T.offerRent(owned, money(this.rentPaying()), rent ? money(rent) : null), 'small');
    if (!free.length) {
      box.hidden = !owned;
      return;
    }
    box.hidden = false;
    const what = (l: Lot) => (l.kind === 'house' ? 'house' : 'flat');
    const open = (l: Lot) => canBuy(this.homes, what(l));
    const affordable = free.filter((l) => open(l) && l.price <= cash && !this.waitFor(l, what(l))).sort((a, b) => b.price - a.price || Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    const pick = affordable[0];
    if (pick) {
      const head = document.createElement('b');
      head.textContent = T.saleNear(describe(pick, what(pick)));
      box.append(head);
      p(T.saleNearText(money(pick.price), money(cash), !!(this.atPlate && this.saved), money(rentFor(pick.price))));
      const b = document.createElement('button');
      b.className = 'buy';
      b.textContent = T.buyFor(money(pick.price));
      b.addEventListener('click', () => {
        if (this.buy(pick, what(pick))) this.offer(box);
      });
      box.append(b);
    } else {
      const paid = [...free].filter((l) => open(l) && l.price <= cash).sort((a, b) => this.waitFor(a, what(a)) - this.waitFor(b, what(b)) || a.price - b.price)[0];
      const cheap = paid ?? [...free].filter(open).sort((a, b) => a.price - b.price)[0];
      if (!cheap) return;
      const wait = this.waitFor(cheap, what(cheap));
      if (cheap.price <= cash && wait) p(T.saleNearWait(describe(cheap, what(cheap)), money(cheap.price), wait));
      else p(T.cheapest(describe(cheap, what(cheap)), money(cheap.price), money(cheap.price - cash), wait));
    }
    // something bigger, to aim for: the nearest house or whole building that costs more
    const goal = free
      .filter((l) => canBuy(this.homes, l.kind === 'house' ? 'house' : 'building') && (l.kind === 'house' ? l.price : l.whole) > Math.max(cash, pick?.price ?? 0) * 1.5)
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
    if (goal) p(T.alsoNear(describe(goal, goal.kind === 'house' ? 'house' : 'building'), money(goal.kind === 'house' ? goal.price : goal.whole)), 'small');
    p(T.stopBeside, 'small');
  }
}
