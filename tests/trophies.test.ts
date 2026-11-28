import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL, disc, earnedBy, earnedIn, FAR_KM, GROUPS, readTrophies, SIGHT_POINTS, Trophies, type Snapshot } from '../src/trophies';
import { points } from '../src/guess';

afterEach(() => vi.unstubAllGlobals());

const none: Snapshot = { car: false, delivered: 0, homes: 0, saved: 0, building: false, painted: false, towns: 0, rentPerDay: 0 };
const fresh = (): Trophies => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  return new Trophies();
};

describe('the trophies there are', () => {
  it('thirty, each once, each with a name, a way to earn it and a sign', () => {
    expect(ALL).toHaveLength(30);
    expect(new Set(ALL.map((t) => t.id)).size).toBe(30);
    expect(new Set(ALL.map((t) => t.name)).size).toBe(30);
    for (const t of ALL) {
      expect(t.name.length).toBeGreaterThan(2);
      expect(t.how.length).toBeGreaterThan(5);
      expect(t.sign).toMatch(/^</);
    }
  });

  it('are grey until earned: nothing of the group colour is left on the disc', () => {
    for (const g of GROUPS) {
      for (const t of g.trophies) {
        expect(disc(t, g.colour, false)).not.toContain(g.colour);
        expect(disc(t, g.colour, false)).not.toContain('#16181c');
        expect(disc(t, g.colour, true)).toContain(g.colour);
      }
    }
  });

  it('are read back, every one of them', () => {
    const got = Object.fromEntries(ALL.map((t, i) => [t.id, 20400 + i]));
    expect(readTrophies(JSON.stringify({ v: 1, got, places: [] })).got).toEqual(got);
  });
});

describe('what a player has', () => {
  it('ten homes, five towns, 500 deliveries', () => {
    const nearly = earnedBy({ ...none, homes: 9, towns: 4, delivered: 499 }, 0);
    for (const id of ['homes10', 'towns5', 'deliveries500'] as const) expect(nearly).not.toContain(id);
    expect(earnedBy({ ...none, homes: 10, towns: 5, delivered: 500 }, 0)).toEqual(expect.arrayContaining(['homes5', 'homes10', 'towns2', 'towns5', 'deliveries100', 'deliveries500']));
  });

  it('a party thrown, a home renovated', () => {
    expect(earnedBy({ ...none, homes: 1 }, 0)).toEqual(['home']);
    expect(earnedBy({ ...none, homes: 1, partied: true, renovated: true }, 0)).toEqual(['home', 'renovated', 'party']);
  });

  it('a place played far from the home town', () => {
    expect(earnedBy({ ...none, homes: 1, fromHome: FAR_KM - 1 }, 0)).not.toContain('far');
    expect(earnedBy({ ...none, homes: 1, fromHome: FAR_KM }, 0)).toContain('far');
  });
});

describe('what happens in play', () => {
  const delivered = (job: 'plain' | 'supply' | 'rush' | 'clean', more: { left?: number; dented?: boolean } = {}) => ({ kind: 'delivered' as const, job, left: more.left ?? 5, special: false, dented: more.dented ?? false });

  it('the trophies there were', () => {
    expect(earnedIn({ kind: 'lost' }, true, 'sedan')).toEqual(['lost']);
    expect(earnedIn({ kind: 'run', fined: false }, true, 'sedan')).toEqual(['run', 'clean']);
    expect(earnedIn({ kind: 'run', fined: true }, true, 'sedan')).toEqual(['run']);
    // a run a friend sent, of another length
    expect(earnedIn({ kind: 'run', fined: false }, false, 'sedan')).toEqual([]);
    expect(earnedIn(delivered('rush', { left: 30 }), true, 'sedan')).toEqual(['rush']);
    expect(earnedIn(delivered('rush', { left: 29 }), true, 'sedan')).toEqual([]);
    expect(earnedIn({ kind: 'fined' }, true, 'sedan')).toEqual([]);
    expect(earnedIn(delivered('plain'), true, 'sedan')).toEqual([]);
  });

  it('a supply run with no new dent, in a car', () => {
    expect(earnedIn(delivered('supply'), true, 'van')).toEqual(['supply']);
    expect(earnedIn(delivered('supply', { dented: true }), true, 'van')).toEqual([]);
    // carried the last metres on foot: no car, none to dent
    expect(earnedIn(delivered('supply'), true, null)).toEqual([]);
  });

  it('a police station’s job: delivered means no law was broken', () => {
    expect(earnedIn(delivered('clean'), true, 'sedan')).toEqual(['book']);
    expect(earnedIn(delivered('clean'), true, null)).toEqual(['book']);
  });

  it('a package in a bus, whatever the job', () => {
    expect(earnedIn(delivered('plain'), true, 'bus')).toEqual(['bus']);
    expect(earnedIn(delivered('supply'), true, 'bus')).toEqual(['supply', 'bus']);
    // the party's food is no package: it brings no such event; a run's end in a bus is the run's alone
    expect(earnedIn({ kind: 'run', fined: false }, true, 'bus')).toEqual(['run', 'clean']);
  });

  it('the car looked for, back at its ring', () => {
    expect(earnedIn({ kind: 'found' }, true, 'sport')).toEqual(['found']);
  });
});

describe('places', () => {
  it('north and south of the equator', () => {
    const t = fresh();
    const said: string[][] = [];
    t.onEarned = (n) => said.push(n);
    t.visit(49.45, 11.08);
    t.visit(52.52, 13.4);
    expect(t.across()).toBe(false);
    expect(t.check(none)).toEqual([]);
    // Rio de Janeiro
    t.visit(-22.91, -43.2);
    expect(t.across()).toBe(true);
    expect(t.check(none, new Date(2026, 10, 28, 12).getTime())).toEqual(['equator']);
    expect(t.day('equator')).toBe(Date.UTC(2026, 10, 28) / 86400000);
    // once
    t.visit(-33.87, 151.21);
    expect(t.check(none)).toEqual([]);
    expect(said).toEqual([['Across the equator']]);
  });

  it('south first, then north', () => {
    const t = fresh();
    t.visit(-33.87, 151.21);
    expect(t.across()).toBe(false);
    t.visit(35.68, 139.76);
    expect(t.across()).toBe(true);
  });

  it('a player who is further on earns what fits at once, in one line', () => {
    // played before this update: Nuremberg, New York and Rio are kept, nothing of the new trophies
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ v: 1, got: { car: 20415, homes5: 20415 }, places: ['49.45,11.08', '40.71,-74.01', '-22.91,-43.20'] }), setItem: vi.fn() });
    const t = new Trophies();
    const said: string[][] = [];
    t.onEarned = (n) => said.push(n);
    t.visit(49.45, 11.08);
    t.check({ ...none, car: true, homes: 10, towns: 5, delivered: 500, partied: true, renovated: true, fromHome: t.furthest(49.45, 11.08) });
    expect(said).toHaveLength(1);
    expect(said[0]).toEqual(expect.arrayContaining(['Ten homes', 'Five towns', 'Good as new', 'Full house', '500 deliveries', 'Far from home', 'Across the equator']));
  });

  it('count for the equator and for the furthest though no more places are kept', () => {
    // forty places kept, all in the north, each a town apart
    const places = Array.from({ length: 40 }, (_, i) => `${(40 + (i % 8)).toFixed(2)},${(Math.floor(i / 8) * 2).toFixed(2)}`);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ v: 1, got: {}, places }), setItem: vi.fn() });
    const t = new Trophies();
    expect(t.placesCount()).toBe(40);
    // from Nuremberg, nothing kept is far
    expect(t.furthest(49.45, 11.08)).toBeLessThan(2000);
    // Cape Town: not kept, and it counts all the same
    expect(t.across()).toBe(false);
    t.visit(-33.92, 18.42);
    expect(t.placesCount()).toBe(40);
    expect(t.across()).toBe(true);
    expect(t.furthest(49.45, 11.08)).toBeGreaterThan(9000);
  });

  it('a place kept that is no point spoils nothing', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ v: 1, got: {}, places: ['here', '49.45,11.08', '-22.91'] }), setItem: vi.fn() });
    const t = new Trophies();
    expect(t.furthest(49.45, 11.08)).toBeLessThan(1);
    expect(t.across()).toBe(false);
    t.visit(40.71, -74.01);
    expect(t.furthest(49.45, 11.08)).toBeGreaterThan(6000);
  });

  it('the furthest place played from a point, in km', () => {
    const t = fresh();
    expect(t.furthest(49.45, 11.08)).toBe(0);
    t.visit(49.45, 11.08);
    expect(t.furthest(49.45, 11.08)).toBeLessThan(1);
    // Berlin: about 380 km; New York: about 6,400 km
    t.visit(52.52, 13.4);
    expect(t.furthest(49.45, 11.08)).toBeGreaterThan(350);
    expect(t.furthest(49.45, 11.08)).toBeLessThan(FAR_KM);
    t.visit(40.71, -74.01);
    expect(t.furthest(49.45, 11.08)).toBeGreaterThan(6000);
    expect(earnedBy({ ...none, homes: 1, fromHome: t.furthest(49.45, 11.08) }, t.placesCount())).toContain('far');
  });
});

describe('Where am I?', () => {
  it('"At first sight" is the right city within 50 seconds and no wrong pick', () => {
    expect(points(50, 0)).toBeGreaterThanOrEqual(SIGHT_POINTS);
    expect(points(51, 0)).toBeLessThan(SIGHT_POINTS);
    expect(points(0, 1)).toBeLessThan(SIGHT_POINTS);
  });
});
