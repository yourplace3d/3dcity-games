import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, type MeshBasicMaterial } from 'three';
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

const colourOf = (mesh: Group): string => `#${((mesh.children[0] as Mesh).material as MeshBasicMaterial).color.getHexString()}`;

describe('the colours of the rings', () => {
  it('each giver its own, none the yellow of a drop-off', () => {
    const all = Object.values(RING);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain('#ffd400');
  });
});

describe('the rings in the game', () => {
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

  async function playing(services: Array<{ kind: 'fuel' | 'fire' | 'police'; x: number; y: number }> = []) {
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
      services,
    } as unknown as World;
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    g.car = null;
    g.me.x = 0;
    g.me.y = 0;
    const inside = g as unknown as { jobs: (dt: number) => void; placeMarkers: () => void; clock: number; pickups: Array<{ mesh: Group; kind?: string }> };
    return { g, inside };
  }

  it('a run’s packages are turquoise, and so are the arrow and the little map’s dots', async () => {
    const { g, inside } = await playing();
    g.newRun();
    for (let i = 0; i < 20 && !inside.pickups.length; i++) inside.jobs(0.1);
    expect(inside.pickups.length).toBeGreaterThan(0);
    expect(colourOf(inside.pickups[0].mesh)).toBe(RING.plain);
    expect(g.hud().target?.colour).toBe(RING.plain);
    expect(g.mapView().pickups[0].colour).toBe(RING.plain);
  });

  it('a station’s package has the colour of its sign: orange at the pump, red at the flame, blue at the badge', async () => {
    const { g, inside } = await playing([
      { kind: 'fuel', x: 300, y: 8 },
      { kind: 'fire', x: -300, y: 8 },
      { kind: 'police', x: 500, y: 8 },
    ]);
    g.run.over = true;
    inside.jobs(1);
    const by = Object.fromEntries(inside.pickups.map((m) => [m.kind, colourOf(m.mesh)]));
    expect(by).toEqual({ supply: RING.supply, rush: RING.rush, clean: RING.clean });
    // the arrow points to the nearest, in its colour
    expect(['#ff8a1f', '#ff3b30']).toContain(g.hud().target?.colour);
    expect(new Set(g.mapView().pickups.map((p) => p.colour))).toEqual(new Set([RING.supply, RING.rush, RING.clean]));
  });

  it('a party’s food is pink, the colour of what is for your home', async () => {
    const { g, inside } = await playing();
    g.startParty({ pick: { lon: 400, lat: 0 }, door: { lon: -300, lat: 0 }, say: 'The pizza is on board' });
    inside.jobs(0.016);
    expect(colourOf(inside.pickups[0].mesh)).toBe(RING.home);
    expect(g.hud().target?.colour).toBe(RING.home);
  });

  it('while a home waits for a station’s package, the station’s ring flashes pink instead of vanishing', async () => {
    const { g, inside } = await playing([{ kind: 'fuel', x: 300, y: 8 }]);
    g.run.over = true;
    inside.jobs(1);
    const ring = inside.pickups[0];
    g.special = { at: { lon: -300, lat: 0 }, say: { plain: '', supply: '', rush: '', clean: '' } };
    // the flash: the sine of the clock is low
    inside.clock = (3 * Math.PI) / 2 / 7;
    inside.placeMarkers();
    expect(ring.mesh.visible).toBe(true);
    expect(colourOf(ring.mesh)).toBe(RING.home);
    // and back to its own colour
    inside.clock = Math.PI / 2 / 7;
    inside.placeMarkers();
    expect(colourOf(ring.mesh)).toBe(RING.supply);
  });
});
