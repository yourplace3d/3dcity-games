import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Game } from '../src/game/game';
import { RING } from '../src/game/services';
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

describe("the tenants’ door, on foot", () => {
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

  const square = (): World =>
    ({
      half: 750,
      model: { group: new Group() },
      roads: new RoadNet([{ kind: 'minor', pts: [[-740, 0], [740, 0]], widthM: 6, bridge: false }], 750),
      proj: { toLocal: (lon: number, lat: number): [number, number] => [lon, lat], toLngLat: (x: number, y: number) => ({ lon: x, lat: y }) },
      free: () => true,
      groundY: () => 0,
      needsRecentre: () => null,
      dispose: vi.fn(),
      sights: [],
      services: [],
    }) as unknown as World;

  async function playing() {
    vi.spyOn(World, 'load').mockResolvedValue(square());
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    g.car = null;
    g.run.over = true;
    return g;
  }

  it('the little map’s way follows a way asked for, not the nearest package', async () => {
    const g = await playing();
    const goal = () => (g as unknown as { goal: () => { at: { lon: number; lat: number }; colour?: string } | null }).goal();
    g.guide = { x: 120, y: 0 };
    expect(goal()?.at).toEqual({ lon: 120, lat: 0 });
    expect(goal()?.colour).toBe(RING.home);
    // the same marker while the guide stays, so the way is not worked out again each time
    expect(goal()).toBe(goal());
  });

  it('goes in at a door on foot: standing still, and not taking a car meanwhile', async () => {
    const g = await playing();
    g.me.vx = 3;
    g.goInside(1);
    expect(g.inside).toBe(true);
    expect(g.me.vx).toBe(0);
    const car = g.car;
    g.action();
    expect(g.car).toBe(car);
  });

  it('does not go in from a car', async () => {
    const g = await playing();
    g.car = {} as never;
    g.goInside(1);
    expect(g.inside).toBe(false);
  });
});
