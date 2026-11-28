import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import type { Car } from '../src/game/cars';
import { Game } from '../src/game/game';
import type { LineFeature } from '../src/geo/osm';
import { laneOffset, mayGo, RoadNet } from '../src/game/roads';
import { World } from '../src/game/world';
import { ESCAPE_POINTS, PERFECT_POINTS, type SkillEvent } from '../src/game/skill';

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

const street = (pts: LineFeature['pts'], oneway?: 1 | -1): LineFeature => ({ kind: 'minor', pts, widthM: 6, bridge: false, ...(oneway ? { oneway } : {}) });

describe('one-way streets on the network', () => {
  it('say which way traffic may go, and keep it nearer the middle', () => {
    const net = new RoadNet([street([[0, 0], [100, 0]], 1), street([[0, 50], [100, 50]], -1), street([[0, 100], [100, 100]])], 750);
    const [a, b, c] = net.lines;
    expect([mayGo(a, 1), mayGo(a, -1)]).toEqual([true, false]);
    expect([mayGo(b, 1), mayGo(b, -1)]).toEqual([false, true]);
    expect([mayGo(c, 1), mayGo(c, -1)]).toEqual([true, true]);
    // still to the right, but nearer the middle
    expect(laneOffset(a, 1)).toBeGreaterThan(0.5);
    expect(laneOffset(a, 1)).toBeLessThan(laneOffset(c));
    // a car the wrong way keeps far enough over to pass one coming the right way (cars are under 2.1 m wide)
    expect(laneOffset(a, -1) + laneOffset(a, 1)).toBeGreaterThan(2.1);
    expect(laneOffset(b, 1) + laneOffset(b, -1)).toBeGreaterThan(2.1);
  });
});

describe('traffic on one-way streets', () => {
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

  async function playing(lines: LineFeature[]) {
    const roads = new RoadNet(lines, 750);
    const w = {
      half: 750,
      model: { group: new Group() },
      roads,
      proj: { toLocal: (lon: number, lat: number): [number, number] => [lon, lat], toLngLat: (x: number, y: number) => ({ lon: x, lat: y }) },
      free: () => true,
      groundY: () => 0,
      inWater: () => false,
      inStream: () => false,
      needsRecentre: () => null,
      dispose: vi.fn(),
      sights: [],
      services: [],
      stops: [],
      solids: { push: () => null, inside: () => false, blocked: () => false },
    } as unknown as World;
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    g.car = null;
    g.me.x = 0;
    g.me.y = 0;
    for (const c of g.cars.splice(0)) c.gone = true;
    const inside = g as unknown as { addCar: (k: string, x: number, y: number, th: number) => Car; drive: (c: Car, dt: number) => void; spawnTraffic: (k: string, a: number, b: number) => Car | null };
    return { g, roads, inside };
  }

  it('a car put on one is put the way it goes', async () => {
    const { roads, inside } = await playing([street([[-400, 0], [400, 0]], -1), street([[-400, 300], [400, 300]], 1)]);
    let n = 0;
    for (let k = 0; k < 200 && n < 20; k++) {
      const c = inside.spawnTraffic('sedan', 20, 600);
      if (!c?.path) continue;
      n++;
      const ow = roads.lines[c.path.line].oneway;
      expect(c.path.dir).toBe(ow);
      // and it faces that way
      expect(Math.sign(Math.cos(c.th))).toBe(ow);
      c.gone = true;
    }
    expect(n).toBeGreaterThan(5);
  });

  it('at a junction, a car never turns into one the wrong way', async () => {
    // from the west to a junction: north is one-way towards the junction, south one-way away from it
    const { inside } = await playing([street([[-300, 0], [0, 0]]), street([[0, 0], [0, 300]], -1), street([[0, 0], [0, -300]], 1)]);
    for (let trial = 0; trial < 12; trial++) {
      const c = inside.addCar('sedan', -60, 0, 0);
      c.driver = 'ai';
      for (let k = 0; k < 600 && Math.abs(c.y) < 40; k++) {
        inside.drive(c, 0.05);
        c.step(0.05, (inside as unknown as { world: World }).world);
      }
      expect(c.y).toBeLessThan(-40);
      c.gone = true;
    }
  });

  it('at the end of a street, a sharp turn the right way beats straight on the wrong way', async () => {
    // from the west to the end of a street: on ahead is one-way towards it, back sharply is the only legal way
    const { roads, inside } = await playing([street([[-300, 0], [0, 0]]), street([[0, 0], [250, 40]], -1), street([[0, 0], [-250, 30]], 1)]);
    const hairpin = roads.lines.findIndex((l) => l.pts[l.pts.length - 1][0] === -250);
    for (let trial = 0; trial < 8; trial++) {
      const c = inside.addCar('sedan', -60, 0, 0);
      c.driver = 'ai';
      const went = new Set<number>();
      for (let k = 0; k < 200; k++) {
        inside.drive(c, 0.05);
        c.step(0.05, (inside as unknown as { world: World }).world);
        if (c.path) went.add(c.path.line);
      }
      expect(went.has(hairpin)).toBe(true);
      expect(c.path && roads.lines[c.path.line].oneway === -1).toBe(false);
      c.gone = true;
    }
  });

  it('a car going the wrong way leaves by a street, not into a driveway', async () => {
    // a one-way street east, a driveway off it to the north, a street to the south, both ahead for a car going west
    const drive: LineFeature = { kind: 'service', pts: [[0, 0], [-60, 80]], widthM: 3.5, bridge: false };
    const { roads, inside } = await playing([street([[-300, 0], [300, 0]], 1), drive, street([[0, 0], [-60, -80]])]);
    const south = roads.lines.findIndex((l) => l.pts[l.pts.length - 1][1] === -80);
    for (let trial = 0; trial < 10; trial++) {
      const c = inside.addCar('sedan', 60, 0, Math.PI);
      c.driver = 'ai';
      c.path = { line: 0, s: 360, dir: -1 };
      const went = new Set<number>();
      for (let k = 0; k < 400; k++) {
        inside.drive(c, 0.05);
        c.step(0.05, (inside as unknown as { world: World }).world);
        if (c.path) went.add(c.path.line);
      }
      expect(went.has(south)).toBe(true);
      expect(went.has(1)).toBe(false);
      c.gone = true;
    }
  });
});

describe('the player on one-way streets', () => {
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

  /** You, driving at 10 m/s along a street one-way to the east, and maybe a police car 40 m off. */
  async function driving(east: boolean, cop: boolean, blocked = false) {
    const roads = new RoadNet([street([[-400, 0], [400, 0]], 1), street([[0, -400], [0, 400]])], 750);
    const w = {
      half: 750, model: { group: new Group() }, roads,
      proj: { toLocal: (lon: number, lat: number): [number, number] => [lon, lat], toLngLat: (x: number, y: number) => ({ lon: x, lat: y }) },
      free: () => true, groundY: () => 0, inWater: () => false, inStream: () => false, needsRecentre: () => null, dispose: vi.fn(),
      sights: [], services: [], stops: [],
      solids: { push: () => null, inside: () => false, blocked: () => blocked },
    } as unknown as World;
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    for (const c of g.cars.splice(0)) c.gone = true;
    const inside = g as unknown as { addCar: (k: string, x: number, y: number, th: number) => Car; law: (dt: number) => void; offence: (points: number, text: string) => void; drive: (c: Car, dt: number) => void; clock: number; copT: number };
    // no more police than the test puts there
    inside.copT = 1e9;
    const me = inside.addCar('sedan', 100, 1, east ? 0 : Math.PI);
    me.driver = 'player';
    me.vx = east ? 10 : -10;
    g.car = me;
    if (cop) inside.addCar('police', 140, -1, Math.PI).driver = 'cop';
    return { g, inside, me };
  }

  it('costs nothing the right way, or the wrong way with no police about', async () => {
    for (const [east, cop] of [[true, true], [false, false]] as const) {
      const { g, inside } = await driving(east, cop);
      inside.law(0.05);
      expect(g.heat).toBe(0);
    }
  });

  it('the police follow you when they see you drive the wrong way', async () => {
    const { g, inside } = await driving(false, true);
    inside.law(0.05);
    expect(g.heat).toBeGreaterThan(0);
  });

  it('not when a building is between you', async () => {
    const { g, inside } = await driving(false, true, true);
    inside.law(0.05);
    expect(g.heat).toBe(0);
  });

  /** the law for `seconds`, a twentieth of a second at a time */
  const pass = (inside: { law: (dt: number) => void; clock: number }, seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) {
      inside.clock += 0.05;
      inside.law(0.05);
    }
  };

  it('for the wrong way alone the police never catch you: stopped beside them, a warning and no fine', async () => {
    const { g, inside, me } = await driving(false, true);
    const said: string[] = [];
    g.onToast = (t) => said.push(t);
    const flashed: string[] = [];
    g.onFlash = (t) => flashed.push(t);
    g.cash = 1000;
    g.job = { kind: 'supply', special: true, to: { at: { lon: 0, lat: 0 }, mesh: new Group() } } as unknown as typeof g.job;
    inside.law(0.05);
    expect(g.heat).toBe(1);
    expect(said[0]).toContain('the police follow you');
    // you stop, with the police car right beside you: in a chase that is "Caught!"
    me.vx = 0;
    const cop = g.cars.find((c) => c.driver === 'cop')!;
    cop.x = me.x + 5;
    pass(inside, 2);
    expect(g.heat).toBe(0);
    expect(g.cash).toBe(1000);
    expect(g.job).not.toBeNull();
    expect(flashed).toEqual([]);
    expect(said.at(-1)).toBe('The police let you off with a warning: no fine for the wrong way');
    // and you are still in your car, where you were
    expect(g.car).toBe(me);
  });

  it('they let it go once you drive the right way again, in their sight or out of it', async () => {
    const { g, inside, me } = await driving(false, true);
    const said: string[] = [];
    g.onToast = (t) => said.push(t);
    const lost = vi.fn();
    g.events.push((e) => e.kind === 'lost' && lost());
    inside.law(0.05);
    expect(g.heat).toBe(1);
    // still the wrong way, still seen: they keep following
    pass(inside, 8);
    expect(g.heat).toBe(1);
    // turned round: the right way, with the police car still in sight
    me.vx = 10;
    pass(inside, 3);
    expect(g.heat).toBeGreaterThan(0);
    pass(inside, 3.5);
    expect(g.heat).toBe(0);
    expect(said.at(-1)).toBe('The police let it go');
    // nobody was shaken off: that is for a chase
    expect(lost).not.toHaveBeenCalled();
  });

  it('anything on top of the wrong way makes it a chase: caught then means a fine', async () => {
    const { g, inside, me } = await driving(false, true);
    const flashed: string[] = [];
    g.onFlash = (t) => flashed.push(t);
    g.cash = 1000;
    inside.law(0.05);
    expect(g.heat).toBe(1);
    // a crash while they follow
    inside.clock += 5;
    inside.offence(1, 'That was a crash');
    expect(g.heat).toBe(2);
    me.vx = 0;
    const cop = g.cars.find((c) => c.driver === 'cop')!;
    cop.x = me.x + 5;
    pass(inside, 2);
    expect(flashed).toEqual(['Caught!  −$250']);
    expect(g.cash).toBe(750);
  });

  it('a chase for anything else is as it was: stopped beside the police, caught and fined', async () => {
    const { g, inside, me } = await driving(true, true);
    const flashed: string[] = [];
    g.onFlash = (t) => flashed.push(t);
    g.cash = 1000;
    inside.offence(1, 'You knocked someone over');
    me.vx = 0;
    const cop = g.cars.find((c) => c.driver === 'cop')!;
    cop.x = me.x + 5;
    pass(inside, 2);
    expect(flashed).toEqual(['Caught!  −$250']);
  });

  it('the police car that follows keeps behind you; one that chases comes at you', async () => {
    const speedAt = async (chase: boolean) => {
      const { g, inside } = await driving(false, true);
      inside.law(0.05);
      if (chase) {
        inside.clock += 5;
        inside.offence(1, 'That was a crash');
      }
      // the police car 12 m behind you, going your way at your speed
      const cop = g.cars.find((c) => c.driver === 'cop')!;
      cop.x = 112;
      cop.y = 1;
      cop.th = Math.PI;
      cop.vx = -10;
      for (let i = 0; i < 20; i++) inside.drive(cop, 0.05);
      return cop.controls.throttle;
    };
    // following: nearer than it means to be, it eases off; chasing: foot down
    expect(await speedAt(false)).toBeLessThan(0);
    expect(await speedAt(true)).toBeGreaterThan(0);
  });

  it('shaking off a chase is driving skill, more for more stars; the police letting the wrong way go is not', async () => {
    const { g, inside } = await driving(true, true, true);
    const got: SkillEvent[] = [];
    g.onSkill = (e) => got.push(e);
    inside.offence(2, 'You knocked someone over');
    expect(g.heat).toBe(2);
    pass(inside, 30);
    expect(g.heat).toBe(0);
    expect(got.filter((e) => e.kind === 'bonus')).toMatchObject([{ what: 'escape', points: ESCAPE_POINTS * 2 }]);

    const follow = await driving(false, true);
    const none: SkillEvent[] = [];
    follow.g.onSkill = (e) => none.push(e);
    follow.inside.law(0.05);
    follow.me.vx = 10;
    pass(follow.inside, 8);
    expect(follow.g.heat).toBe(0);
    expect(none.filter((e) => e.kind === 'bonus')).toEqual([]);
  });

  it('a delivery in good time, in the car it came in and without a dent, is a perfect delivery: driving skill', async () => {
    const deliver = async (left: number, kind = 'plain', dent = false, special = false) => {
      const { g, inside, me } = await driving(true, false);
      const got: SkillEvent[] = [];
      g.onSkill = (e) => got.push(e);
      if (dent) me.hp = 80;
      g.job = { kind, to: { at: { lon: 100, lat: 1 }, mesh: new Group() }, left, clock0: 60, pay: 100, metres: 99, hp0: 100, car0: me, ...(special ? { special: true } : {}) } as unknown as typeof g.job;
      (inside as unknown as { jobs: (dt: number) => void }).jobs(0.05);
      expect(g.job).toBeNull();
      return got.filter((e) => e.kind === 'bonus');
    };
    expect(await deliver(40)).toMatchObject([{ what: 'perfect', points: PERFECT_POINTS }]);
    expect(await deliver(40, 'rush')).toMatchObject([{ points: PERFECT_POINTS * 1.5 }]);
    expect(await deliver(40, 'plain', false, true)).toMatchObject([{ points: PERFECT_POINTS * 2 }]);
    // late in the clock, or dented: a delivery, not a perfect one
    expect(await deliver(10)).toEqual([]);
    expect(await deliver(40, 'plain', true)).toEqual([]);
  });

  it('crossing a one-way street at a junction is no offence', async () => {
    const { g, inside, me } = await driving(false, true);
    // on the two-way street going north, right at the junction
    me.x = 0;
    me.y = 0.5;
    me.vx = 0;
    me.vy = 10;
    me.th = Math.PI / 2;
    inside.law(0.05);
    expect(g.heat).toBe(0);
  });
});
