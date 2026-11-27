import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryUi } from '../src/storyUi';
import { HomesUi } from '../src/homesUi';
import { dayOf, type Home } from '../src/game/homes';
import { addPending, HELLO, keep, none, REGULARS, type Story } from '../src/game/story';
import { namesFor } from '../src/game/names';
import type { Stage } from '../src/game/events';
import type { RenoStage } from '../src/game/renovation';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A stand-in for an element of the page: what the Story tab and a message are made of. */
class El {
  children: El[] = [];
  dataset: Record<string, string> = {};
  className = '';
  textContent = '';
  type = '';
  click: () => void = () => undefined;
  constructor(readonly tag: string) {}
  append(...c: El[]): void {
    this.children.push(...c);
  }
  replaceChildren(...c: El[]): void {
    this.children = c;
  }
  addEventListener(_: string, f: () => void): void {
    this.click = f;
  }
  /** everything written in it */
  get text(): string {
    return [this.textContent, ...this.children.map((c) => c.text)].filter(Boolean).join(' ');
  }
  all(tag: string): El[] {
    return [...(this.tag === tag ? [this] : []), ...this.children.flatMap((c) => c.all(tag))];
  }
}

const TODAY = dayOf(Date.now());
const BEFORE = '2026-11-01';
const names = namesFor(49.4521, 11.0767);
const flat: Home = { id: 'w2', lat: 49.451, lon: 11.071, kind: 'flat', paid: 1600, rent: 400, street: 'Lindenstraße', place: 'Nuremberg', at: 0 };
const building: Home = { id: 'w1', lat: 49.47, lon: 11.1, kind: 'building', paid: 9000, rent: 500, street: 'Königstraße', place: 'Nuremberg', at: 1 };
const doneTo = (n: number): Story['done'] => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { day: BEFORE }]));
/** a story with chapter `n` open today */
const at = (n: number, o: Partial<Story> = {}): Story => ({ ...none(), open: n, opened: TODAY, last: TODAY, first: BEFORE, done: doneTo(n - 1), names, said: n > 5 ? [REGULARS] : [], ...o });

interface Town {
  homes: Home[];
  /** the homes in the part of town being played */
  here: Home[];
  /** in the home town: within reach of the first home */
  inTown: boolean;
  reno: RenoStage | null;
  dispute: { stage: Stage; home: Home } | null;
  moved: boolean;
  worn: Home | null;
  flats: 'arrow' | 'here' | 'none';
  /** a party has been thrown (chapter 6) */
  partied: boolean;
}

function setup(story: Story, town: Partial<Town> = {}) {
  vi.stubGlobal('navigator', { webdriver: true });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('document', { createElement: (tag: string) => new El(tag) });
  const t: Town = { homes: [flat], here: [flat], inTown: true, reno: 'done', dispute: null, moved: false, worn: null, flats: 'none', partied: true, ...town };
  const homes = {
    mine: () => ({ homes: t.homes, reno: t.reno ? { stage: t.reno } : null, saved: 100 }),
    homeTownName: () => 'Nuremberg',
    homeTownAt: () => ({ lat: flat.lat, lon: flat.lon }),
    atHomeTown: () => t.inTown,
    isHere: (h: Home) => t.here.includes(h),
    dispute: () => (t.dispute ? { ...t.dispute, chapter: true, here: t.here.includes(t.dispute.home) } : null),
    settled: () => 0,
    movedOut: () => t.moved,
    renovatingHere: () => t.worn,
    flatsWay: () => t.flats,
    startDispute: vi.fn(() => true),
    showWay: vi.fn((h: Home) => t.here.includes(h)),
    dropWay: vi.fn(),
    wayToBank: vi.fn(),
    payOut: vi.fn(),
  };
  const game = {
    ticks: [],
    events: [],
    delivered: 10,
    cash: 500,
    run: { over: true },
    job: null,
    party: null,
    find: null,
    auto: false,
    special: null as { at: { lat: number; lon: number } } | null,
    specialHere: () => false,
    guide: null as { x: number; y: number } | null,
    pos: () => [0, 0],
    // a pump 100 m away, a police station 200 m, a fire station 300 m
    world: { services: [{ kind: 'fuel', x: 100, y: 0 }, { kind: 'fire', x: 300, y: 0 }, { kind: 'police', x: -200, y: 0 }], roads: { nearest: () => null } },
    onSave: vi.fn(),
    planFind: vi.fn(() => ({})),
    startFind: vi.fn(),
  };
  const host = { game, homes: () => homes, show: vi.fn(), openStory: vi.fn(), blocked: () => false, quiet: () => false, goHome: vi.fn(), closeMenu: vi.fn(), stored: vi.fn(), card: vi.fn() };
  const ui: StoryUi = Object.assign(Object.create(StoryUi.prototype), { host, story, queue: story.pending.map((m) => ({ ...m })), shownAt: -Infinity, everyT: 0, playedS: 60, visitSaid: true, homesBefore: t.homes.length, guide: null, partied: t.partied, partiedAt: performance.now(), findCar: '' });
  const inner = ui as unknown as { story: Story; queue: Array<{ who: string; text: string; heading?: string }> } & Record<string, (...a: unknown[]) => unknown>;
  /** the Story tab, drawn: its words, and its button if it has one */
  const tab = () => {
    const box = new El('div');
    ui.draw(box as unknown as HTMLElement, true);
    const now = box.children[0];
    return { text: now.all('p')[0].text, button: now.all('button')[0] as El | undefined };
  };
  /** the lines shown over the game so far */
  const shown = () => host.show.mock.calls.map((c) => (c[0] as El).text);
  return { ui, inner, host, game, homes, t, tab, shown };
}

describe('where a chapter waits', () => {
  it('chapter 8 waits at a home when none stands in this part of town, though it is the home town', () => {
    // the first home is in a suburb; the city centre is loaded, 25 km around is still the home town
    const { inner, host, homes, tab, t } = setup(at(8), { here: [] });
    const now = tab();
    expect(now.text).toContain('This chapter happens at your flat on Lindenstraße, in another part of town.');
    expect(now.button?.textContent).toBe('Go to your flat on Lindenstraße');
    now.button!.click();
    expect(host.goHome).toHaveBeenCalledWith(flat);
    // and the tenants don't write here
    inner.tick(0.1);
    expect(homes.startDispute).not.toHaveBeenCalled();
    // beside the home, they do, and the tab leads to it
    t.here = [flat];
    expect(tab().button?.textContent).toBe('Show the way');
    inner.tick(0.1);
    expect(homes.startDispute).toHaveBeenCalled();
  });

  it('from another town, a chapter waits in the home town', () => {
    const { host, tab } = setup(at(8), { here: [], inTown: false });
    const now = tab();
    expect(now.text).toContain('This chapter happens in Nuremberg.');
    expect(now.button?.textContent).toBe('Go to Nuremberg');
    now.button!.click();
    expect(host.goHome).toHaveBeenCalledWith(flat);
  });

  it('says where it waits at the start of a visit: the town from afar, the home within the town', () => {
    const far = setup(at(6), { here: [], inTown: false });
    far.inner.sayVisit();
    expect(far.inner.queue.at(-1)!.text).toBe("Waits in Nuremberg: the menu's Story tab takes you there.");
    const near = setup(at(6), { here: [] });
    near.inner.sayVisit();
    expect(near.inner.queue.at(-1)!.text).toBe("Waits at your flat on Lindenstraße, in another part of town: the menu's Story tab takes you there.");
  });

  it('says where it waits as it opens, and what it asks where it can be played', () => {
    // chapter 6 waited for its day: today it opens, with no home in this part of town
    const waiting = at(6, { opened: '', last: BEFORE });
    const away = setup(waiting, { here: [], partied: false });
    away.inner.look();
    expect(away.inner.story.opened).toBe(TODAY);
    expect(away.inner.queue.filter((q) => q.who === 'game').map((q) => q.text)).toEqual(["Waits at your flat on Lindenstraße, in another part of town: the menu's Story tab takes you there."]);
    const home = setup(waiting, { partied: false });
    home.inner.look();
    expect(home.inner.queue.filter((q) => q.who === 'game').map((q) => q.text)).toEqual(['Throw a party at your home: stop beside it.']);
    // the friends write either way
    expect(home.inner.queue.filter((q) => q.who === 'friends')).toHaveLength(2);
  });

  it('a package for the home can still be taken a little beyond its part of town: no trip back for it', () => {
    // insisting: the fire station's ring flashes green here, as the game kept the way to the building's door
    const near = setup(at(8), { homes: [flat, building], here: [flat], dispute: { stage: 'insist', home: building } });
    near.game.special = { at: { lat: building.lat, lon: building.lon } };
    near.game.specialHere = () => true;
    expect(near.tab().button?.textContent).toBe('Show the way');
    near.ui.showWay();
    expect(near.game.guide).toEqual({ x: 300, y: 0 });
    // to talk to the tenants one has to stop beside the building: that is there, not here
    const talk = setup(at(8), { homes: [flat, building], here: [flat], dispute: { stage: 'talk', home: building } });
    talk.game.special = { at: { lat: building.lat, lon: building.lon } };
    talk.game.specialHere = () => true;
    expect(talk.tab().button?.textContent).toBe('Go to your building on Königstraße');
    // a package that goes to another home is no help
    const other = setup(at(8), { homes: [flat, building], here: [flat], dispute: { stage: 'insist', home: building } });
    other.game.special = { at: { lat: flat.lat, lon: flat.lon } };
    other.game.specialHere = () => true;
    expect(other.tab().button?.textContent).toBe('Go to your building on Königstraße');
  });

  it('a party of chapter 6 counts at any home: one here will do, in the home town or away', () => {
    expect(setup(at(6), { homes: [flat, building], here: [building], inTown: false }).tab().button?.textContent).toBe('Show the way');
    expect(setup(at(6), { homes: [flat, building], here: [] }).tab().button?.textContent).toBe('Go to your flat on Lindenstraße');
  });

  it('the dispute of chapter 8 is played at its own home: the way to a station only where that home is', () => {
    // insisting: the part comes from a fire station, to the building
    const away = setup(at(8), { homes: [flat, building], here: [flat], dispute: { stage: 'insist', home: building } });
    const now = away.tab();
    expect(now.button?.textContent).toBe('Go to your building on Königstraße');
    now.button!.click();
    expect(away.host.goHome).toHaveBeenCalledWith(building);
    // asked all the same, no arrow to a station whose package would be an ordinary job
    away.ui.showWay();
    expect(away.game.guide).toBeNull();
    expect(away.shown().at(-1)).toContain('at your building on Königstraße, in another part of town');
    // where the building stands: the nearest fire station, not the pump that is nearer
    const there = setup(at(8), { homes: [flat, building], here: [building], dispute: { stage: 'insist', home: building } });
    expect(there.tab().button?.textContent).toBe('Show the way');
    there.ui.showWay();
    expect(there.game.guide).toEqual({ x: 300, y: 0 });
  });

  it('new tenants move in with the next delivery wherever it is made: nothing to go back for', () => {
    const { tab } = setup(at(8), { homes: [flat, building], here: [flat], dispute: { stage: 'moving', home: building } });
    expect(tab().text).toBe('New tenants move into your building on Königstraße with your next delivery.');
    expect(tab().button).toBeUndefined();
  });

  it('the first flat is repaired only where it stands: elsewhere chapter 3 leads back to it', () => {
    const away = setup(at(3), { here: [], reno: 'flat' });
    expect(away.tab().button?.textContent).toBe('Go to your flat on Lindenstraße');
    away.ui.showWay();
    expect(away.game.guide).toBeNull();
    const there = setup(at(3), { reno: 'flat' });
    there.ui.showWay();
    expect(there.game.guide).toEqual({ x: 100, y: 0 });
  });

  it('chapter 7 leads to the first building to buy the rest, and to a station to repair and paint it', () => {
    // another home is nearer the list's start: the way is to the first building all the same
    const other: Home = { ...flat, id: 'w9', street: 'Marktplatz' };
    const buy = setup(at(7), { homes: [flat, other], here: [other, flat], reno: 'buy' });
    buy.ui.showWay();
    expect(buy.homes.showWay).toHaveBeenCalledWith(flat);
    expect(setup(at(7), { homes: [flat, other], here: [other], reno: 'buy' }).tab().button?.textContent).toBe('Go to your flat on Lindenstraße');
    for (const reno of ['rest', 'paint'] as const) {
      const fix = setup(at(7), { homes: [{ ...flat, kind: 'building' }], reno });
      fix.t.here = fix.t.homes;
      fix.ui.showWay();
      expect(fix.homes.showWay).not.toHaveBeenCalled();
      expect(fix.game.guide).toEqual({ x: 100, y: 0 });
    }
  });

  it('chapter 3 says where the worn-down flats are once they have been shown', () => {
    const { ui, shown, tab, t } = setup(at(3), { homes: [], here: [], reno: 'find', flats: 'arrow' });
    expect(tab().button?.textContent).toBe('Show the way');
    ui.showWay();
    expect(shown().at(-1)).toBe('The arrow shows the way to the worn-down flats.');
    t.flats = 'here';
    ui.showWay();
    expect(shown().at(-1)).toContain('green $ sign');
  });

  it('chapter 8 says that a home being renovated here comes first, and leads to a station for it', () => {
    const { ui, game, tab } = setup(at(8), { worn: flat });
    expect(tab().text).toContain('First your flat on Lindenstraße needs renovating');
    ui.showWay();
    expect(game.guide).toEqual({ x: 100, y: 0 });
    // in another town a home being renovated holds nobody back: the tenants are those of the home town
    const far: Home = { ...flat, id: 'w7', street: 'Unter den Linden', place: 'Berlin' };
    const away = setup(at(8), { homes: [flat, far], here: [far], inTown: false, worn: far });
    expect(away.tab().text).toBe('This chapter happens in Nuremberg. Your tenants have something to say: drive to one of your homes in Nuremberg.');
  });
});

describe('the people at the stations', () => {
  const deliver = (inner: Record<string, (...a: unknown[]) => unknown>, kind: string, dented = false) => inner.job(kind, dented);

  it('thank for the one job chapter 5 asks for them, not for another job for someone met before', () => {
    // the pump brought the first flat's repair: chapter 5 asks for the other two
    const { inner } = setup(at(5, { kinds: ['supply'], said: [REGULARS] }));
    deliver(inner, 'supply');
    expect(inner.queue).toEqual([]);
    deliver(inner, 'rush');
    expect(inner.queue.map((q) => q.who)).toEqual(['flame']);
    // once
    deliver(inner, 'rush');
    expect(inner.queue).toHaveLength(1);
    expect(inner.story.kinds).toEqual(['supply', 'rush']);
  });

  it('the pump thanks for the load as it arrived', () => {
    const whole = setup(at(5));
    deliver(whole.inner, 'supply');
    expect(whole.inner.queue[0].text).toContain('in one piece');
    const dented = setup(at(5));
    deliver(dented.inner, 'supply', true);
    expect(dented.inner.queue[0].text).toContain('new dent');
  });

  it('a hello that still waited is dropped once the job is done: no invitation after the thanks', () => {
    // chapter 5 opened away from home: the hellos wait for the home town, the jobs count anywhere
    const waiting = addPending(at(5), [['flame', HELLO.rush], ['shield', HELLO.clean]]);
    const { inner } = setup(waiting, { here: [], inTown: false });
    deliver(inner, 'rush');
    expect(inner.queue.map((q) => q.text)).toEqual([HELLO.clean, "That was quick. I'll call on you again."]);
    expect(inner.story.pending.map((m) => m.text)).toEqual([HELLO.clean, "That was quick. I'll call on you again."]);
  });

  it('say hello as chapter 5 opens: those who have not written, after the chapter\'s line, and it asks for a job for each', () => {
    // a job of each kind was done on the first days; the pump wrote at the flat's repair
    let waiting = at(5, { opened: '', last: BEFORE, kinds: ['supply', 'rush', 'clean'] });
    waiting = keep(waiting, { who: 'pump', from: 'Mira · the pump', text: 'Here is your plaster', day: BEFORE });
    const { inner } = setup(waiting);
    inner.look();
    expect(inner.story.opened).toBe(TODAY);
    expect(inner.story.kinds).toEqual(['supply']);
    expect(inner.queue.map((q) => q.text)).toEqual([`Do a job for ${names.flame} at the fire station and ${names.shield} at the police station.`, HELLO.rush, HELLO.clean]);
    expect(inner.story.said).toContain(REGULARS);
    // once
    inner.look();
    expect(inner.queue).toHaveLength(3);
  });

  it('hear of a delivery as the game tells it: the pump\'s thanks by the dent, through the game\'s own events', () => {
    const story = at(5, { said: [REGULARS] });
    const { host, game } = setup(story);
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === '3da-story' ? JSON.stringify(story) : null), setItem: vi.fn() });
    Object.assign(game, { onSpecialTaken: vi.fn(), onFind: null });
    const ui = new StoryUi(host as unknown as ConstructorParameters<typeof StoryUi>[0]) as unknown as { story: Story };
    const events = game.events as Array<(e: unknown) => void>;
    expect(events).toHaveLength(1);
    events[0]({ kind: 'delivered', job: 'supply', left: 12, special: false, dented: true });
    expect(ui.story.pending.map((m) => m.text)).toEqual(["Delivered. A new dent on the way, but it's all here. You'll do."]);
    // a plain package is no station's job
    events[0]({ kind: 'delivered', job: 'plain', left: 12, special: false });
    expect(ui.story.kinds).toEqual(['supply']);
  });

  it('say hello to a player whose chapter 5 was ticked before they wrote, once', () => {
    // as the story first went live: only the pump was met, at the flat's repair
    let legacy = at(6, { opened: '', said: [], kinds: ['supply', 'rush', 'clean'] });
    legacy = keep(legacy, { who: 'pump', from: 'Mira · the pump', text: 'Here is your plaster', day: BEFORE });
    const { inner } = setup(legacy);
    const hellos = () => inner.queue.filter((q) => q.who !== 'game').map((q) => q.text);
    inner.look();
    expect(hellos()).toEqual([HELLO.rush, HELLO.clean]);
    expect(inner.story.said).toContain(REGULARS);
    inner.look();
    expect(hellos()).toHaveLength(2);
  });

  it('the pump\'s ask is kept with the messages only once it is taken on', () => {
    const { inner, host, game } = setup(at(6, { opened: '', last: BEFORE }));
    vi.spyOn(Math, 'random').mockReturnValue(0);
    inner.offerFind();
    expect(host.card).toHaveBeenCalledTimes(1);
    const answer = host.card.mock.calls[0][4] as (yes: boolean) => void;
    expect(inner.story.inbox).toEqual([]);
    // "Not now": nothing kept, and she asks again another day
    answer(false);
    expect(inner.story.inbox).toEqual([]);
    expect(game.startFind).not.toHaveBeenCalled();
    answer(true);
    expect(game.startFind).toHaveBeenCalled();
    expect(inner.story.inbox.map((m) => m.who)).toEqual(['pump']);
    expect(inner.story.inbox[0].text).toContain('left her keys');
  });
});

describe('how the story ends', () => {
  const lastLine = (inner: { queue: Array<{ text: string }> }) => inner.queue.at(-1)!.text;

  it('with tenants who know the player, or after a court\'s order with new ones', () => {
    const settled = setup(at(8, { open: 9, opened: '' }), { homes: [flat, building], here: [building] });
    settled.inner.finished(8, settled.inner.story, true, false);
    expect(lastLine(settled.inner)).toContain('Your own building in Nuremberg, and tenants who know you.');
    const court = setup(at(8, { open: 9, opened: '' }), { moved: true });
    court.inner.finished(8, court.inner.story, true, false);
    expect(lastLine(court.inner)).toContain('Your own homes in Nuremberg, and new tenants.');
  });

  it('promises more of the people\'s stories without denying the one already played', () => {
    const { inner, tab } = setup(at(8, { open: 9, opened: '', said: [REGULARS, 'find-car'] }));
    inner.finished(8, inner.story, true, false);
    const more = `${names.pump}, ${names.flame} and ${names.shield} have more for you: their own stories go on in later updates.`;
    expect(lastLine(inner)).toContain(more);
    expect(lastLine(inner)).not.toContain('come in a later update');
    expect(tab().text).toBe(more);
  });

  it('the neighbour thanks for the house they live in only when that is the building', () => {
    const own = setup(at(8, { opened: '' }), { homes: [{ ...flat, kind: 'building' }] });
    own.inner.finished(7, own.inner.story, true, false);
    expect(own.inner.queue[0].text).toBe('The whole house looks new. Thank you.');
    const other = setup(at(8, { opened: '' }), { homes: [flat, building] });
    other.inner.finished(7, other.inner.story, true, false);
    expect(other.inner.queue[0].text).toBe('A whole building of your own. It is in good hands.');
  });
});

describe('the way to the worn-down flats', () => {
  it('leads back once the player has driven off again', () => {
    const game = { pos: (): [number, number] => [50, 0] };
    const area = { x: 0, y: 0, rx: 0, ry: 0, lots: [], marks: [], here: true };
    const ui = Object.assign(Object.create(HomesUi.prototype), { host: { game }, reno: { stage: 'find' }, area }) as HomesUi;
    expect(ui.flatsWay()).toBe('here');
    // 600 m off for another delivery: "You are there" would be wrong, and no arrow would show
    game.pos = () => [600, 0];
    expect(ui.flatsWay()).toBe('arrow');
    expect(area.here).toBe(false);
    expect(Object.assign(Object.create(HomesUi.prototype), { host: { game }, reno: { stage: 'find' }, area: null }).flatsWay()).toBe('none');
  });
});

describe('the first flat, put off', () => {
  it('is offered again after the next delivery, as chapter 3 says', () => {
    vi.stubGlobal('navigator', { webdriver: true });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    vi.useFakeTimers();
    const game = { cash: 250, delivered: 2, run: { over: true }, job: null, party: null, special: null, guide: null, pos: () => [0, 0] };
    const card = vi.fn();
    const ui = Object.assign(Object.create(HomesUi.prototype), {
      host: { game, save: vi.fn(), toast: vi.fn(), card, kicker: () => 'Chapter 3 of 8 · A roof over your head' },
      homes: { v: 1, homes: [], paidDay: '' },
      reno: null,
      events: { open: [] },
      world: {},
      wayTo: null,
      noted: new Set<string>(),
      offeredAt: -1,
      playedS: 100,
      cardAtS: -60,
    }) as unknown as { missionTick: () => void };
    ui.missionTick();
    expect(card).toHaveBeenCalledTimes(1);
    expect(card.mock.calls[0][0]).toBe('Private mission: your first home');
    // "Later": not again at once
    (card.mock.calls[0][4] as (yes: boolean) => void)(false);
    ui.missionTick();
    expect(card).toHaveBeenCalledTimes(1);
    // the next delivery brings it back
    game.delivered = 3;
    ui.missionTick();
    expect(card).toHaveBeenCalledTimes(2);
  });
});
