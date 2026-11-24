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

  it('a car that hits it takes all of the push', () => {
    const tram = new Car('tram');
    tram.rail = { p: { line: 0, s: 0, dir: 1 }, world: {} as World, trail: [[0, 0]] };
    const car = new Car('sedan');
    car.x = 3;
    car.y = 1;
    collideCars(tram, car);
    expect([tram.x, tram.y, tram.th]).toEqual([0, 0, 0]);
    expect(Math.hypot(car.x - 3, car.y - 1)).toBeGreaterThan(0.5);
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
});
