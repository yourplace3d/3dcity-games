/**
 * The story on screen (`game/story.ts` holds its rules): the chapter lines in the game's own voice, the
 * people's messages, each on a paper of their own (Mira's till receipt, Theo's pager, Ana's notebook, the
 * neighbour's card, the friends' texts, the tenants' note on the door), and the Story tab of the menu.
 *
 * The owner, 26 November 2026: the game speaks plainly at first, and whoever gives a task writes to you.
 * Written messages only: nobody calls. A message waits while something covers the game (a card, the menu,
 * the big map, the tour) and while a run of three is on, so no scene interrupts a run.
 */

import type { Game } from './game/game';
import { homeName, type HomesUi } from './homesUi';
import { BUILDINGS_AFTER, dayOf, type Home } from './game/homes';
import { isCoords } from './homesList';
import { loadParties } from './game/party';
import { namesFor } from './game/names';
import { countPlay } from './linkCount';
import { cardDue, inviteCard, loadSeen } from './discord';
import type { JobKind, ServiceKind } from './game/services';
import { kindsFor } from './game/dispute';
import { FIXER_MIN } from './game/renovation';
import { findPay, KINDS, LOOKS } from './game/find';
import type { FindEvent } from './game/game';
import { money, T } from './i18n';
import type { Case } from './lang/en';
import {
  addNote,
  addPending,
  advance,
  ALL,
  begin,
  BUILT,
  CHAPTERS,
  FIND_SCENE,
  findDue,
  friendFor,
  goal,
  heading,
  HELLO,
  hellosDue,
  keep,
  loadStory,
  MEET,
  noteJob,
  offer,
  PERSON_OF,
  record,
  REGULARS,
  said,
  say,
  SCENES,
  sender,
  shown,
  STATION_JOBS,
  storeStory,
  type Snapshot,
  type Story,
  type Who,
} from './game/story';

export interface StoryHost {
  game: Game;
  homes: () => HomesUi | null;
  /** an element as a line over the game, for `ms`; `tap`: what tapping it does */
  show: (el: HTMLElement, ms: number, tap?: () => void) => void;
  /** the menu, on the Story tab */
  openStory: () => void;
  /** something covers the game (a card, the menu, the map, the tour): messages wait */
  blocked: () => boolean;
  /** no story now: a city is being guessed, or a friend's run or party from a link is played */
  quiet: () => boolean;
  /** close the menu, and load the home town beside the first home, or the part of town of the home `to` */
  goHome: (to?: Home) => void;
  /** close the menu */
  closeMenu: () => void;
  /** say that something changed, for saving online */
  stored: () => void;
  /** a card over the game that waits for an answer; `kicker`: who asks */
  card: (title: string, text: string, yes: string, no: string, answer: (yes: boolean) => void, kicker?: string) => void;
}

/** seconds a person's message shows, and the game's line */
const MESSAGE_S = 9;
const LINE_S = 8;
/** seconds between two messages */
const GAP_S = 2.8;
/** seconds of play on a visit before any message: after the place's name and the line on rent */
const START_S = 6;
/** seconds of play on a visit before the open chapter is said */
const VISIT_LINE_S = 9;
/** the stations' kinds, by the job each hands out */
const SERVICE_OF: Record<Exclude<JobKind, 'plain'>, ServiceKind> = { supply: 'fuel', rush: 'fire', clean: 'police' };

/**
 * `again`: a line said again on each visit (the open chapter, or where it waits), so a new place drops it;
 * `from`: who a person's note is from, where the story's names don't say it; `anywhere`: shown wherever the
 * player is, not only in the home town.
 */
type Queued = { who: Who; text: string; heading?: string; again?: boolean; from?: string; anywhere?: boolean };
/** seconds into a visit before chapter 8's tenants write: after the chapter's line has been read */
const DISPUTE_AFTER_S = 16;
/** seconds into a visit before the Discord's card, and how long it shows */
const DISCORD_AFTER_S = 12;
const DISCORD_CARD_S = 20;
/** seconds into a visit before a person's scene is offered: after the day's chapter has had its turn */
const SCENE_AFTER_S = 30;


export class StoryUi {
  private story: Story = loadStory();
  /** what waits to be shown: the game's lines for this visit, and the people's messages kept in `Story.pending` */
  private queue: Queued[] = this.story.pending.map((m) => ({ ...m }));
  /** when the last message was shown (ms, page time): messages keep a gap in real time, as they show for real time */
  private shownAt = -Infinity;
  private everyT = 0;
  /** seconds played on this visit while nothing covered the game */
  private playedS = 0;
  /** the open chapter has been said on this visit */
  private visitSaid = false;
  /** homes the player had at the last look, to see the first one bought */
  private homesBefore = -1;
  /** the arrow to a station, set by "Show the way" */
  private guide: { x: number; y: number } | null = null;

  constructor(private readonly host: StoryHost) {
    const { game } = host;
    game.ticks.push((dt) => this.tick(dt));
    game.events.push((e) => {
      if (e.kind !== 'delivered' || e.job === 'plain' || this.host.quiet()) return;
      this.job(e.job, !!e.dented);
    });
    // the first package for the flat: the person of that station, met for the first time
    const before = game.onSpecialTaken;
    game.onSpecialTaken = (kind) => {
      before(kind);
      this.specialTaken(kind);
    };
    game.onFind = (e, metres) => this.found(e, metres);
  }

  /**
   * A place has been loaded (`go()` in `main.ts`): a visit to it begins. Its first seconds are for the place's
   * name and the rent, the open chapter is said again, and the last place's lines are not.
   */
  arrived(): void {
    this.playedS = 0;
    this.visitSaid = false;
    this.queue = this.queue.filter((q) => !q.again);
  }

  /** Whether chapter `n` is done. */
  done(n: number): boolean {
    return !!this.story.done[n];
  }

  /** The chapter open now, or the next one waiting; 0 before the story begins. */
  get open(): number {
    return this.story.open;
  }

  /** The kicker of a card the homes show, when that card is the open chapter's own. */
  kicker(what: 'home' | 'bank' | 'dispute'): string | undefined {
    if (!this.story.open || this.host.quiet()) return undefined;
    // a dispute before chapter 8 is done is chapter 8's: they come as events only after it
    if (what === 'dispute') return this.story.open === 8 && this.story.opened ? heading(8) : undefined;
    // the first home's card comes only to a player with no home: it is always chapter 3's, even in the
    // moment before the story has seen the delivery that brought it
    if (what === 'home' && !this.story.done[3]) return heading(3);
    if (what === 'bank' && this.story.open === 4 && this.story.opened) return heading(4);
    return undefined;
  }

  // ------------------------------------------------------------ what the game holds

  /** a party has been thrown: read from the parties' store now and then, as it only ever turns true */
  private partied = false;
  private partiedAt = -Infinity;

  private snapshot(): Snapshot {
    const mine = this.host.homes()?.mine();
    const homes = mine?.homes ?? [];
    if (!this.partied && performance.now() - this.partiedAt > 5000) {
      this.partiedAt = performance.now();
      try {
        const p = loadParties();
        this.partied = !!p.paid || Object.keys(p.best).length > 0;
      } catch {
        /* nothing kept */
      }
    }
    const partied = this.partied;
    const h = this.host.homes();
    return {
      delivered: this.host.game.delivered,
      homes: homes.length,
      reno: mine?.reno?.stage ?? null,
      saved: mine?.saved ?? 0,
      partied,
      building: homes.some((x) => x.kind === 'building'),
      firstWhole: homes[0]?.kind === 'building',
      settled: h?.settled() ?? 0,
      dispute: h?.dispute()?.stage ?? null,
      moved: h?.movedOut() ?? false,
    };
  }

  private set(s: Story): void {
    this.story = s;
    storeStory(s);
    this.host.stored();
  }

  private today(): string {
    return dayOf(Date.now());
  }

  /** The first home's town: the story's from chapter 4 on. */
  private town(): string {
    const t = this.host.homes()?.homeTownName() ?? '';
    // a place with no name was kept by its coordinates: "your home town" reads better
    return isCoords(t) ? '' : t;
  }

  /** Whether the chapters that happen at home can be played here: in the home town, or before there is one. */
  private atHome(): boolean {
    const h = this.host.homes();
    return !h || !h.mine().homes.length || h.atHomeTown();
  }

  /** The first home: the story's own, whose town is the home town. */
  private first(): Home | null {
    return this.host.homes()?.mine().homes[0] ?? null;
  }

  /** A home of the player's in the part of town being played: the first home if it is here. */
  private homeHere(): Home | null {
    const h = this.host.homes();
    return h?.mine().homes.find((x) => h.isHere(x)) ?? null;
  }

  /**
   * The home chapter `n` happens at, wherever it stands; null when it needs none. The first flat's repair
   * (3) and the first building (7) are the first home's. A party (6) at any home counts: one here, if one
   * stands here. The tenants (8) are those of the open dispute's home; before they have written, of a home
   * here; and once they have moved out, the new ones come with the next delivery, wherever it is made.
   */
  private homeOf(n: number): Home | null {
    const h = this.host.homes();
    if (!h) return null;
    const reno = h.mine().reno?.stage ?? null;
    if (n === 3) return reno === 'flat' ? this.first() : null;
    if (n === 6) return this.homeHere() ?? this.first();
    if (n === 7) return reno === 'buy' || reno === 'rest' || reno === 'paint' ? this.first() : null;
    if (n === 8) {
      const d = h.dispute();
      if (d) return d.stage === 'moving' ? null : d.home;
      return this.homeHere() ?? this.first();
    }
    return null;
  }

  /**
   * Where chapter `n` waits, when it cannot be played in the part of town loaded now: the home to go to.
   * Null when it can be played here. The bank (4) is the home town's, and so are the tenants until they have
   * written (8). What happens at a home, or with a package for it, needs that home in this part of town:
   * being in the home town is not enough, as that is 25 km around the first home and a part of town is
   * 1.5 km across.
   */
  private elsewhere(n: number): Home | null {
    const h = this.host.homes();
    if (!h) return null;
    if ((n === 4 || (n === 8 && !h.dispute())) && !this.atHome()) return this.first();
    const home = this.homeOf(n);
    if (!home || h.isHere(home)) return null;
    // a package for it can still be taken a little beyond its part of town: the game keeps the way to its door
    const { game } = this.host;
    const sp = game.special;
    return this.wantsPackage(n) && sp && sp.at.lat === home.lat && sp.at.lon === home.lon && game.specialHere() ? null : home;
  }

  /** Whether chapter `n`'s next step is a station's package for its home (not a stop beside the home). */
  private wantsPackage(n: number): boolean {
    const h = this.host.homes();
    const reno = h?.mine().reno?.stage ?? null;
    if (n === 3) return reno === 'flat';
    if (n === 7) return reno === 'rest' || reno === 'paint';
    const d = n === 8 ? h?.dispute() : null;
    return !!d && !!kindsFor(d.stage);
  }

  /** Whether chapter `n` waits somewhere else: in the home town, or at a home in another part of town. */
  private waitsHome(n: number): boolean {
    return !!this.elsewhere(n);
  }

  /** Where a chapter waits, by name: "Nuremberg" from another town; within the home town, "your flat on Königstraße". */
  private whereOf(to: Home): string {
    return this.atHome() ? homeName(to) : this.town() || T.yourHomeTown;
  }

  /** The same as a line says it: "in Nuremberg", or "at your flat on Königstraße, in another part of town". */
  private waitsAt(to: Home | null): string {
    return to && this.atHome() ? T.waitsAtHome(homeName(to, 'dat')) : T.waitsIn(this.town() || T.yourHomeTown);
  }

  // ------------------------------------------------------------ each moment

  private tick(dt: number): void {
    if (this.host.quiet()) return;
    const covered = this.host.blocked();
    if (!covered) this.playedS += dt;
    this.everyT -= dt;
    if (this.everyT <= 0) {
      this.everyT = 0.5;
      this.look();
    }
    this.guideTick();
    if (covered || !this.host.game.run.over) return;
    const next = this.nextIndex();
    if (next >= 0 && performance.now() - this.shownAt >= GAP_S * 1000 && this.playedS >= START_S) this.showNext(next);
    if (!this.visitSaid && this.playedS >= VISIT_LINE_S && next < 0) this.sayVisit();
    // chapter 8: the tenants write, once the chapter's line has been read and nothing else waits
    if (this.story.open === 8 && this.story.opened && this.visitSaid && next < 0 && this.playedS >= DISPUTE_AFTER_S && performance.now() - this.shownAt > LINE_S * 1000 && !this.waitsHome(8)) {
      const h = this.host.homes();
      if (h && !h.dispute()) h.startDispute();
    }
    // the Discord's card, once, after its chapter: when nothing else is said, and before any scene's card
    if (next < 0 && this.visitSaid && this.playedS >= DISCORD_AFTER_S && performance.now() - this.shownAt > LINE_S * 1000 && cardDue((n) => this.done(n), loadSeen())) this.inviteDiscord();
    // the pump's scene: a car to find, once the day's chapter has had its turn (and not as the tenants' card opens)
    if (next < 0 && !this.host.blocked() && this.visitSaid && this.playedS >= SCENE_AFTER_S && performance.now() - this.shownAt > LINE_S * 1000) this.offerFind();
  }

  /** The Discord's card (`discord.ts`): small, over the game, and it waits for nobody. */
  private inviteDiscord(): void {
    this.shownAt = performance.now();
    const el = inviteCard(() => el.remove());
    this.host.show(el, DISCORD_CARD_S * 1000);
  }

  // ------------------------------------------------------------ the people's scenes

  /** the car being looked for: its look and kind, by their place in `LOOKS` and `KINDS` */
  private findCar: [number, number] | null = null;

  /** the car being looked for, in words ("a pink van"), in the case asked */
  private carWords(c: Case = 'nom'): string {
    return this.findCar ? T.car(this.findCar[0], this.findCar[1], c) : T.theCar(c);
  }

  /** Mira asks: a customer's car is gone. In the home town, when nothing else is on, once a day until played. */
  private offerFind(): void {
    const { game } = this.host;
    const today = this.today();
    if (!findDue(this.story, today) || !this.atHome() || game.job || game.party || game.find || !game.run.over || !game.world || game.auto) return;
    // one card at a time (the tenants' may have opened this moment), and one thing at a time: not while a
    // home waits for a station's package here
    if (this.host.blocked() || (game.special && game.specialHere())) return;
    const homes = this.host.homes();
    this.set(offer(this.story, FIND_SCENE, today));
    const lookAt = Math.floor(Math.random() * LOOKS.length);
    const kindAt = Math.floor(Math.random() * KINDS.length);
    const look = LOOKS[lookAt];
    const kind = KINDS[kindAt];
    const ask = SCENES.findAsk(T.car(lookAt, kindAt));
    const names = this.story.names;
    this.host.card(
      T.findTitle,
      T.findCard(ask),
      T.findIt,
      T.notNow,
      (yes) => {
        if (!yes) return;
        const at = homes?.homeTownAt() ?? null;
        const plan = game.planFind({ kind: kind.kind, colour: look.colour }, at);
        if (!plan) {
          this.toast(T.findNoStreet);
          return;
        }
        // asked and taken on: her words are kept with the messages (put off, they would pile up there, a new car each day)
        this.set(keep(this.story, { who: 'pump', from: sender('pump', names), text: ask, day: today }));
        this.findCar = [lookAt, kindAt];
        game.startFind(plan);
        this.toast(T.findGo(this.carWords('dat')));
      },
      names ? sender('pump', names) : T.thePump,
    );
  }

  /** What happens while the car is looked for. */
  private found(e: FindEvent, metres: number): void {
    if (this.host.quiet()) return;
    if (e === 'spotted') this.toast(T.findSpotted(this.carWords()));
    else if (e === 'closer') this.toast(T.findCloser);
    else if (e === 'in') this.toast(T.findIn);
    else if (e === 'out') this.toast(T.findOut);
    else if (e === 'dropped') this.toast(T.findDropped);
    else {
      // back at the pump, or wrecked on the way: played either way
      const pay = e === 'done' ? findPay(metres) : Math.round(findPay(metres) / 20) * 10;
      const homes = this.host.homes();
      if (homes) homes.payOut(pay);
      else {
        this.host.game.cash += pay;
        this.host.game.onSave();
      }
      const who = this.story.names?.pump ?? T.thePump;
      this.set(record(say(this.story, FIND_SCENE), e === 'done' ? T.findSoFar(who) : T.findSoFarWrecked, this.today()));
      this.enqueue(e === 'done' ? SCENES.findThanks() : SCENES.findWrecked());
      this.toast(T.findPaid(e === 'done', money(pay)));
    }
  }

  private toast(text: string): void {
    this.host.show(messageEl('game', '', text), 5500);
  }

  /** The story moves on with what the player has done. */
  private look(): void {
    const s = this.snapshot();
    const today = this.today();
    let story = this.story;
    // the story begins: a player who is further on starts at the chapter they are on, with its scene
    const began = !story.open;
    if (began) story = begin(s, today);
    // the people's names, from the home town's place (the first home's), once there is one
    const at = this.host.homes()?.homeTownAt();
    if (!story.names && at) story = { ...story, names: namesFor(at.lat, at.lon) };
    // the first home bought, in play: the neighbour says welcome
    if (this.homesBefore === 0 && s.homes > 0 && !said(story, 'neighbour-welcome')) {
      const lines = SCENES.neighbourWelcome(s.reno === 'flat');
      story = addPending(say(story, 'neighbour-welcome'), lines);
      this.push(lines);
    }
    this.homesBefore = s.homes;
    const r = advance(story, s, today);
    // written only when something changed: `advance` hands back the same story when nothing moved
    if (r.story !== this.story) this.set(r.story);
    // the arrow to a station was for the chapter that is done
    if (r.finished.length) this.clearGuide();
    r.finished.forEach((n, i) => {
      countPlay('chapter', String(n));
      this.finished(n, r.story, i === r.finished.length - 1, r.early.includes(n));
    });
    if (r.opened) this.opened(r.opened, s);
    else if (began && r.story.opened && !r.finished.length) this.opened(r.story.open, s);
    // chapter 5 has opened: the people at the stations not yet met say hello, once, after its line. (Also to
    // a player whose chapter 5 was ticked before they wrote, as the story first went live.)
    if (hellosDue(this.story)) {
      const hellos = SCENES.regulars(this.story);
      this.set(say(this.story, REGULARS));
      if (hellos.length) this.enqueue(hellos);
    }
  }

  /**
   * A chapter is done: what is said then. `last`: the last of those done at once, which says what comes next.
   * `early`: done before it opened, so it never had its scene, and the people's thanks would answer nothing.
   */
  private finished(n: number, story: Story, last: boolean, early: boolean): void {
    if (n === 6 && !early) this.enqueue(SCENES.partyThanks());
    const s = this.snapshot();
    // the neighbour's thanks: for the house they live in, or for a building bought elsewhere
    if (n === 7 && !early) this.enqueue(SCENES.buildingThanks(!!s.firstWhole));
    if (n < 3) return;
    const next = story.open;
    // the next one waits for another day, or for an update; one that opens at once says so itself
    const after = !last ? '' : next > BUILT ? (next <= ALL ? T.laterUpdate(next, CHAPTERS[next - 1]) : this.later()) : !story.opened ? T.tomorrow(next, CHAPTERS[next - 1]) : '';
    const town = this.town();
    const body =
      n === 5 && !early
        ? T.knowYou(this.three())
        : n === 8
          ? // after a court's order the tenants are new: they don't know the player yet
            T.storyEnd(!!s.building, town, !!s.moved)
          : '';
    if (body || after) this.line(T.chapterDone(n, ALL), [body, after].filter(Boolean).join(' '));
  }

  /**
   * A chapter opens: its line, and the people who come in with it. Away from the home town the line says
   * where it waits, and the people's messages wait for the home town (kept, so a later visit brings them).
   */
  private opened(n: number, s: Snapshot): void {
    // chapters 1 to 3 are the tour, the first deliveries and the first flat: their own lines and cards say it
    if (n < 4) return;
    this.visitSaid = true;
    if (n === 6) this.enqueue(SCENES.housewarming());
    if (n === 7) this.enqueue(SCENES.building(s));
    if (this.waitsHome(n)) this.awayLine(n);
    else this.goalLine(n);
  }

  /** "Chapter 5 of 8 · The regulars": what it asks. */
  private goalLine(n: number): void {
    this.line(heading(n), this.goalOf(n).text, true);
  }

  private goalOf(n: number) {
    const h = this.host.homes();
    const d = h?.dispute();
    const { game } = this.host;
    // the first flat is offered to a player with enough cash, once no run of three is on
    const flatWaits = game.cash < FIXER_MIN ? ('cash' as const) : !game.run.over ? ('run' as const) : undefined;
    // a home being renovated holds the tenants back only where they would write: in the home town, before they have
    const worn = n === 8 && !d && this.atHome() ? h?.renovatingHere() : null;
    return goal(
      n,
      { ...this.snapshot(), town: this.town(), buildingsAfter: BUILDINGS_AFTER, away: !this.atHome(), disputeAt: d ? (c) => homeName(d.home, c) : undefined, flatWaits, renovateFirst: worn ? homeName(worn) : undefined },
      this.story,
    );
  }

  /** "Chapter 8 of 8 · Landlord: waits in Nuremberg", or, within the home town, at the home it happens at. */
  private awayLine(n: number): void {
    this.line(heading(n), T.waitsLine(this.waitsAt(this.elsewhere(n))), true);
  }

  /** At the start of a visit, once: the chapter open now, or where it waits. */
  private sayVisit(): void {
    this.visitSaid = true;
    const n = this.story.open;
    if (n < 4 || n > BUILT || !this.story.opened) return;
    if (this.waitsHome(n)) this.awayLine(n);
    else this.goalLine(n);
  }

  /**
   * A station's job was delivered: its kind, for chapter 5, and the person's thanks for the one job the
   * chapter asks for them (not for another job for someone already met). `dented`: the car took harm.
   */
  private job(kind: Exclude<JobKind, 'plain'>, dented = false): void {
    const asked = !this.story.kinds.includes(kind);
    const noted = noteJob(this.story, kind);
    if (noted !== this.story) this.set(noted);
    // a job delivered: the arrow to a station has done its work
    this.clearGuide();
    if (this.story.open !== MEET || !this.story.opened || !asked || said(this.story, `thanks-${kind}`)) return;
    // their hello still waited (for the home town, or for a card to go): with the job done it invites to nothing
    const who = PERSON_OF[kind];
    this.queue = this.queue.filter((q) => q.who !== who || q.text !== HELLO[kind]);
    this.set(say(shown(this.story, who, HELLO[kind]), `thanks-${kind}`));
    this.enqueue(SCENES.thanks(kind, dented));
  }

  /**
   * A note from the tenants or the officer of a dispute (`homesUi.ts`): kept with the messages, and with
   * `strip`, shown over the game as well, wherever the player is (the dispute's home is in the part of town
   * being played).
   */
  note(who: 'tenants' | 'shield', from: string, text: string, strip: boolean): void {
    if (this.host.quiet()) return;
    const names = this.story.names;
    const by = from || sender(who, names);
    if (!strip) {
      this.set(keep(this.story, { who, from: by, text, day: this.today() }));
      return;
    }
    this.queue.push({ who, text, from: by, anywhere: true });
    this.set(addNote(this.story, { who, text, from: by, anywhere: true }));
  }

  /** A line for "The story so far": a choice made, and how it went. */
  record(text: string): void {
    if (this.host.quiet()) return;
    this.set(record(this.story, text, this.today()));
  }

  /** The officer's name, for the court's order. */
  officer(): string {
    return this.story.names?.shield ?? '';
  }

  /** The story's people's names, which no tenant shares. */
  peopleNames(): string[] {
    const n = this.story.names;
    return n ? [n.pump, n.flame, n.shield, n.neighbour, ...n.friends] : [];
  }

  /** A package for the first flat was taken: the first person of the stations writes. */
  private specialTaken(kind: JobKind): void {
    if (kind === 'plain' || this.host.quiet() || this.host.homes()?.mine().reno?.stage !== 'flat' || said(this.story, 'first-repair')) return;
    this.set(say(this.story, 'first-repair'));
    this.enqueue(SCENES.firstRepair(kind));
  }

  /** "Mira, Theo and Ana" */
  private three(): string {
    const n = this.story.names;
    return n ? T.three(n.pump, n.flame, n.shield) : T.thePeople;
  }

  /** What follows the last chapter: the people's own stories. True whether or not the pump's first scene has been played. */
  private later(): string {
    return T.moreLater(this.three());
  }

  // ------------------------------------------------------------ messages

  /** People's messages to show: kept with the story until they are shown. */
  private enqueue(lines: Array<[Who, string]>): void {
    this.push(lines);
    this.set(addPending(this.story, lines));
  }

  private push(lines: Array<[Who, string]>): void {
    for (const [who, text] of lines) this.queue.push({ who, text });
  }

  /** A person's message has been shown: it no longer waits, and it is kept. */
  private shownNote(q: Queued, from: string): void {
    if (q.who === 'game') return;
    const kept = keep(this.story, { who: q.who, from, text: q.text, day: this.today() });
    const next = shown(kept, q.who, q.text);
    this.set(q.who === 'friends' ? { ...next, turn: (next.turn + 1) % 3 } : next);
  }

  /**
   * The first message that may show now: the game's lines always; the people's in the home town, where they
   * are; the friends' also wherever one of the player's homes stands.
   */
  private nextIndex(): number {
    const home = this.atHome();
    const friends = home || !!this.homeHere();
    return this.queue.findIndex((q) => q.who === 'game' || q.anywhere || home || (q.who === 'friends' && friends));
  }

  private line(head: string, text: string, again = false): void {
    this.queue.push({ who: 'game', text, heading: head, ...(again ? { again } : {}) });
  }

  private showNext(i: number): void {
    const [q] = this.queue.splice(i, 1);
    if (!q) return;
    this.shownAt = performance.now();
    const names = this.story.names;
    const from = q.from ?? (q.who === 'friends' && names ? names.friends[friendFor(this.story)] : sender(q.who, names));
    this.shownNote(q, from);
    this.host.show(messageEl(q.who, q.who === 'game' ? (q.heading ?? '') : from, q.text), (q.who === 'game' ? LINE_S : MESSAGE_S) * 1000, () => this.host.openStory());
  }

  // ------------------------------------------------------------ the way

  /** The arrow to the nearest station of these kinds. Returns whether there is one in this part of town. */
  private toStation(kinds: Array<Exclude<JobKind, 'plain'>>): boolean {
    const { game } = this.host;
    const w = game.world;
    if (!w) return false;
    const want = new Set(kinds.map((k) => SERVICE_OF[k]));
    const [px, py] = game.pos();
    let best: { x: number; y: number } | null = null;
    let d = Infinity;
    for (const s of w.services) {
      if (!want.has(s.kind)) continue;
      const e = Math.hypot(s.x - px, s.y - py);
      if (e < d) {
        d = e;
        best = s;
      }
    }
    if (!best) return false;
    const n = w.roads.nearest(best.x, best.y, 150, 'traffic');
    const [rx, ry] = n ? w.roads.point(n.line, n.s) : [best.x, best.y];
    // asked for now: the way to a home steps aside
    this.host.homes()?.dropWay();
    this.guide = { x: rx, y: ry };
    game.guide = this.guide;
    return true;
  }

  private clearGuide(): void {
    if (this.guide && this.host.game.guide === this.guide) this.host.game.guide = null;
    this.guide = null;
  }

  private guideTick(): void {
    const { game } = this.host;
    if (!this.guide) return;
    // another way took the arrow, or the player got there
    if (game.guide !== this.guide) {
      this.guide = null;
      return;
    }
    const [px, py] = game.pos();
    if (Math.hypot(this.guide.x - px, this.guide.y - py) < 40) {
      game.guide = null;
      this.guide = null;
    }
  }

  /** "Show the way", from the Story tab: where the open chapter leads. The menu is closed first. */
  showWay(): void {
    const n = this.story.open;
    const g = this.goalOf(n);
    const homes = this.host.homes();
    this.host.closeMenu();
    const toast = (t: string) => this.host.show(messageEl('game', '', t), 4500);
    if (g.way === 'bank') {
      // asked from the story, the way is shown, never turned off
      homes?.wayToBank(false);
      return;
    }
    if (g.way === 'flats') {
      // the first-home mission points there itself: say where it stands
      const w = homes?.flatsWay() ?? 'none';
      toast(w === 'arrow' ? T.wayFlatsArrow : w === 'here' ? T.wayFlatsHere : T.wayFlatsNone);
      return;
    }
    // what happens at a home, or with a package for it, needs that home in this part of town: a station's
    // package taken elsewhere would be an ordinary job
    const to = this.elsewhere(n);
    if (to) {
      toast(T.wayElsewhere(this.waitsAt(to)));
      return;
    }
    const d = n === 8 ? homes?.dispute() : null;
    if (g.way === 'home') {
      // the home the chapter is about: the first building, the tenants' home, a home to throw a party at
      const home = this.homeOf(n);
      if (!home || !homes?.showWay(home)) toast(T.noHomeHere);
      else toast(d ? T.wayTenants : T.wayHome);
      return;
    }
    if (g.way === 'station') {
      // chapter 8: the stations its stage takes; chapter 5: those of the people still to do a job for
      const kinds = d ? (kindsFor(d.stage) ?? STATION_JOBS).filter((k): k is Exclude<JobKind, 'plain'> => k !== 'plain') : n === MEET ? STATION_JOBS.filter((k) => !this.story.kinds.includes(k)) : STATION_JOBS;
      toast(this.toStation(kinds) ? T.wayStation : T.noStation);
    }
  }

  // ------------------------------------------------------------ the Story tab

  /** The menu's Story tab: the chapter open now and what it asks, every chapter, and the messages. */
  draw(box: HTMLElement, playing: boolean): void {
    box.replaceChildren();
    const story = this.story;
    const n = story.open;
    const now = document.createElement('div');
    now.className = 'story-now';
    if (this.host.game.find && playing) {
      // a car being looked for: what to do, and a way to stop
      const head = document.createElement('small');
      head.textContent = this.story.names ? sender('pump', this.story.names) : T.thePump;
      const title = document.createElement('b');
      title.textContent = T.findTitle;
      const text = document.createElement('p');
      text.textContent = T.findMenu(this.carWords('acc'));
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = T.stopLooking;
      b.addEventListener('click', () => {
        this.host.closeMenu();
        this.host.game.stopFind('dropped');
      });
      now.append(head, title, text, b);
    } else if (n >= 1 && n <= BUILT) {
      const g = this.goalOf(n);
      const head = document.createElement('small');
      head.textContent = T.chapterOf(n, ALL);
      const title = document.createElement('b');
      title.textContent = CHAPTERS[n - 1];
      const text = document.createElement('p');
      // where it waits, if not here: the home town, or within it the home it happens at
      const to = this.elsewhere(n);
      const where = to ? this.whereOf(to) : '';
      text.textContent = !story.opened ? T.opensNext(n - 1) : to ? T.happensAt(this.waitsAt(to), g.text) : g.text;
      now.append(head, title, text);
      if (story.opened && playing) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'primary';
        if (to) {
          b.textContent = T.goTo(where);
          b.addEventListener('click', () => this.host.goHome(to));
          now.append(b);
        } else if (g.way) {
          b.textContent = T.showWay;
          b.addEventListener('click', () => this.showWay());
          now.append(b);
        }
      }
    } else if (n > BUILT) {
      const title = document.createElement('b');
      const text = document.createElement('p');
      if (BUILT < ALL) {
        title.textContent = T.upToDate;
        text.textContent = T.laterUpdate(BUILT + 1, CHAPTERS[BUILT]);
      } else {
        title.textContent = T.wholeStory;
        text.textContent = this.later();
      }
      now.append(title, text);
    } else {
      const text = document.createElement('p');
      text.textContent = T.storyBegins;
      now.append(text);
    }
    const list = document.createElement('ol');
    list.className = 'chapters';
    for (let c = 1; c <= ALL; c++) {
      const li = document.createElement('li');
      const state = story.done[c] ? 'done' : c === n && story.opened ? 'open' : c > BUILT ? 'later' : 'ahead';
      li.dataset.state = state;
      const name = document.createElement('span');
      name.textContent = CHAPTERS[c - 1];
      const note = document.createElement('small');
      note.textContent = state === 'done' ? T.stateDone : state === 'open' ? T.stateNow : state === 'later' ? T.stateComing : '';
      li.append(name, note);
      list.append(li);
    }
    box.append(now, list);
    // each choice made, and how it went
    if (story.sofar.length) {
      const h = document.createElement('h3');
      h.textContent = T.storySoFar;
      const ul = document.createElement('ul');
      ul.className = 'sofar';
      for (const l of [...story.sofar].reverse()) {
        const li = document.createElement('li');
        li.textContent = l.text;
        ul.append(li);
      }
      box.append(h, ul);
    }
    const inbox = [...story.inbox].reverse().slice(0, 12);
    if (inbox.length) {
      const h = document.createElement('h3');
      h.textContent = T.messages;
      box.append(h);
      const msgs = document.createElement('div');
      msgs.className = 'inbox';
      for (const m of inbox) msgs.append(messageEl(m.who, m.from, m.text));
      box.append(msgs);
    }
    const foot = document.createElement('p');
    foot.className = 'small';
    foot.textContent = T.storyFoot;
    box.append(foot);
  }
}

/** A message on its sender's paper: the game's line, Mira's receipt, Theo's pager, Ana's notebook, the neighbour's card, the friends' texts. */
export function messageEl(who: Who, from: string, text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'msg';
  el.dataset.who = who;
  if (from) {
    const f = document.createElement(who === 'game' ? 'small' : 'b');
    f.className = 'from';
    f.textContent = from;
    el.append(f);
  }
  const t = document.createElement('span');
  t.className = 'text';
  t.textContent = text;
  el.append(t);
  return el;
}
