import { afterEach, describe, expect, it, vi } from 'vitest';
import { after, choiceText, CLOCK_FITS, courtBill, disputeCandidates, DISPUTE_AFTER_DAYS, DISPUTE_GAP_DAYS, fits, kindsFor, LIGHT_LOAD, lowered, note, pickMood, pickupLines, replaceCost, storyLine, tenantsOf, TENANTS } from '../src/game/dispute';
import { homeKey, readEvents, thanks, type Events, type HomeEvent } from '../src/game/events';
import { HomesUi } from '../src/homesUi';
import type { Home } from '../src/game/homes';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the dispute, as rules', () => {
  it('the choice that fits what the tenants wrote: insist when the heating is broken, accept part when money is tight', () => {
    expect(fits('broken', 'insist')).toBe(true);
    expect(fits('broken', 'accept')).toBe(false);
    expect(fits('tight', 'accept')).toBe(true);
    expect(fits('tight', 'insist')).toBe(false);
    expect(pickMood(0.2)).toBe('broken');
    expect(pickMood(0.7)).toBe('tight');
  });

  it('each stage takes the packages of one kind of station; a new boiler, any', () => {
    expect(kindsFor('insist')).toEqual(['rush']);
    expect(kindsFor('accept')).toEqual(['supply']);
    expect(kindsFor('court')).toEqual(['clean']);
    expect(kindsFor('replace')).toHaveLength(4);
    expect(kindsFor('talk')).toBeNull();
    expect(kindsFor('moving')).toBeNull();
  });

  it('four outcomes: each choice goes well or escalates, and nothing escalates twice', () => {
    expect(after('insist', true)).toBe('settled');
    expect(after('insist', false)).toBe('court');
    expect(after('accept', true)).toBe('settled');
    expect(after('accept', false)).toBe('replace');
    // the court's order and the new boiler wait until they are done
    expect(after('court', false)).toBe('court');
    expect(after('court', true)).toBe('moving');
    expect(after('replace', false)).toBe('replace');
    expect(after('replace', true)).toBe('settled');
  });

  it('the bills: the court 5 days of rent, a new boiler 3; the rent agreed a fifth lower', () => {
    expect(courtBill(456)).toBe(2280);
    expect(replaceCost(456)).toBe(1370);
    expect(lowered(500)).toBe(400);
  });

  it('a home keeps its tenants until they change, with names of its own region and none of the story\'s people', () => {
    const home = { key: 'w1@49.45000,11.07000', lat: 49.45, lon: 11.07 };
    const a = tenantsOf(home, 0);
    expect(tenantsOf(home, 0)).toEqual(a);
    expect(TENANTS.map((t) => t.what)).toContain(a.what);
    expect(a.names.split(' and ')).toHaveLength(a.two ? 2 : 1);
    // Nuremberg: German names
    const german = ['Anna', 'Julia', 'Sarah', 'Lisa', 'Katharina', 'Laura', 'Sandra', 'Nicole', 'Stefanie', 'Christina', 'Michael', 'Daniel', 'Thomas', 'Andreas', 'Tobias', 'Stefan', 'Christian', 'Jan', 'Florian', 'Markus'];
    for (let moved = 0; moved < 12; moved++) {
      const t = tenantsOf(home, moved, ['Anna', 'Thomas']);
      for (const n of t.names.split(' and ')) {
        expect(german).toContain(n);
        expect(['Anna', 'Thomas']).not.toContain(n);
      }
    }
    // new tenants after the court's order: other people, as a rule
    const many = new Set(Array.from({ length: 12 }, (_, i) => tenantsOf(home, i).names));
    expect(many.size).toBeGreaterThan(4);
  });

  it('the note holds the hint, and the card says what each choice asks', () => {
    const one = { names: 'Jan', what: 'a student', two: false };
    const two = { names: 'Lena and Max', what: 'a couple with a baby', two: true };
    expect(note('broken', two, 'house')).toContain('cold house');
    expect(note('broken', one, 'building')).toContain('cold flat');
    expect(note('tight', one, 'flat')).toContain('I lost my job');
    expect(note('tight', two, 'flat')).toContain('One of us lost a job');
    const card = choiceText('tight', two, 'flat');
    expect(card).toContain('a rush job');
    expect(card).toContain('a supply run');
    expect(card).toContain('Lena and Max, a couple with a baby');
  });

  it('the pickup says when the choice fits: more time for the part, a lighter load', () => {
    expect(pickupLines('insist', 'broken', 'your flat', 'Sarah').rush).toContain('a little more time');
    expect(pickupLines('insist', 'tight', 'your flat', 'Sarah').rush).not.toContain('more time');
    expect(pickupLines('accept', 'tight', 'your flat', 'Sarah').supply).toContain('lighter load');
    expect(pickupLines('court', 'tight', 'your flat', 'Sarah').clean).toContain('Sarah and a colleague');
    expect(storyLine('insist', false, 'Königstraße')).toBe('Königstraße: you insisted, the part came too late, and the court ordered them out.');
  });

  it('as an event: a home in this part of town, bought a while ago, with no dispute lately and nothing open', () => {
    const today = 20000;
    const h = (key: string, days: number) => ({ key, at: (today - days) * 86400000 });
    const homes = [h('a', DISPUTE_AFTER_DAYS), h('b', DISPUTE_AFTER_DAYS - 1), h('c', 40), h('d', 40), h('e', 40)];
    const got = disputeCandidates(homes, new Set(['d']), { c: today - DISPUTE_GAP_DAYS + 1, e: today - DISPUTE_GAP_DAYS }, today, (x) => x.key !== 'zz');
    expect(got.map((x) => x.key)).toEqual(['a', 'e']);
  });

  it('reads a dispute kept in the browser, and drops what is odd', () => {
    const e = readEvents(
      JSON.stringify({
        open: [
          { home: 'a', kind: 'dispute', began: '2026-11-27', waiting: 400, mood: 'tight', stage: 'court', chapter: true },
          { home: 'b', kind: 'dispute', began: '2026-11-27', mood: 'angry' },
          { home: 'c', kind: 'dispute', began: '2026-11-27', mood: 'broken', stage: 'fly' },
          { home: 'a', kind: 'renovate', began: '2026-11-27' },
        ],
        settled: 2,
        lower: { a: 20005, b: 'x' },
        moved: { a: 1 },
        glad: ['a', 'a', 3],
      }),
      true,
    );
    expect(e.open).toEqual([
      { home: 'a', kind: 'dispute', began: '2026-11-27', waiting: 400, mood: 'tight', stage: 'court', chapter: true },
      { home: 'c', kind: 'dispute', began: '2026-11-27', waiting: 0, mood: 'broken', stage: 'talk' },
    ]);
    expect(e.settled).toBe(2);
    expect(e.lower).toEqual({ a: 20005 });
    expect(e.moved).toEqual({ a: 1 });
    expect(e.glad).toEqual(['a']);
  });
});

describe('the dispute, played at a home', () => {
  const building: Home = { id: 'w1', lat: 49.45, lon: 11.07, kind: 'building', paid: 9000, rent: 500, street: 'Königstraße', place: 'Nuremberg', at: 0 };
  const flat: Home = { id: 'w2', lat: 49.451, lon: 11.071, kind: 'flat', paid: 1600, rent: 400, street: 'Lindenstraße', place: 'Nuremberg', at: 0 };
  const KEY = homeKey(building);

  const setup = (open: HomeEvent[] = [], more: Partial<Events> = {}) => {
    vi.stubGlobal('navigator', { webdriver: true });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    vi.useFakeTimers();
    const listeners: Array<(e: unknown) => void> = [];
    const game = { cash: 1000, special: null as unknown, run: { over: true }, delivered: 40, job: null, party: null, events: listeners };
    const toast = vi.fn();
    const card = vi.fn();
    const note = vi.fn();
    const rec = vi.fn();
    const lot = { id: 'w1', x: 0, y: 0, poly: { outer: [], holes: [] } };
    const u: HomesUi = Object.assign(Object.create(HomesUi.prototype), {
      host: { game, save: vi.fn(), toast, card, quiet: () => false, blocked: () => false, kicker: () => 'Chapter 8 of 8 · Landlord', people: { note, record: rec, officer: () => 'Sarah', names: () => ['Anna'] } },
      homes: { v: 1, homes: [flat, building], paidDay: '2000-01-01' },
      reno: { stage: 'done' },
      events: { ...readEvents(null, true), open, ...more },
      owned: new Map([[lot, building]]),
      world: { model: { paintBuilding: vi.fn() } },
      saved: 0,
      playedS: 100,
      cardAtS: -60,
      shown: '',
      rentLine: null,
      carrying: null,
      movingAfter: -1,
      lessonSaid: false,
      lesson: { stage: 'done', rent: true },
    });
    // the delivery listener the constructor adds
    listeners.push((e) => {
      if ((e as { kind: string }).kind === 'delivered' && game.delivered > (u as unknown as { movingAfter: number }).movingAfter) (u as unknown as { moveIn: () => void }).moveIn();
    });
    const call = (name: string, ...args: unknown[]) => (u as unknown as Record<string, (...a: unknown[]) => unknown>)[name].apply(u, args);
    const events = () => (u as unknown as { events: Events }).events;
    const said = () => {
      vi.runAllTimers();
      return toast.mock.calls.map((c) => c[0] as string);
    };
    return { u, game, toast, card, note, rec, call, events, said };
  };

  const open = (o: Partial<HomeEvent> = {}): HomeEvent => ({ home: KEY, kind: 'dispute', began: '2026-11-27', waiting: 0, mood: 'broken', stage: 'talk', chapter: true, ...o });

  it('chapter 8 begins at the whole building in this part of town: a note, a card, the rent waits', () => {
    const { call, card, note, events } = setup();
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(call('startDispute')).toBe(true);
    const e = events().open[0];
    expect(e).toMatchObject({ home: KEY, kind: 'dispute', mood: 'broken', stage: 'talk', chapter: true });
    expect(events().disputed[KEY]).toBeGreaterThan(0);
    expect(note).toHaveBeenCalledWith('tenants', expect.stringContaining('your building on Königstraße'), expect.stringContaining('heating'), false);
    expect(card.mock.calls[0][0]).toBe('A note from your tenants');
    expect(card.mock.calls[0][5]).toBe('Chapter 8 of 8 · Landlord');
    // not twice
    expect(call('startDispute')).toBe(false);
    // its rent waits; the flat pays
    expect(call('payRent')).toBe(400);
    expect(events().open[0].waiting).toBe(500);
  });

  it('insisting when the heating is broken: the part from a fire station, with more time; in time, all of it and a tip', () => {
    const { u, game, card, note, rec, call, events, said } = setup([open({ waiting: 1000 })]);
    call('talk', building);
    expect(card.mock.calls[0][0]).toBe('Your tenants want to talk');
    expect(card.mock.calls[0][6]).toBe('Not now');
    // insist
    (card.mock.calls[0][4] as (yes: boolean) => void)(true);
    expect(events().open[0].stage).toBe('insist');
    expect(game.special).toMatchObject({ kinds: ['rush'], clock: CLOCK_FITS });
    expect((game.special as { light?: number }).light).toBeUndefined();
    // the part is taken and delivered in time
    Object.assign(game, { special: { ...(game.special as object), at: { lat: building.lat, lon: building.lon } } });
    call('specialTaken');
    call('specialDone', false);
    expect(events().open).toEqual([]);
    expect(events().settled).toBe(1);
    expect(events().glad).toEqual([KEY]);
    expect(game.cash).toBe(1000 + 1000 + thanks(500));
    expect(note).toHaveBeenLastCalledWith('tenants', expect.any(String), expect.stringContaining('Warm again'), true);
    expect(rec).toHaveBeenCalledWith('Königstraße: you insisted, and the part came in time. They paid all they owed.');
    expect(said().at(-1)).toContain('Your building on Königstraße: settled.');
    // they come to the next party there, once
    expect(u.guests(KEY)).toMatch(/your tenants?, came too, and brought dessert\./);
    expect(u.guests(KEY)).toBe('');
  });

  it('insisting, too late: the court\'s order, a clean run with the officers, the bill, and new tenants with the next delivery', () => {
    const { game, card, note, call, events, said } = setup([open({ stage: 'insist', mood: 'tight', waiting: 1000 })]);
    game.cash = 5000;
    call('syncSpecial');
    // no longer clock: the choice didn't fit
    expect((game.special as { clock?: number }).clock).toBeUndefined();
    Object.assign(game, { special: { ...(game.special as object), at: { lat: building.lat, lon: building.lon } } });
    call('specialTaken');
    call('specialLost', 'late');
    expect(events().open[0].stage).toBe('court');
    expect(card.mock.calls.at(-1)![0]).toBe('The court’s order');
    expect(card.mock.calls.at(-1)![1]).toContain('Sarah and a colleague');
    expect(note).toHaveBeenCalledWith('shield', '', expect.stringContaining("court's order"), true);
    call('syncSpecial');
    expect(game.special).toMatchObject({ kinds: ['clean'] });
    // a broken clean run: the officers wait
    call('specialTaken');
    call('specialLost', 'offence');
    expect(events().open[0].stage).toBe('court');
    expect(said().at(-1)).toContain('The officers wait');
    // carried out: the bill, and the tenants move out
    call('specialTaken');
    game.delivered = 41;
    call('specialDone', false);
    expect(events().open[0].stage).toBe('moving');
    // the bill comes out of the rent that waited first, then the cash
    expect(events().open[0].waiting).toBe(0);
    expect(game.cash).toBe(5000 - (courtBill(500) - 1000));
    expect(said().at(-1)).toContain('paid from the rent that waited and your money');
    // the delivery that carried it out brings nobody yet
    for (const l of game.events) l({ kind: 'delivered', special: true });
    expect(events().open[0].stage).toBe('moving');
    // the next one does
    game.delivered = 42;
    for (const l of game.events) l({ kind: 'delivered', special: false });
    expect(events().open).toEqual([]);
    expect(events().moved[KEY]).toBe(1);
    expect(events().settled).toBe(1);
    expect(events().glad).toEqual([]);
    expect(game.cash).toBe(5000 - (courtBill(500) - 1000));
    expect(said().at(-1)).toMatch(/^New tenants in your building on Königstraße: /);
  });

  it('a bill takes the cash first, then the bank, never below nothing', () => {
    const { u, game, call } = setup();
    game.cash = 300;
    Object.assign(u, { saved: 1000 });
    expect(call('charge', 2500)).toBe(1300);
    expect(game.cash).toBe(0);
    expect((u as unknown as { saved: number }).saved).toBe(0);
  });

  it('accepting part when money is tight: a lighter load; without a new dent, the rent a fifth lower for a week', () => {
    const { u, game, card, call, events, said } = setup([open({ mood: 'tight', waiting: 500 })]);
    call('talk', building);
    (card.mock.calls[0][4] as (yes: boolean) => void)(false);
    expect(events().open[0].stage).toBe('accept');
    expect(game.special).toMatchObject({ kinds: ['supply'], light: LIGHT_LOAD });
    Object.assign(game, { special: { ...(game.special as object), at: { lat: building.lat, lon: building.lon } } });
    call('specialTaken');
    call('specialDone', false);
    expect(events().open).toEqual([]);
    expect(game.cash).toBe(1500);
    expect(events().lower[KEY]).toBeGreaterThan(0);
    expect((u as unknown as { rentOf: (h: Home) => number }).rentOf(building)).toBe(400);
    expect(said().at(-1)).toContain('a fifth lower: $400 a day');
  });

  it('accepting part, dented: the old boiler gives up; a new one from any station, at 3 days of rent', () => {
    const { game, card, call, events, said } = setup([open({ stage: 'accept', waiting: 2000 })]);
    call('syncSpecial');
    // the load is heavy: the choice didn't fit
    expect((game.special as { light?: number }).light).toBeUndefined();
    Object.assign(game, { special: { ...(game.special as object), at: { lat: building.lat, lon: building.lon } } });
    call('specialTaken');
    call('specialDone', true);
    expect(events().open[0].stage).toBe('replace');
    expect(card.mock.calls.at(-1)![0]).toBe('The old boiler gave up');
    call('syncSpecial');
    expect((game.special as { kinds: string[] }).kinds).toHaveLength(4);
    Object.assign(game, { special: { ...(game.special as object), at: { lat: building.lat, lon: building.lon } } });
    call('specialTaken');
    call('specialDone', true);
    expect(events().open).toEqual([]);
    expect(events().settled).toBe(1);
    expect(events().glad).toEqual([]);
    expect(game.cash).toBe(1000 + 2000 - replaceCost(500));
    expect(said().at(-1)).toContain('a new boiler, and it is settled');
  });

  it('a package put down (a new run, another place) changes nothing: it can be fetched again', () => {
    const { game, call, events } = setup([open({ stage: 'insist' })]);
    call('syncSpecial');
    Object.assign(game, { special: { ...(game.special as object), at: { lat: building.lat, lon: building.lon } } });
    call('specialTaken');
    call('specialLost', 'dropped');
    expect(events().open[0].stage).toBe('insist');
  });

  it('after chapter 8, a dispute can come as an event; before it, never', () => {
    const { u, card, call, events } = setup([], { first: 'before', renovated: { [KEY]: 99999999 } });
    // a delivery on this visit, and no card for a while: something may happen
    Object.assign(u, { deliveredBefore: 39 });
    call('eventTick');
    expect(events().open).toEqual([]);
    Object.assign(events(), { settled: 1 });
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    call('eventTick');
    expect(events().open[0]).toMatchObject({ home: KEY, kind: 'dispute', stage: 'talk' });
    expect(events().open[0].chapter).toBeUndefined();
    expect(card.mock.calls.at(-1)![0]).toBe('A note from your tenants');
  });
});
