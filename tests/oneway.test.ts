import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import type { Car } from '../src/game/cars';
import { Game } from '../src/game/game';
import type { LineFeature } from '../src/geo/osm';
import { laneOffset, mayGo, RoadNet } from '../src/game/roads';
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

const street = (pts: LineFeature['pts'], oneway?: 1 | -1): LineFeature => ({ kind: 'minor', pts, widthM: 6, bridge: false, ...(oneway ? { oneway } : {}) });

describe('one-way streets on the network', () => {
  it('say which way traffic may go, and keep it nearer the middle', () => {
    const net = new RoadNet([street([[0, 0], [100, 0]], 1), street([[0, 50], [100, 50]], -1), street([[0, 100], [100, 100]])], 750);
    const [a, b, c] = net.lines;
    expect([mayGo(a, 1), mayGo(a, -1)]).toEqual([true, false]);
    expect([mayGo(b, 1), mayGo(b, -1)]).toEqual([false, true]);
    expect([mayGo(c, 1), mayGo(c, -1)]).toEqual([true, true]);
    // still to the right, so a car going the wrong way passes the others, but nearer the middle
    expect(laneOffset(a)).toBeGreaterThan(0.5);
    expect(laneOffset(a)).toBeLessThan(laneOffset(c));
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
      solids: { push: () => null, inside: () => false },
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
});
