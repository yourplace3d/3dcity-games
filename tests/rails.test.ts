import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Car, collideCars } from '../src/game/cars';
import { Game } from '../src/game/game';
import type { LineFeature } from '../src/geo/osm';
import { RoadNet } from '../src/game/roads';
import { World } from '../src/game/world';

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

/** A tram track: straight, a quarter circle of 25 m, straight again. */
function curve(): LineFeature {
  const pts: Array<[number, number]> = [[-200, 0]];
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * (Math.PI / 2);
    pts.push([25 * Math.sin(a), 25 - 25 * Math.cos(a)]);
  }
  pts.push([25, 225]);
  return { kind: 'rail', pts, widthM: 1.6, bridge: false };
}

describe('a tram on its rails', () => {
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

  async function world() {
    // and a street, for the game to put you down on
    const roads = new RoadNet([curve(), { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false }], 750);
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
      solids: { push: () => null },
    } as unknown as World;
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    const inside = g as unknown as { addCar: (k: string, x: number, y: number, th: number) => Car; drive: (c: Car, dt: number) => void; onRails: (c: Car, dt: number) => void };
    return { w, roads, inside };
  }

  /** How far off the rails a tram gets from a start: the worst angle (degrees) and distance (m). */
  async function run(x: number, y: number, th: number, steps: number) {
    const { w, roads, inside } = await world();
    const tram = inside.addCar('tram', x, y, th);
    tram.driver = 'ai';
    let worst = 0;
    let off = 0;
    for (let k = 0; k < steps; k++) {
      inside.drive(tram, 0.05);
      tram.step(0.05, w);
      inside.onRails(tram, 0.05);
      const n = roads.nearest(tram.x, tram.y, 20, 'tram')!;
      const [hx, hy] = roads.heading({ line: n.line, s: n.s, dir: 1 });
      const a = Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.cos(tram.th) * hy - Math.sin(tram.th) * hx))));
      worst = Math.max(worst, (a * 180) / Math.PI);
      off = Math.max(off, n.d);
    }
    return { worst, off, tram };
  }

  it('put on its rails in the middle of a bend, it lies along them from the start', async () => {
    // half way round the bend, facing along it
    const a = Math.PI / 4;
    const { worst, off } = await run(25 * Math.sin(a), 25 - 25 * Math.cos(a), a, 120);
    expect(worst).toBeLessThan(4);
    expect(off).toBeLessThan(1);
  });

  it('a car that hits it takes all of the push, and the knock slows it a little; a wreck is pushed like any car', () => {
    const tram = new Car('tram');
    tram.driver = 'ai';
    tram.rail = { p: { line: 0, s: 0, dir: 1 }, world: {} as World, trail: [[0, 0]] };
    // head-on into its front
    const car = new Car('sedan');
    car.x = 9.6;
    car.vx = -8;
    collideCars(tram, car);
    expect([tram.x, tram.y, tram.th]).toEqual([0, 0, 0]);
    expect(car.x).toBeGreaterThan(9.6);
    // the car bounces back; the tram, far heavier, is slowed a little
    expect(car.vx).toBeGreaterThan(0);
    expect(tram.vx).toBeLessThan(0);
    expect(tram.vx).toBeGreaterThan(-1.5);
    tram.hp = 0;
    car.x = 9.6;
    collideCars(tram, car);
    expect(Math.hypot(tram.x, tram.y)).toBeGreaterThan(0);
  });

  it('where two tram lines only cross, it goes straight over', async () => {
    const { w, roads, inside } = await world();
    // a line across the bend's straight start, at right angles
    const cross = new RoadNet([curve(), { kind: 'rail', pts: [[-100, -100], [-100, 100]], widthM: 1.6, bridge: false }, { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false }], 750);
    (w as unknown as { roads: RoadNet }).roads = cross;
    void roads;
    for (let trial = 0; trial < 30; trial++) {
      const tram = inside.addCar('tram', -160, 0, 0);
      tram.driver = 'ai';
      for (let k = 0; k < 800 && tram.x < -80; k++) {
        inside.drive(tram, 0.05);
        tram.step(0.05, w);
        inside.onRails(tram, 0.05);
      }
      // past the crossing, still on its own line
      expect(tram.x).toBeGreaterThan(-90);
      expect(Math.abs(tram.y)).toBeLessThan(2);
      tram.gone = true;
    }
  });

  it('round a bend, the body stays along the rails and on them', async () => {
    // and a street, for the game to put you down on
    const roads = new RoadNet([curve(), { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false }], 750);
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
      solids: { push: () => null },
    } as unknown as World;
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    const inside = g as unknown as { addCar: (k: string, x: number, y: number, th: number) => Car; drive: (c: Car, dt: number) => void; onRails: (c: Car, dt: number) => void };
    const tram = inside.addCar('tram', -120, 0, 0);
    tram.driver = 'ai';
    let worst = 0;
    let off = 0;
    let passed = false;
    for (let k = 0; k < 1200; k++) {
      inside.drive(tram, 0.05);
      tram.step(0.05, w);
      inside.onRails(tram, 0.05);
      const n = roads.nearest(tram.x, tram.y, 20, 'tram')!;
      const [hx, hy] = roads.heading({ line: n.line, s: n.s, dir: 1 });
      const a = Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.cos(tram.th) * hy - Math.sin(tram.th) * hx))));
      worst = Math.max(worst, (a * 180) / Math.PI);
      off = Math.max(off, n.d);
      if (tram.y > 60) passed = true;
    }
    // it went round the bend
    expect(passed).toBe(true);
    // the body is the chord between its bogies: along the rails within a few degrees, its middle within
    // the bend's sagitta (6.65 m bogies on a 25 m bend: under a metre)
    expect(worst).toBeLessThan(4);
    expect(off).toBeLessThan(1);
  });

  it('two trams that meet head on, on one track, do not stand there for good', async () => {
    const { w, inside } = await world();
    const a = inside.addCar('tram', -170, 0, 0);
    const b = inside.addCar('tram', -110, 0, Math.PI);
    for (const t of [a, b]) t.driver = 'ai';
    let met = -1;
    let travelled = 0;
    for (let k = 0; k < 1600; k++) {
      const before = [a.x, a.y, b.x, b.y];
      for (const t of [a, b]) inside.drive(t, 0.05);
      for (const t of [a, b]) t.step(0.05, w);
      collideCars(a, b);
      for (const t of [a, b]) inside.onRails(t, 0.05);
      if (met < 0 && Math.hypot(a.x - b.x, a.y - b.y) < 30) met = k;
      // once they have met, how far they go from there
      if (met >= 0 && k > met + 100) travelled += Math.hypot(a.x - before[0], a.y - before[1]) + Math.hypot(b.x - before[2], b.y - before[3]);
    }
    expect(met).toBeGreaterThanOrEqual(0);
    expect(travelled).toBeGreaterThan(80);
  });

  it('at the end of its track it stops and turns, and never doubles back onto a line that touches it', async () => {
    const { w, inside } = await world();
    const net = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [0, 0]], widthM: 1.6, bridge: false },
      // a line touching its end and running back at a sharp angle, as two legs of a loop drawn apart
      { kind: 'rail', pts: [[0, 0], [-200, 50]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    (w as unknown as { roads: RoadNet }).roads = net;
    const tram = inside.addCar('tram', -150, 0, 0);
    tram.driver = 'ai';
    let worst = 0;
    for (let k = 0; k < 900; k++) {
      inside.drive(tram, 0.05);
      tram.step(0.05, w);
      inside.onRails(tram, 0.05);
      // along the first line, one way or the other
      worst = Math.max(worst, Math.abs(Math.sin(tram.th)));
    }
    expect(worst).toBeLessThan(Math.sin((10 * Math.PI) / 180));
    expect(Math.abs(tram.y)).toBeLessThan(1);
  });

  it('a tram held up does not turn round because one passes on the other track', async () => {
    const { w, inside } = await world();
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [300, 0]], widthM: 1.6, bridge: false },
      { kind: 'rail', pts: [[-300, 3.2], [300, 3.2]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    const a = inside.addCar('tram', -100, 0, 0);
    a.driver = 'ai';
    // a car stands on its rails ahead
    inside.addCar('sedan', -82, 0, 0);
    const b = inside.addCar('tram', -40, 3.2, Math.PI);
    b.driver = 'ai';
    for (let k = 0; k < 240; k++) {
      for (const t of [a, b]) inside.drive(t, 0.05);
      for (const t of [a, b]) t.step(0.05, w);
      for (const t of [a, b]) inside.onRails(t, 0.05);
    }
    expect(Math.cos(a.th)).toBeGreaterThan(0.9);
  });

  it('round a sharp corner the body stays on the rails', async () => {
    const { w, roads, inside } = await world();
    void roads;
    const net = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [0, 0], [0, 300]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    (w as unknown as { roads: RoadNet }).roads = net;
    const tram = inside.addCar('tram', -100, 0, 0);
    tram.driver = 'ai';
    let worst = 0;
    let jump = 0;
    let turn = 0;
    for (let k = 0; k < 1200 && tram.y < 60; k++) {
      const [x0, y0, th0] = [tram.x, tram.y, tram.th];
      inside.drive(tram, 0.05);
      tram.step(0.05, w);
      inside.onRails(tram, 0.05);
      // the middle of the body: on the rails, or on the chord between its bogies across the corner
      worst = Math.max(worst, net.nearest(tram.x, tram.y, 30, 'tram')!.d);
      // and it moves smoothly: no jumps, no sudden turns
      jump = Math.max(jump, Math.hypot(tram.x - x0, tram.y - y0));
      turn = Math.max(turn, Math.abs(Math.atan2(Math.sin(tram.th - th0), Math.cos(tram.th - th0))));
    }
    expect(tram.y).toBeGreaterThan(60);
    // a rigid body with bogies 13.3 m apart cuts a right angle by half its bogie spacing over the diagonal
    expect(worst).toBeLessThan(6.65 * Math.SQRT1_2 + 0.5);
    expect(jump).toBeLessThan(1.2);
    expect(turn).toBeLessThan(0.2);
  });

  it('its front never takes a followed line that only crosses its own', async () => {
    const { w, inside } = await world();
    const net = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [300, 0]], widthM: 1.6, bridge: false },
      { kind: 'rail', pts: [[0, -300], [0, 300]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    (w as unknown as { roads: RoadNet }).roads = net;
    const along = (inside as unknown as { alongRails: (p: { line: number; s: number; dir: 1 | -1 }, d: number, want: 'tram', toward: null, follow: number[]) => { line: number; s: number } }).alongRails;
    // from 280 m along the first line, 40 m on, with the crossing line among those followed
    const p = along.call(inside, { line: 0, s: 280, dir: 1 }, 40, 'tram', null, [1]);
    expect(p.line).toBe(0);
    expect(p.s).toBeCloseTo(320, 0);
  });

  it('a tram with no track it can run on goes, rather than stand there', async () => {
    const { w, inside } = await world();
    // only a bit of track too short to run on
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[0, 0], [30, 0]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    const tram = inside.addCar('tram', 15, 0, 0);
    tram.driver = 'ai';
    inside.drive(tram, 0.05);
    expect(tram.gone).toBe(true);
  });

  it('at the end of a line it goes on along the way it can, though the driver looks off to the side', async () => {
    const { w, inside } = await world();
    const net = new RoadNet([
      { kind: 'rail', pts: [[-200, 0], [0, 0]], widthM: 1.6, bridge: false },
      { kind: 'rail', pts: [[0, 0], [200, 0]], widthM: 1.6, bridge: false },
      // a line that doubles back, too sharp for a tram
      { kind: 'rail', pts: [[0, 0], [-100, 30]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    (w as unknown as { roads: RoadNet }).roads = net;
    const along = (inside as unknown as { alongRails: (p: { line: number; s: number; dir: 1 | -1 }, d: number, want: 'tram', toward: [number, number], follow: number[]) => { line: number; s: number } }).alongRails;
    const p = along.call(inside, { line: 0, s: 195, dir: 1 }, 20, 'tram', [-100, 30], []);
    expect(p.line).toBe(1);
    expect(p.s).toBeGreaterThan(10);
  });

  it('put on just before points its driver takes, it follows the branch and never turns round', async () => {
    const { w, inside } = await world();
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [300, 0]], widthM: 1.6, bridge: false },
      { kind: 'rail', pts: [[0, 0], [200, 30]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    // the driver always takes points
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const tram = inside.addCar('tram', -5, 0, 0);
    tram.driver = 'ai';
    let turned = false;
    // till it is well along the branch (at its end, 200 m on, it turns round as at any end of track)
    for (let k = 0; k < 600 && tram.x < 80; k++) {
      inside.drive(tram, 0.05);
      tram.step(0.05, w);
      inside.onRails(tram, 0.05);
      if (Math.cos(tram.th) < 0) turned = true;
    }
    expect(turned).toBe(false);
    expect(tram.x).toBeGreaterThan(60);
    // on the branch
    expect(tram.y).toBeGreaterThan(tram.x * 0.1);
  });

  it('where its way is split at a tight corner, it takes the corner', async () => {
    const { w, inside } = await world();
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [0, 0]], widthM: 1.6, bridge: false },
      { kind: 'rail', pts: [[0, 0], [0, 300]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, -150], [300, -150]], widthM: 6, bridge: false },
    ], 750);
    const tram = inside.addCar('tram', -100, 0, 0);
    tram.driver = 'ai';
    for (let k = 0; k < 1200 && tram.y < 60; k++) {
      inside.drive(tram, 0.05);
      tram.step(0.05, w);
      inside.onRails(tram, 0.05);
    }
    expect(tram.y).toBeGreaterThan(60);
  });

  it('a train under a road bridge neither meets the cars on it nor waits for them; at a level crossing it does', async () => {
    const { w, inside } = await world();
    const apart = (p: Car, q: Car) => (inside as unknown as { apart: (p: Car, q: Car) => boolean }).apart(p, q);
    // the station's tracks on the ground, North Bridge over them, a street across them further on
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [300, 0]], widthM: 3, bridge: false },
      { kind: 'primary', pts: [[0, -100], [0, 100]], widthM: 11, bridge: true },
      { kind: 'minor', pts: [[150, -100], [150, 100]], widthM: 6, bridge: false },
    ], 750);
    const train = inside.addCar('train', -2, 0, 0);
    train.driver = 'ai';
    inside.onRails(train, 0.05);
    expect(train.onRails).toBe(true);
    const onBridge = inside.addCar('sedan', 0, 1, Math.PI / 2);
    onBridge.driver = 'ai';
    expect(apart(train, onBridge)).toBe(true);
    expect(apart(onBridge, train)).toBe(true);
    const atCrossing = inside.addCar('sedan', 150, 1, Math.PI / 2);
    atCrossing.driver = 'ai';
    expect(apart(train, atCrossing)).toBe(false);
    // and a railway bridge over a street: the cars under it pass beneath
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [300, 0]], widthM: 3, bridge: true },
      { kind: 'minor', pts: [[0, -100], [0, 100]], widthM: 6, bridge: false },
    ], 750);
    (inside as unknown as { bridged: Map<string, boolean> }).bridged.clear();
    train.rail = null;
    inside.onRails(train, 0.05);
    expect(apart(train, onBridge)).toBe(true);
    // two trains meet as before, wherever they are
    const other = inside.addCar('train', 40, 0, Math.PI);
    other.driver = 'ai';
    inside.onRails(other, 0.05);
    expect(apart(train, other)).toBe(false);
  });

  it('a tram in a street under a road on stilts, or on a bridge with the street, meets the cars as before', async () => {
    const { w, inside } = await world();
    const apart = (p: Car, q: Car) => (inside as unknown as { apart: (p: Car, q: Car) => boolean }).apart(p, q);
    const fresh = () => (inside as unknown as { bridged: Map<string, boolean> }).bridged.clear();
    // the tram's street, and a road on stilts along it, its middle over the street's lanes
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [300, 0]], widthM: 1.6, bridge: false },
      { kind: 'minor', pts: [[-300, 0], [300, 0]], widthM: 6, bridge: false },
      { kind: 'primary', pts: [[-300, 3], [300, 3]], widthM: 11, bridge: true },
    ], 750);
    const tram = inside.addCar('tram', -8, 0, 0);
    tram.driver = 'ai';
    inside.onRails(tram, 0.05);
    const car = inside.addCar('sedan', 0, 2, 0);
    car.driver = 'ai';
    expect(apart(tram, car)).toBe(false);
    // the tracks marked as a bridge over a culvert, the street not: they run along each other, and meet
    (w as unknown as { roads: RoadNet }).roads = new RoadNet([
      { kind: 'rail', pts: [[-300, 0], [300, 0]], widthM: 1.6, bridge: true },
      { kind: 'minor', pts: [[-300, 0], [300, 0]], widthM: 6, bridge: false },
    ], 750);
    fresh();
    tram.rail = null;
    inside.onRails(tram, 0.05);
    expect(apart(tram, car)).toBe(false);
  });
});
