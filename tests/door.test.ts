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

/**
 * A home waits for a station's package, and the station lies across the line where the next square loads
 * (450 m from the middle of a square 1.5 km across). The package must still go to the home.
 */
describe('a home’s package across the edge of its square', () => {
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

  /** a square whose middle is `east` metres east of the first one's, with one street running east to west through it */
  const square = (east: number): World =>
    ({
      half: 750,
      model: { group: new Group() },
      roads: new RoadNet([{ kind: 'minor', pts: [[-740, 0], [740, 0]], widthM: 6, bridge: false }], 750),
      // places on the earth are metres from the first square's middle
      proj: { toLocal: (lon: number, lat: number): [number, number] => [lon - east, lat], toLngLat: (x: number, y: number) => ({ lon: x + east, lat: y }) },
      free: () => true,
      groundY: () => 0,
      needsRecentre: () => null,
      dispose: vi.fn(),
      sights: [],
      services: [],
    }) as unknown as World;

  // the home: 100 m west of the first square's middle, 20 m off the street
  const home = { lon: -100, lat: 20 };
  const say = { plain: '', supply: 'For your building', rush: '', clean: '' };

  async function playing(at: number) {
    vi.spyOn(World, 'load').mockResolvedValue(square(at));
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: at, lat: 0 });
    g.car = null;
    g.run.over = true;
    const inner = g as unknown as { swap: (w: World) => void; take: (m: unknown) => boolean; markerAt: (c: string, at: { lon: number; lat: number }) => { kind?: string } };
    /** the package of a pump at a place on the earth, taken */
    const takeAt = (lon: number) => {
      const m = inner.markerAt(RING.supply, { lon, lat: 0 });
      m.kind = 'supply';
      g.job = null;
      return inner.take(m);
    };
    return { g, inner, takeAt };
  }

  it('still goes to the home once the next square has left it behind: its door is kept as a place on the earth', async () => {
    const { g, inner, takeAt } = await playing(0);
    g.special = { at: home, say };
    const taken = vi.fn();
    g.onSpecialTaken = taken;
    expect(g.specialHere()).toBe(true);
    // the player drives east to a pump 550 m out: past 450 m the next square loads, 750 m further east
    g.me.x = 500;
    g.me.y = 0;
    inner.swap(square(750));
    // the home is no longer in the square (850 m west of its middle), but the pump's ring still flashes green
    expect(g.me.x).toBe(-250);
    expect(g.specialHere()).toBe(true);
    expect(takeAt(550)).toBe(true);
    expect(g.job?.special).toBe(true);
    expect(taken).toHaveBeenCalledWith('supply');
    // the drop-off is on the street at the home's door, where it was found before the square went
    expect(g.job!.to.at.lon).toBeGreaterThan(-140);
    expect(g.job!.to.at.lon).toBeLessThan(-60);
    expect(g.job!.to.at.lat).toBeCloseTo(0);
    // and far from it (2.3 km, two squares on), a station's package is an ordinary job again (`takeAt` puts the job down first)
    inner.swap(square(2250));
    g.me.x = 0;
    expect(g.specialHere()).toBe(false);
    expect(takeAt(2300)).toBe(true);
    expect(g.job?.special).toBeFalsy();
  });

  it('still goes to the home at the rim of the next square, where its street is cut off: the door kept is used', async () => {
    /** a square whose middle is `north` metres north of the first one's, with the streets given as places on the earth */
    const squareOf = (north: number, streets: Array<Array<[number, number]>>): World =>
      ({
        ...square(0),
        roads: new RoadNet(streets.map((pts) => ({ kind: 'minor', pts: pts.map(([x, y]) => [x, y - north] as [number, number]), widthM: 6, bridge: false })), 750),
        proj: { toLocal: (lon: number, lat: number): [number, number] => [lon, lat - north], toLngLat: (x: number, y: number) => ({ lon: x, lat: y + north }) },
      }) as unknown as World;
    // the home's street runs east to west; another leads north from it to a pump
    vi.spyOn(World, 'load').mockResolvedValue(squareOf(0, [[[-740, 0], [740, 0]], [[0, 0], [0, 740]]]));
    const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
    (g as unknown as { parkCars: () => void }).parkCars = vi.fn();
    await g.start({ lon: 0, lat: 0 });
    g.car = null;
    g.run.over = true;
    const inner = g as unknown as { swap: (w: World) => void; take: (m: unknown) => boolean; markerAt: (c: string, at: { lon: number; lat: number }) => { kind?: string } };
    const far = { lon: 300, lat: 20 };
    g.special = { at: far, say };
    // the player drives north: the next square is 750 m further north, and the home lies at its rim
    // (730 m south of its middle), where the map of that square has nothing of the home's street
    g.me.x = 0;
    g.me.y = 500;
    inner.swap(squareOf(750, [[[0, 10], [0, 1490]], [[-740, 750], [740, 750]]]));
    expect(g.specialHere()).toBe(true);
    const m = inner.markerAt(RING.supply, { lon: 0, lat: 760 });
    m.kind = 'supply';
    expect(inner.take(m)).toBe(true);
    expect(g.job?.special).toBe(true);
    // the drop-off is on the street at the home's door, as it was found before the square went
    expect(g.job!.to.at.lon).toBeGreaterThan(260);
    expect(g.job!.to.at.lon).toBeLessThan(340);
    expect(g.job!.to.at.lat).toBeCloseTo(0);
  });

  it('allows for a longer way by road than a run does, where the way is only guessed: being late costs a home dearly', async () => {
    const { g, inner, takeAt } = await playing(0);
    g.special = { at: home, say };
    g.me.x = 500;
    g.me.y = 0;
    inner.swap(square(750));
    expect(takeAt(550)).toBe(true);
    expect(g.job?.special).toBe(true);
    // 600 m as the crow flies from the player to the door: a run's drop-off out there is guessed at 1.35 times that
    expect(g.job!.metres).toBeGreaterThan(600 * 1.5);
  });

  it('is an ordinary job where the home was never in a square loaded: nothing is known of its door', async () => {
    const { g, takeAt } = await playing(750);
    g.special = { at: home, say };
    g.me.x = -250;
    g.me.y = 0;
    expect(g.specialHere()).toBe(false);
    expect(takeAt(550)).toBe(true);
    expect(g.job?.special).toBeFalsy();
  });

  it('keeps the door of the home the package was last taken to, and of no other', async () => {
    const { g, inner, takeAt } = await playing(0);
    g.special = { at: home, say };
    g.me.x = 200;
    g.me.y = 0;
    expect(takeAt(300)).toBe(true);
    expect(g.job?.special).toBe(true);
    // another home waits now, one that was never in a square loaded
    g.special = { at: { lon: -2000, lat: 20 }, say };
    g.me.x = 500;
    inner.swap(square(750));
    expect(g.specialHere()).toBe(false);
  });
});
