import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyReady, deliveries, deliveriesFor, earn, flatsFree, pointsFor, POINTS_MAX, readDaily, readPoints } from '../src/game/homePoints';
import { HomesUi } from '../src/homesUi';
import { dayOf, type Home, type Lot } from '../src/game/homes';
import { earnedBy, readTrophies, Trophies, type Snapshot } from '../src/trophies';

afterEach(() => vi.unstubAllGlobals());

describe('home points', () => {
  it('a flat takes 2, a house 10, a whole building 2 for each flat it adds', () => {
    expect(pointsFor('flat')).toBe(2);
    expect(pointsFor('house')).toBe(10);
    expect(pointsFor('building', 5)).toBe(10);
    expect(pointsFor('building', 400)).toBeGreaterThan(POINTS_MAX);
  });

  it('come one for each delivery, and no more than 20 wait', () => {
    expect(earn(3, 2)).toBe(5);
    expect(earn(19, 5)).toBe(POINTS_MAX);
    expect(earn(4, -3)).toBe(4);
    expect(flatsFree(7)).toBe(3);
    expect(deliveries(1)).toBe('1 more delivery');
    expect(deliveries(10)).toBe('10 more deliveries');
  });

  it('one flat or house a day is free, once a delivery has been made that day', () => {
    const today = '2026-11-24';
    expect(dailyReady({ used: '', played: today }, today)).toBe(true);
    expect(dailyReady({ used: '', played: '2026-11-23' }, today)).toBe(false);
    expect(dailyReady({ used: today, played: today }, today)).toBe(false);
    // a flat with no points: one delivery away before the day's first delivery, none after it
    expect(deliveriesFor(0, 2, { used: '', played: '' }, today, true)).toBe(1);
    expect(deliveriesFor(0, 2, { used: '', played: today }, today, true)).toBe(0);
    expect(deliveriesFor(0, 10, { used: '', played: today }, today, true)).toBe(0);
    // taken today, or a whole building: only points count
    expect(deliveriesFor(0, 2, { used: today, played: today }, today, true)).toBe(2);
    expect(deliveriesFor(3, 8, { used: '', played: today }, today, false)).toBe(5);
  });

  it('reads what is kept, and nothing odd', () => {
    expect(readDaily('{"v":1,"points":3,"used":"2026-11-23","played":"2026-11-24"}')).toEqual({ used: '2026-11-23', played: '2026-11-24' });
    expect(readDaily('{"used":"yesterday"}')).toEqual({ used: '', played: '' });
    expect(readPoints('{"v":1,"points":7}')).toBe(7);
    expect(readPoints('{"v":1,"points":999}')).toBe(POINTS_MAX);
    expect(readPoints('{"points":-4}')).toBe(0);
    expect(readPoints('nonsense')).toBe(0);
  });
});

describe('buying with home points', () => {
  const home: Home = { id: '1', lat: 49, lon: 11, kind: 'flat', paid: 700, rent: 168, street: '', place: '', at: 0 };
  const lot = (id: string, units = 4): Lot => ({ id, x: 0, y: 0, poly: { outer: [[0, 0], [10, 0], [10, 10]], holes: [] }, kind: 'flats', floors: 3, units, price: 700, whole: 700 * units, street: '' });
  const ui = (points: number, homes: Home[], reno: unknown = { stage: 'done' }) => {
    vi.stubGlobal('navigator', { webdriver: true });
    // the house drawn for a new home's mark: a canvas that draws nothing
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) });
    const game = { cash: 100_000 };
    const u: HomesUi = Object.assign(Object.create(HomesUi.prototype), {
      host: { game, save: vi.fn(), toast: vi.fn(), place: () => 'Nuremberg' },
      homes: { v: 1, homes, paidDay: '2026-11-23' },
      owned: new Map(),
      marks: new Map(),
      world: { proj: { toLngLat: () => ({ lat: 49, lon: 11 }) }, mark: () => ({ remove: () => undefined }) },
      reno,
      points,
      daily: { used: '', played: '' },
      saved: 0,
      payRent: vi.fn(() => 0),
      look: vi.fn(),
    });
    return { u, game };
  };

  it('a flat needs 2 points, and takes them', () => {
    const short = ui(1, [home]);
    expect(short.u.buy(lot('a'), 'flat')).toBe(false);
    expect(short.game.cash).toBe(100_000);
    const enough = ui(5, [home]);
    expect(enough.u.buy(lot('b'), 'flat')).toBe(true);
    expect(enough.u.pointsNow()).toBe(3);
  });

  it('the day\'s free home: a flat with no points after a delivery today, once', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const { u } = ui(0, [home]);
    const today = dayOf(Date.now());
    Object.assign(u, { daily: { used: '', played: '' } });
    expect(u.buy(lot('d'), 'flat')).toBe(false);
    Object.assign(u, { daily: { used: '', played: today } });
    expect(u.buy(lot('e'), 'flat')).toBe(true);
    expect(u.pointsNow()).toBe(0);
    expect(u.dailyNow()).toBe('used');
    expect(u.buy(lot('f'), 'flat')).toBe(false);
  });

  it('the first home takes none', () => {
    const { u } = ui(0, [], null);
    vi.spyOn(u as unknown as { setReno: () => void }, 'setReno').mockImplementation(() => undefined);
    Object.assign(u, { dropArea: vi.fn(), showBanks: vi.fn() });
    expect(u.buy(lot('c'), 'flat')).toBe(true);
    expect(u.pointsNow()).toBe(0);
  });
});

describe('trophies', () => {
  const none: Snapshot = { car: false, delivered: 0, homes: 0, saved: 0, building: false, painted: false, towns: 0, rentPerDay: 0 };

  it('are earned by what the player has done', () => {
    expect(earnedBy(none, 0)).toEqual([]);
    expect(earnedBy({ ...none, car: true, delivered: 1, homes: 1 }, 1)).toEqual(['car', 'delivery', 'home']);
    expect(earnedBy({ ...none, homes: 5, towns: 2, rentPerDay: 1200, delivered: 100 }, 5)).toEqual(expect.arrayContaining(['homes5', 'towns2', 'rent1000', 'deliveries100', 'places5']));
  });

  it('are kept with the day, once each', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const t = new Trophies();
    const said: string[][] = [];
    t.onEarned = (n) => said.push(n);
    const day = new Date(2026, 10, 23, 12).getTime();
    expect(t.give(['car', 'car', 'lost'], day)).toEqual(['car', 'lost']);
    expect(t.give(['car'], day)).toEqual([]);
    expect(said).toEqual([['First car', 'Shaken off']]);
    expect(t.day('car')).toBe(Date.UTC(2026, 10, 23) / 86400000);
  });

  it('count places a town apart once', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const t = new Trophies();
    // 200 m apart, across a line a rounding would have drawn: one place
    t.visit(52.374, 4.9);
    t.visit(52.376, 4.9);
    expect(t.placesCount()).toBe(1);
    // Fürth is about 7 km from Nuremberg's middle: the same place; Berlin is another
    t.visit(49.45, 11.08);
    t.visit(49.477, 10.989);
    t.visit(52.52, 13.4);
    expect(t.placesCount()).toBe(3);
  });

  it('read what is kept, and nothing odd', () => {
    expect(readTrophies('{"v":1,"got":{"car":20415,"odd":3},"places":["1,2",5]}')).toEqual({ got: { car: 20415 }, places: ['1,2'] });
    expect(readTrophies('nonsense')).toEqual({ got: {}, places: [] });
  });
});
