import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventDue, FIRST_DAY_S, homeKey, readEvents, renovationCandidates, RENOVATE_AFTER_DAYS, thanks, type EventNow, type Events } from '../src/game/events';
import { HomesUi } from '../src/homesUi';
import type { Home } from '../src/game/homes';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const none = (o: Partial<Events> = {}): Events => ({ open: [], last: '', first: '2026-11-20', renovated: {}, ...o });
const now = (o: Partial<EventNow> = {}): EventNow => ({ today: '2026-11-24', playedS: 100, deliveredHere: 1, sinceCardS: 999, busy: false, ...o });

describe('when something happens at a home', () => {
  it('after the first delivery of a visit, once a day, never with a package on board or just after a card', () => {
    expect(eventDue(none(), now())).toBe(true);
    expect(eventDue(none(), now({ deliveredHere: 0 }))).toBe(false);
    expect(eventDue(none({ last: '2026-11-24' }), now())).toBe(false);
    expect(eventDue(none(), now({ busy: true }))).toBe(false);
    expect(eventDue(none(), now({ sinceCardS: 5 }))).toBe(false);
  });

  it('not on the day of the first home, unless that visit is long', () => {
    const firstDay = none({ first: '2026-11-24' });
    expect(eventDue(firstDay, now())).toBe(false);
    expect(eventDue(firstDay, now({ playedS: FIRST_DAY_S }))).toBe(true);
    // homes from before events existed: their first day is long past
    expect(eventDue(none({ first: 'before' }), now())).toBe(true);
    expect(eventDue(none({ first: '' }), now())).toBe(false);
  });
});

describe('renovation', () => {
  const home = (id: string, daysAgo: number): Home => ({ id, lat: 49.45, lon: 11.07, kind: 'flat', paid: 1600, rent: 384, street: 'Königstraße', place: 'Nuremberg', at: (20000 - daysAgo) * 86400000 });

  it('a home bought or renovated a week ago or more, in this part of town, with nothing open', () => {
    const homes = [home('a', RENOVATE_AFTER_DAYS), home('b', RENOVATE_AFTER_DAYS - 1), home('c', 30), home('d', 30)];
    const e = none({ open: [{ home: homeKey(homes[3]), kind: 'renovate', began: '2026-11-23', waiting: 0 }] });
    expect(renovationCandidates(homes, e, 20000, () => true).map((h) => h.id)).toEqual(['a', 'c']);
    expect(renovationCandidates(homes, e, 20000, (h) => h.id !== 'c').map((h) => h.id)).toEqual(['a']);
    // renovated two days ago: not again yet
    expect(renovationCandidates([homes[2]], none({ renovated: { [homeKey(homes[2])]: 19998 } }), 20000, () => true)).toEqual([]);
  });

  it('the tenants thank with a quarter of a day of rent', () => {
    expect(thanks(384)).toBe(100);
    expect(thanks(20)).toBe(10);
  });

  it('reads what is kept, and nothing odd', () => {
    expect(readEvents(null, true)).toEqual({ open: [], last: '', first: 'before', renovated: {} });
    expect(readEvents('nonsense', false).first).toBe('');
    const kept = readEvents('{"v":1,"open":[{"home":"a@1,2","kind":"renovate","began":"2026-11-24","waiting":384},{"home":"b","kind":"fire","began":"2026-11-24"}],"last":"2026-11-24","first":"2026-11-20","renovated":{"c":19990,"d":"x"}}', true);
    expect(kept).toEqual({ open: [{ home: 'a@1,2', kind: 'renovate', began: '2026-11-24', waiting: 384 }], last: '2026-11-24', first: '2026-11-20', renovated: { c: 19990 } });
  });
});

describe('rent and renovation', () => {
  const flat: Home = { id: 'a', lat: 49.45, lon: 11.07, kind: 'flat', paid: 1600, rent: 384, street: 'Königstraße', place: 'Nuremberg', at: 0 };
  const house: Home = { id: 'b', lat: 49.46, lon: 11.08, kind: 'house', paid: 2200, rent: 528, street: 'Spitalgasse', place: 'Nuremberg', at: 0 };
  const ui = () => {
    vi.stubGlobal('navigator', { webdriver: true });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    vi.stubGlobal('document', { body: { classList: { contains: () => false } } });
    vi.useFakeTimers();
    const game = { cash: 100, special: null };
    const toast = vi.fn();
    const u: HomesUi = Object.assign(Object.create(HomesUi.prototype), {
      host: { game, save: vi.fn(), toast },
      homes: { v: 1, homes: [flat, house], paidDay: '2000-01-01' },
      reno: { stage: 'done' },
      events: { open: [{ home: homeKey(house), kind: 'renovate', began: '2026-11-23', waiting: 528 }], last: '', first: 'before', renovated: {} },
      owned: new Map(),
      lesson: { stage: 'done', rent: true },
      shown: '',
      rentLine: null,
    });
    return { u, game, toast };
  };

  it('while a city is guessed, the lines name no street', () => {
    const { u, game } = ui();
    Object.assign((u as unknown as { host: object }).host, { quiet: () => true });
    (u as unknown as { syncSpecial: () => void }).syncSpecial();
    const say = (game.special as unknown as { say: Record<string, string> }).say;
    expect(Object.values(say).some((l) => l.includes('Spitalgasse'))).toBe(false);
    expect(say.supply).toContain('your house');
    vi.useRealTimers();
  });

  it('at the most cash one can hold, the rent that waited goes to the bank', () => {
    const { u, game, toast } = ui();
    Object.assign(u, { saved: 0 });
    // cash stops at the most one can hold, as the game's own does
    let held = 999_900;
    Object.defineProperty(game, 'cash', { get: () => held, set: (v: number) => (held = Math.min(1_000_000, v)) });
    (u as unknown as { eventDone: (k: string) => void }).eventDone(homeKey(house));
    expect(game.cash).toBe(1_000_000);
    expect((u as unknown as { saved: number }).saved).toBe(528 + thanks(528) - 100);
    vi.runAllTimers();
    vi.useRealTimers();
    expect(toast.mock.calls.at(-1)![0]).toContain('went to your bank');
  });

  it('a package for a home being renovated brings no card of the first-home mission', () => {
    const { u, game } = ui();
    const card = vi.fn();
    Object.assign((u as unknown as { host: object }).host, { card });
    Object.assign(game, { special: { at: { lat: house.lat, lon: house.lon }, say: {} } });
    (u as unknown as { specialTaken: () => void }).specialTaken();
    expect(card).not.toHaveBeenCalled();
    expect((u as unknown as { carrying: string }).carrying).toBe(homeKey(house));
    vi.useRealTimers();
  });

  it('the rent of a home being renovated waits at it, and comes with the thanks once it is done', () => {
    const { u, game, toast } = ui();
    // a new day: the flat pays, the house's rent waits
    expect(u.payRent()).toBe(384);
    expect(game.cash).toBe(100 + 384);
    expect(toast.mock.calls[0][0]).toContain('$528 waits at your house on Spitalgasse until it is renovated');
    // the package arrives: the two days of rent that waited, and the tenants' thanks
    (u as unknown as { eventDone: (k: string) => void }).eventDone(homeKey(house));
    expect(game.cash).toBe(100 + 384 + 528 * 2 + thanks(528));
    expect((u as unknown as { events: Events }).events.open).toEqual([]);
    vi.runAllTimers();
    vi.useRealTimers();
    expect(toast.mock.calls.at(-1)![0]).toBe('Your house on Spitalgasse is renovated. The $1,056 rent that waited there is yours, and the tenants thank you with $130.');
  });
});

describe('when the first-home mission waits', () => {
  it('a player who has not bought the rest of the first building still gets events', () => {
    vi.stubGlobal('navigator', { webdriver: true });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const old: Home = { id: 'a', lat: 49.45, lon: 11.07, kind: 'flat', paid: 1600, rent: 384, street: 'Königstraße', place: 'Nuremberg', at: Date.now() - 10 * 86400000 };
    const lot = { id: 'a', x: 0, y: 0, poly: { outer: [], holes: [] } };
    const card = vi.fn();
    const u: HomesUi = Object.assign(Object.create(HomesUi.prototype), {
      host: { game: { delivered: 4, job: null, run: { over: true }, special: null }, save: vi.fn(), toast: vi.fn(), card, quiet: () => false, blocked: () => false },
      homes: { v: 1, homes: [old], paidDay: '' },
      // the flat is repaired; the rest of the building is for sale, maybe for a long time
      reno: { stage: 'buy', units: 4 },
      events: { open: [], last: '', first: 'before', renovated: {} },
      owned: new Map([[lot, old]]),
      world: { model: { paintBuilding: vi.fn() } },
      playedS: 100,
      cardAtS: -60,
      deliveredBefore: 3,
      rentLine: null,
      shown: '',
    });
    (u as unknown as { eventTick: () => void }).eventTick();
    expect(card).toHaveBeenCalledOnce();
    expect(card.mock.calls[0][0]).toBe('Your flat needs renovating');
  });
});
