import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Game } from '../src/game/game';
import { PointGrid } from '../src/game/services';
import { arriveLine, backBy } from '../src/partyUi';
import { RoadNet } from '../src/game/roads';
import { World } from '../src/game/world';
import { foodName, narrowWalk, occasion, packParty, partyClock, pickFood, pointsDue, readParties, readParty, PARTY_FAR, PARTY_NEAR, WALK_MAX, type SentParty } from '../src/game/party';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      shadowMap = {};
      setPixelRatio() {}
      setSize() {}
      getContext() { return { MAX_TEXTURE_SIZE: 0, getParameter: () => 4096 }; }
    },
  };
});

describe('the food place of a party', () => {
  it('is a real one at a fitting distance by road, nearest 800 m', () => {
    const got = pickFood([
      { metres: 300, id: 'near' },
      { metres: 700, id: 'good' },
      { metres: 1100, id: 'far' },
      { metres: 820, id: 'made up', invented: true },
    ]);
    expect(got?.id).toBe('good');
  });

  it('a made-up one only where no real one fits', () => {
    expect(pickFood([{ metres: 200, id: 'real' }, { metres: 900, id: 'made up', invented: true }])?.id).toBe('made up');
  });

  it('never one right at the door: the food would be delivered as it is picked up', () => {
    expect(pickFood([{ metres: 10, id: 'next door' }])).toBeNull();
    expect(pickFood([{ metres: 10, id: 'next door' }, { metres: 200, id: 'round the corner' }])?.id).toBe('round the corner');
  });

  it('else whichever is nearest the range, and none when there is none', () => {
    expect(pickFood([{ metres: 100, id: 'a' }, { metres: PARTY_NEAR - 50, id: 'b' }, { metres: PARTY_FAR + 400, id: 'c' }])?.id).toBe('b');
    expect(pickFood([])).toBeNull();
  });

  it('a clock quicker than a plain job: about 110 s for 800 m', () => {
    expect(partyClock(800)).toBe(109);
    expect(partyClock(0)).toBe(20);
    expect(partyClock(-5)).toBe(20);
  });

  it('a walk up a narrow lane gets time: to park, and to walk', () => {
    expect(partyClock(800, 100)).toBe(Math.round(20 + 800 / 9 + 6 + 100 / 6));
    expect(partyClock(800, 0)).toBe(partyClock(800));
  });

  it('words for the food and the evening', () => {
    expect(foodName('restaurant')).toBe('the pizza');
    expect(foodName('shop')).toBe('the drinks and snacks');
    expect(occasion(1)).toBe('games night');
    expect(occasion(99)).toBe('party');
  });
});

describe('a lane too narrow for a car', () => {
  // the way from the pickup (x = -400) to the door (x = 0), along a street
  const way: Array<[number, number]> = [[-400, 0], [-100, 0], [0, 0]];

  it('a car gets all the way: no walk', () => {
    expect(narrowWalk(way, () => true)).toBeNull();
  });

  it('the lane gets narrow 80 m before the door: walk 80 m, the car stops a few metres before', () => {
    const n = narrowWalk(way, (x) => x < -80);
    expect(n?.walk).toBeCloseTo(80, 0);
    expect(n!.stop[0]).toBeLessThan(-80);
    expect(n!.stop[0]).toBeGreaterThan(-90);
  });

  it('a corner grazing the way does not count: the car must not fit for a few metres', () => {
    expect(narrowWalk(way, (x) => Math.abs(x + 50) >= 1.5)).toBeNull();
  });

  it('only the last stretch before the door is looked at: further out the player picks their own way', () => {
    expect(narrowWalk(way, (x) => x > -380 || x < -390)).toBeNull();
  });

  it('a long narrow way says how long, so the party can use the corner instead of an endless walk', () => {
    const n = narrowWalk(way, (x) => x < -250);
    expect(n!.walk).toBeGreaterThan(WALK_MAX);
  });

  it('a gate or an arch with an ordinary street after it is no walk: a car gets round it', () => {
    expect(narrowWalk(way, (x) => x < -256 || x > -250)).toBeNull();
    // but a lane narrow from the arch to the door is
    expect(narrowWalk(way, (x) => x < -256)?.walk).toBeCloseTo(256, -1);
  });

  it('a little square in the middle of narrow lanes does not end the walk', () => {
    const n = narrowWalk(way, (x) => x < -120 || (x > -80 && x < -70));
    expect(n?.walk).toBeCloseTo(120, -1);
  });

  it('a lane narrow for longer than the stretch looked at: the car stops where it really gets narrow, never inside it', () => {
    const n = narrowWalk(way, (x) => x < -380);
    expect(n!.walk).toBeGreaterThan(370);
    expect(n!.stop[0]).toBeLessThan(-380);
  });
});

describe('a link sent back with a friend’s time', () => {
  const base = { name: 'Lena', by: 'Lena', seconds: 100, place: 'Nuremberg', occasion: 1, food: 'restaurant' as const, invented: false, home: { lat: 49, lon: 11 }, door: { lat: 49, lon: 11 }, shop: { lat: 49, lon: 11 }, pick: { lat: 49, lon: 11 }, walk: 0, corner: false, back: false };
  it('the host’s own invitation names no one who sent a time back', () => {
    expect(backBy(base)).toBe('');
    expect(arriveLine(base)).toBe('Lena’s games night: you are invited');
  });
  it('a friend’s time sent back: theirs to beat, never the host’s', () => {
    expect(backBy({ ...base, by: 'a friend', seconds: 95, back: true })).toBe('a friend');
    expect(arriveLine({ ...base, by: 'Max', seconds: 95, back: true })).toBe('Max’s time to beat: 1:35');
  });

  it('a guest with the host’s own name is still a guest: the link says so, not the names', () => {
    expect(arriveLine({ ...base, name: 'Sam', by: 'Sam', back: true })).toBe('Sam’s time to beat: 1:40');
    expect(readParty(packParty({ ...base, back: true }))?.back).toBe(true);
    expect(readParty(packParty(base))?.back).toBe(false);
  });
});

describe('places near a spot, from a grid', () => {
  it('finds what lies within the distance, and only that', () => {
    const grid = new PointGrid<{ x: number; y: number; k: string }>(60);
    grid.add({ x: 0, y: 0, k: 'a' });
    grid.add({ x: 59, y: 59, k: 'b' });
    expect(grid.near(55, 55, 10)).toBe(true);
    expect(grid.near(30, 30, 10)).toBe(false);
    expect(grid.near(-50, 0, 60)).toBe(true);
    expect(grid.near(-50, 0, 60, (p) => p.k === 'b')).toBe(false);
  });
});

describe('points from parties', () => {
  it('the first party of a day pays, the next that day does not', () => {
    const p = readParties(null);
    expect(pointsDue(p, '2026-11-23')).toBe(true);
    expect(pointsDue({ ...p, paid: '2026-11-23' }, '2026-11-23')).toBe(false);
    expect(pointsDue({ ...p, paid: '2026-11-23' }, '2026-11-24')).toBe(true);
  });

  it('what is kept is read back, and anything else is dropped', () => {
    const kept = readParties(
      JSON.stringify({
        paid: '2026-11-23',
        places: { a: { food: 'shop', invented: false, shop: { lat: 49.45, lon: 11.07 }, pick: { lat: 49.4501, lon: 11.0701 } }, b: { food: 'bar', shop: {}, pick: {} } },
        best: { a: 101.6, b: -3, c: 'x' },
        warned: true,
      }),
    );
    expect(kept.paid).toBe('2026-11-23');
    expect(Object.keys(kept.places)).toEqual(['a']);
    expect(kept.places.a.lane).toBeUndefined();
    const lane = readParties(JSON.stringify({ places: { a: { food: 'restaurant', shop: { lat: 1, lon: 1 }, pick: { lat: 1, lon: 1 }, lane: { walk: 900, corner: false, door: { lat: 1, lon: 1 } } } } }));
    // a walk kept with a home is never longer than a party asks for
    expect(lane.places.a.lane?.walk).toBe(WALK_MAX);
    expect(kept.best).toEqual({ a: 102 });
    expect(kept.warned).toBe(true);
    expect(readParties('{"paid":"yesterday"}').paid).toBe('');
    expect(readParties('not json')).toEqual({ paid: '', places: {}, best: {}, warned: false });
  });
});

describe('a party in a link', () => {
  const party: SentParty = {
    name: 'Lena',
    by: 'Lena',
    seconds: 102,
    place: 'Nuremberg',
    occasion: 1,
    food: 'restaurant',
    invented: false,
    home: { lat: 49.45212, lon: 11.07671 },
    door: { lat: 49.45218, lon: 11.07655 },
    shop: { lat: 49.45801, lon: 11.0812 },
    pick: { lat: 49.4579, lon: 11.08111 },
    walk: 0,
    corner: false,
    back: false,
  };

  it('comes back as it was sent, in letters a link carries', () => {
    const code = packParty(party);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(readParty(code)).toEqual(party);
  });

  it('carries the walk up a narrow lane, never longer than a party asks for', () => {
    expect(readParty(packParty({ ...party, walk: 85 }))?.walk).toBe(85);
    expect(readParty(packParty({ ...party, walk: 5000 }))?.walk).toBe(WALK_MAX);
    expect(readParty(packParty({ ...party, corner: true }))?.corner).toBe(true);
  });

  it('works far north, where a degree of longitude is short', () => {
    const north = { ...party, home: { lat: 78.22, lon: 15.65 }, door: { lat: 78.22, lon: 15.65 }, shop: { lat: 78.22, lon: 15.705 }, pick: { lat: 78.22, lon: 15.704 } };
    expect(readParty(packParty(north))?.shop.lon).toBeCloseTo(15.705, 4);
  });

  it('never cuts a name in half', () => {
    const got = readParty(packParty({ ...party, name: 'Lena 🎉🎉', place: `${'a'.repeat(39)}🎉` }));
    expect(got?.place).toBe(`${'a'.repeat(39)}🎉`);
    expect(got?.name).toBe('Lena 🎉🎉');
  });

  it('carries a friend sending their time back: still the host’s party', () => {
    const back = readParty(packParty({ ...party, by: 'Max', seconds: 95 }));
    expect(back?.name).toBe('Lena');
    expect(back?.by).toBe('Max');
    expect(back?.seconds).toBe(95);
  });

  it('is not read from anything else', () => {
    expect(readParty('')).toBeNull();
    expect(readParty('nonsense!')).toBeNull();
    // a food place far from the home
    expect(readParty(packParty({ ...party, shop: { lat: 50.5, lon: 11 } }))).toBeNull();
    // a challenge link's code is not a party
    const challenge = btoa(JSON.stringify([2, 'x', 1, 1, 'y', 0, 0, 0, 0, 0, 0, 'p'])).replace(/=+$/, '');
    expect(readParty(challenge)).toBeNull();
  });
});

describe('a party in the game', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { webdriver: true });
    vi.stubGlobal('location', { search: '' });
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('ResizeObserver', class { observe() {} });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function playing() {
    const w = {
      half: 750,
      model: { group: new Group() },
      roads: new RoadNet([{ kind: 'minor', pts: [[-600, 0], [600, 0]], widthM: 6, bridge: false }], 750),
      proj: { toLocal: (lon: number, lat: number): [number, number] => [lon, lat], toLngLat: (x: number, y: number) => ({ lon: x, lat: y }) },
      free: () => true,
      groundY: () => 0,
      needsRecentre: () => null,
      dispose: vi.fn(),
      sights: [],
      services: [],
    } as unknown as World;
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    g.car = null;
    g.me.x = 0;
    g.me.y = 0;
    const jobs = (dt = 0.016) => (g as unknown as { jobs: (dt: number) => void }).jobs.call(g, dt);
    const pickups = () => (g as unknown as { pickups: Array<{ at: { lon: number; lat: number }; mesh: Group; kind?: string }> }).pickups;
    return { g, jobs, pickups };
  }

  it('one ring at the food place, and nothing else: no run, no station', async () => {
    const { g, jobs, pickups } = await playing();
    g.newRun();
    g.startParty({ pick: { lon: 400, lat: 0 }, door: { lon: -300, lat: 0 }, say: 'The pizza is on board' });
    expect(g.run.over).toBe(true);
    jobs();
    jobs();
    expect(pickups().map((m) => m.at)).toEqual([{ lon: 400, lat: 0 }]);
    expect(g.job).toBeNull();
  });

  it('the food on board: to the door on its clock, no pay, and the time from the pickup', async () => {
    const { g, jobs } = await playing();
    const ended = vi.fn();
    g.onPartyEnd = ended;
    const cash = g.cash;
    g.startParty({ pick: { lon: 0, lat: 0 }, door: { lon: -300, lat: 0 }, say: 'The pizza is on board' });
    jobs();
    jobs();
    expect(g.job?.party).toBe(true);
    expect(g.job?.pay).toBe(0);
    expect(g.job?.clock0).toBe(partyClock(300));
    expect(g.hud().job?.party).toBe(true);
    // 30 seconds on the way, then at the door
    jobs(30);
    g.me.x = -300;
    jobs();
    expect(ended).toHaveBeenCalledOnce();
    expect(ended.mock.calls[0][0]).toBe('done');
    expect(ended.mock.calls[0][1]).toBeCloseTo(30, 0);
    expect(g.cash).toBe(cash);
    expect(g.party).toBeNull();
    expect(g.job).toBeNull();
  });

  it('a walk at the end: more time on the clock', async () => {
    const { g, jobs } = await playing();
    g.startParty({ pick: { lon: 0, lat: 0 }, door: { lon: -300, lat: 0 }, say: '', walk: 90 });
    jobs();
    jobs();
    expect(g.job?.clock0).toBe(partyClock(300, 90));
  });

  it('gets cold when the clock runs out', async () => {
    const { g, jobs } = await playing();
    const ended = vi.fn();
    g.onPartyEnd = ended;
    g.startParty({ pick: { lon: 0, lat: 0 }, door: { lon: -300, lat: 0 }, say: '' });
    jobs();
    jobs();
    jobs(partyClock(300) + 1);
    expect(ended).toHaveBeenCalledWith('cold', 0);
    expect(g.party).toBeNull();
  });

  it('caught with the food on board: it is lost, and the party says so', async () => {
    const { g, jobs } = await playing();
    const ended = vi.fn();
    g.onPartyEnd = ended;
    g.startParty({ pick: { lon: 0, lat: 0 }, door: { lon: -300, lat: 0 }, say: '' });
    jobs();
    jobs();
    expect(g.job?.party).toBe(true);
    (g as unknown as { fine: (title: string, share: number) => void }).fine('Caught!', 0.25);
    expect(ended).toHaveBeenCalledWith('lost', 0);
    expect(g.party).toBeNull();
    expect(g.job).toBeNull();
  });

  it('caught before the pickup: nothing is lost, the party goes on', async () => {
    const { g, jobs } = await playing();
    const ended = vi.fn();
    g.onPartyEnd = ended;
    g.startParty({ pick: { lon: 400, lat: 0 }, door: { lon: -300, lat: 0 }, say: '' });
    jobs();
    (g as unknown as { fine: (title: string, share: number) => void }).fine('Caught!', 0.25);
    expect(ended).not.toHaveBeenCalled();
    expect(g.party).not.toBeNull();
  });

  it('called off, or a new run: the party is gone, with its ring', async () => {
    const { g, jobs, pickups } = await playing();
    g.startParty({ pick: { lon: 400, lat: 0 }, door: { lon: -300, lat: 0 }, say: '' });
    jobs();
    g.endParty();
    expect(g.party).toBeNull();
    expect(pickups()).toEqual([]);
    g.startParty({ pick: { lon: 400, lat: 0 }, door: { lon: -300, lat: 0 }, say: '' });
    g.newRun();
    expect(g.party).toBeNull();
  });

  it('the arrow shows the food place, not another way the homes asked for', async () => {
    const { g, jobs } = await playing();
    g.guide = { x: -500, y: 0 };
    g.startParty({ pick: { lon: 400, lat: 0 }, door: { lon: -300, lat: 0 }, say: '' });
    jobs();
    expect(g.hud().target?.kind).toBe('job');
    expect(g.hud().target?.metres).toBeCloseTo(400, 0);
  });
});
