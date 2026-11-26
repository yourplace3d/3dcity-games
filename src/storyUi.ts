/**
 * The story on screen (`game/story.ts` holds its rules): the chapter lines in the game's own voice, the
 * people's messages, each on a paper of their own (Mira's till receipt, Theo's pager, Ana's notebook, the
 * neighbour's card, the friends' texts), and the Story tab of the menu.
 *
 * The owner, 26 November 2026: the game speaks plainly at first, and whoever gives a task writes to you.
 * Written messages only: nobody calls. A message waits while something covers the game (a card, the menu,
 * the big map, the tour) and while a run of three is on, so no scene interrupts a run.
 */

import type { Game } from './game/game';
import type { HomesUi } from './homesUi';
import { BUILDINGS_AFTER, dayOf } from './game/homes';
import { loadParties } from './game/party';
import { namesFor } from './game/names';
import { countPlay } from './linkCount';
import type { JobKind, ServiceKind } from './game/services';
import {
  advance,
  ALL,
  begin,
  BUILT,
  CHAPTERS,
  friendFor,
  goal,
  heading,
  keep,
  loadStory,
  noteJob,
  said,
  say,
  SCENES,
  sender,
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
  /** close the menu, and load the home town beside the first home */
  goHome: () => void;
  /** close the menu */
  closeMenu: () => void;
  /** say that something changed, for saving online */
  stored: () => void;
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

type Queued = { who: Who; text: string; heading?: string };


export class StoryUi {
  private story: Story = loadStory();
  private queue: Queued[] = [];
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
      this.job(e.job);
    });
    // the first package for the flat: the person of that station, met for the first time
    const before = game.onSpecialTaken;
    game.onSpecialTaken = (kind) => {
      before(kind);
      this.specialTaken(kind);
    };
  }

  /** The chapter open now, or the next one waiting; 0 before the story begins. */
  get open(): number {
    return this.story.open;
  }

  /** The kicker of a card the homes show, when that card is the open chapter's own. */
  kicker(what: 'home' | 'bank'): string | undefined {
    if (!this.story.open || this.host.quiet()) return undefined;
    // the first home's card comes only to a player with no home: it is always chapter 3's, even in the
    // moment before the story has seen the delivery that brought it
    if (what === 'home' && !this.story.done[3]) return heading(3);
    if (what === 'bank' && this.story.open === 4 && this.story.opened) return heading(4);
    return undefined;
  }

  // ------------------------------------------------------------ what the game holds

  private snapshot(): Snapshot {
    const mine = this.host.homes()?.mine();
    const homes = mine?.homes ?? [];
    let partied = false;
    try {
      const p = loadParties();
      partied = !!p.paid || Object.keys(p.best).length > 0;
    } catch {
      /* nothing kept */
    }
    return {
      delivered: this.host.game.delivered,
      homes: homes.length,
      reno: mine?.reno?.stage ?? null,
      saved: mine?.saved ?? 0,
      partied,
      building: homes.some((h) => h.kind === 'building'),
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
    return this.host.homes()?.homeTownName() ?? '';
  }

  /** Whether the chapters that happen at home can be played here: in the home town, or before there is one. */
  private atHome(): boolean {
    const h = this.host.homes();
    return !h || !h.mine().homes.length || h.atHomeTown();
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
    if (this.queue.length && performance.now() - this.shownAt >= GAP_S * 1000 && this.playedS >= START_S) this.showNext();
    if (!this.visitSaid && this.playedS >= VISIT_LINE_S && !this.queue.length) this.sayVisit();
  }

  /** The story moves on with what the player has done. */
  private look(): void {
    const s = this.snapshot();
    const today = this.today();
    let story = this.story;
    // the story begins: a player who is further on starts at the chapter they are on, with its scene
    const began = !story.open;
    if (began) story = begin(s, today);
    // the people's names, from the first home's place, once there is one
    const first = this.host.homes()?.mine().homes[0];
    if (!story.names && first) story = { ...story, names: namesFor(first.lat, first.lon) };
    // the first home bought, in play: the neighbour says welcome
    if (this.homesBefore === 0 && s.homes > 0 && !said(story, 'neighbour-welcome')) {
      story = say(story, 'neighbour-welcome');
      this.enqueue(SCENES.neighbourWelcome());
    }
    this.homesBefore = s.homes;
    const r = advance(story, s, today);
    if (r.story !== story || story !== this.story) this.set(r.story);
    r.finished.forEach((n, i) => {
      countPlay('chapter', String(n));
      this.finished(n, r.story, i === r.finished.length - 1);
    });
    if (r.opened) this.opened(r.opened, s);
    else if (began && r.story.opened && !r.finished.length) this.opened(r.story.open, s);
  }

  /** A chapter is done: what is said then. `last`: the last of those done at once, which says what comes next. */
  private finished(n: number, story: Story, last: boolean): void {
    if (n === 6) this.enqueue(SCENES.partyThanks());
    if (n === 7) this.enqueue(SCENES.buildingThanks());
    if (n < 3) return;
    const next = story.open;
    // the next one waits for another day, or for an update; one that opens at once says so itself
    const after = !last ? '' : next > BUILT ? (next <= ALL ? `Chapter ${next}, ${CHAPTERS[next - 1]}, comes in a later update.` : '') : !story.opened ? `Come back tomorrow for chapter ${next}: ${CHAPTERS[next - 1]}.` : '';
    const body = n === 5 ? `${this.three()} know you now. They'll write when they need you.` : '';
    if (body || after) this.line(`Chapter ${n} of ${ALL}: done`, [body, after].filter(Boolean).join(' '));
  }

  /** A chapter opens: its line, and the people who come in with it. */
  private opened(n: number, s: Snapshot): void {
    // chapters 1 to 3 are the tour, the first deliveries and the first flat: their own lines and cards say it
    if (n < 4) return;
    this.visitSaid = true;
    if (!this.atHome()) {
      this.awayLine(n);
      return;
    }
    if (n === 6) this.enqueue(SCENES.housewarming());
    if (n === 7) this.enqueue(SCENES.building(s));
    this.goalLine(n);
    if (n === 5) this.enqueue(SCENES.regulars(this.story));
  }

  /** "Chapter 5 of 8 · The regulars": what it asks. */
  private goalLine(n: number): void {
    this.line(heading(n), this.goalOf(n).text);
  }

  private goalOf(n: number) {
    return goal(n, { ...this.snapshot(), town: this.town(), buildingsAfter: BUILDINGS_AFTER }, this.story);
  }

  /** "Chapter 5, The regulars, waits in Nuremberg." */
  private awayLine(n: number): void {
    this.line(heading(n), `Waits in ${this.town() || 'your home town'}: the menu's Story tab takes you there.`);
  }

  /** At the start of a visit, once: the chapter open now, or where it waits. */
  private sayVisit(): void {
    this.visitSaid = true;
    const n = this.story.open;
    if (n < 4 || n > BUILT || !this.story.opened) return;
    if (!this.atHome()) this.awayLine(n);
    else this.goalLine(n);
  }

  /** A station's job was delivered: its kind, for chapter 5, and the person's thanks. */
  private job(kind: Exclude<JobKind, 'plain'>): void {
    this.set(noteJob(this.story, kind));
    if (this.story.open !== 5 || !this.story.opened || said(this.story, `thanks-${kind}`)) return;
    this.set(say(this.story, `thanks-${kind}`));
    this.enqueue(SCENES.thanks(kind));
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
    return n ? `${n.pump}, ${n.flame} and ${n.shield}` : 'The people at the stations';
  }

  // ------------------------------------------------------------ messages

  private enqueue(lines: Array<[Who, string]>): void {
    for (const [who, text] of lines) this.queue.push({ who, text });
  }

  private line(head: string, text: string): void {
    this.queue.push({ who: 'game', text, heading: head });
  }

  private showNext(): void {
    const q = this.queue.shift();
    if (!q) return;
    this.shownAt = performance.now();
    const names = this.story.names;
    const from = q.who === 'friends' && names ? names.friends[friendFor(this.story)] : sender(q.who, names);
    if (q.who !== 'game') this.set(keep(this.story, { who: q.who, from, text: q.text, day: this.today() }));
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
    this.guide = { x: rx, y: ry };
    game.guide = this.guide;
    return true;
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
      homes?.wayToBank();
      return;
    }
    if (g.way === 'home') {
      const first = homes?.mine().homes[0];
      if (!first || !homes?.showWay(first)) toast('Your home is not in this part of town.');
      else toast('The arrow shows the way to your home.');
      return;
    }
    if (g.way === 'station') {
      const kinds = n === 5 ? STATION_JOBS.filter((k) => !this.story.kinds.includes(k)) : STATION_JOBS;
      toast(this.toStation(kinds) ? 'The arrow shows the nearest station.' : 'No station in this part of town: drive on, and the next one shows.');
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
    if (n >= 1 && n <= BUILT) {
      const g = this.goalOf(n);
      const head = document.createElement('small');
      head.textContent = `Chapter ${n} of ${ALL}`;
      const title = document.createElement('b');
      title.textContent = CHAPTERS[n - 1];
      const text = document.createElement('p');
      const home = this.atHome();
      text.textContent = !story.opened ? `Opens on your next day of play. Chapter ${n - 1} is done.` : home ? g.text : `This chapter happens in ${this.town() || 'your home town'}. ${g.text}`;
      now.append(head, title, text);
      if (story.opened && playing) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'primary';
        if (!home) {
          b.textContent = `Go to ${this.town() || 'your home town'}`;
          b.addEventListener('click', () => this.host.goHome());
          now.append(b);
        } else if (g.way) {
          b.textContent = 'Show the way';
          b.addEventListener('click', () => this.showWay());
          now.append(b);
        }
      }
    } else if (n > BUILT) {
      const title = document.createElement('b');
      title.textContent = 'You are up to date';
      const text = document.createElement('p');
      text.textContent = `Chapter ${BUILT + 1}, ${CHAPTERS[BUILT]}, comes in a later update.`;
      now.append(title, text);
    } else {
      const text = document.createElement('p');
      text.textContent = 'Your story begins as you play.';
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
      note.textContent = state === 'done' ? 'Done' : state === 'open' ? 'Now' : state === 'later' ? 'Coming' : '';
      li.append(name, note);
      list.append(li);
    }
    box.append(now, list);
    const inbox = [...story.inbox].reverse().slice(0, 12);
    if (inbox.length) {
      const h = document.createElement('h3');
      h.textContent = 'Messages';
      box.append(h);
      const msgs = document.createElement('div');
      msgs.className = 'inbox';
      for (const m of inbox) msgs.append(messageEl(m.who, m.from, m.text));
      box.append(msgs);
    }
    const foot = document.createElement('p');
    foot.className = 'small';
    foot.textContent = 'One new chapter on each new day you play. Nothing is lost on a day you miss: the chapter waits.';
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
