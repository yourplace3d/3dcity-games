import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Game } from '../src/game/game';
import type { Car } from '../src/game/cars';
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

interface Internals {
  mine: Car | null;
  blowT: number;
  blown: Car | null;
  frozen: number;
  routePts: Array<[number, number]> | null;
  dry: [number, number];
  sinking: { car: Car; t: number; shore: [number, number] } | null;
  parkCars: () => void;
  maybeLoadNext: () => void;
  swap: (world: World) => void;
}

const inside = (game: Game): Internals => game as unknown as Internals;

function world(offset = 0): World {
  return {
    half: 750,
    model: { group: new Group() },
    roads: new RoadNet([{ kind: 'minor', pts: [[-300, 0], [300, 0]], widthM: 6, bridge: false }], 750),
    proj: {
      toLocal: (lon: number, lat: number): [number, number] => [lon - offset, lat],
      toLngLat: (x: number, y: number) => ({ lon: x + offset, lat: y }),
    },
    free: () => true,
    groundY: () => 0,
    needsRecentre: () => ({ lon: 1, lat: 0 }),
    dispose: vi.fn(),
  } as unknown as World;
}

function game(): Game {
  const g = new Game({ clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement, false);
  inside(g).parkCars = vi.fn();
  return g;
}

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

describe('city changes', () => {
  it('leaves an old wreck, car marker, movement and route behind when starting another city', async () => {
    vi.spyOn(World, 'load').mockResolvedValueOnce(world()).mockResolvedValueOnce(world());
    const g = game();
    await g.start({ lon: 0, lat: 0 });
    const oldCar = g.cars[0];
    g.me.vx = 8;
    g.me.vy = -4;
    Object.assign(inside(g), { mine: oldCar, blown: oldCar, blowT: 0.5, frozen: 0.8, routePts: [[10, 20]], dry: [20, 30] });

    await g.start({ lon: 0, lat: 0 });

    const { mine, blown, blowT, frozen, routePts } = inside(g);
    expect({ hasMine: !!mine, hasWreck: !!blown, blowT, frozen, routePts }).toEqual({ hasMine: false, hasWreck: false, blowT: 0, frozen: 0, routePts: null });
    expect([g.me.vx, g.me.vy]).toEqual([0, 0]);
    expect(g.cars).not.toContain(oldCar);
  });

  it('disposes a neighbouring square that finishes after the player changes city', async () => {
    let finish!: (w: World) => void;
    const pending = new Promise<World>((resolve) => { finish = resolve; });
    const nextCity = world();
    const neighbour = world();
    vi.spyOn(World, 'load').mockResolvedValueOnce(world()).mockReturnValueOnce(pending).mockResolvedValueOnce(nextCity);
    const g = game();
    await g.start({ lon: 0, lat: 0 });
    const square = vi.fn();
    g.onSquare = square;
    inside(g).maybeLoadNext();
    await g.start({ lon: 10, lat: 0 });
    expect(square.mock.calls).toEqual([['loading'], ['ready']]);
    finish(neighbour);

    await vi.waitFor(() => expect(neighbour.dispose).toHaveBeenCalledOnce());
    expect(g.world).toBe(nextCity);
    expect(nextCity.dispose).not.toHaveBeenCalled();
    expect(square.mock.calls).toEqual([['loading'], ['ready']]);
  });

  it('keeps the same geographic shore when a new square arrives while a car sinks', async () => {
    vi.spyOn(World, 'load').mockResolvedValue(world());
    const g = game();
    await g.start({ lon: 0, lat: 0 });
    const car = g.cars[0];
    g.seat(car);
    inside(g).dry = [500, 10];
    inside(g).sinking = { car, t: 0.4, shore: [500, 10] };

    inside(g).swap(world(750));

    expect(inside(g).dry).toEqual([-250, 10]);
    expect(inside(g).sinking?.shore).toEqual([-250, 10]);
  });
});

describe('leaving a car', () => {
  it('stays in the car if every exit is blocked instead of placing the player in a wall or water', async () => {
    const w = world();
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = game();
    await g.start({ lon: 0, lat: 0 });
    const car = g.cars[0];
    g.seat(car);
    w.free = () => false;
    const toast = vi.fn();
    g.onToast = toast;

    g.action();

    expect(g.car === car).toBe(true);
    expect(car.driver).toBe('player');
    expect(toast).toHaveBeenCalledWith('No room to get out here', 'info');
  });

  it('uses a clear exit when the usual side is blocked', async () => {
    const w = world();
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = game();
    await g.start({ lon: 0, lat: 0 });
    const car = g.cars[0];
    g.seat(car);
    w.free = (_x, y) => y < car.y;

    g.action();

    expect(g.car).toBeNull();
    expect(g.me.y).toBeLessThan(car.y);
    expect(car.driver).toBe('none');
  });
});

describe('a mission package', () => {
  it('goes to the street when the lane at the building is a yard no road leads to', async () => {
    const w = world();
    // the street, and beside the building a yard's lane that joins nothing (Mühlendamm, Berlin)
    Object.assign(w, {
      roads: new RoadNet([
        { kind: 'minor', pts: [[-300, 0], [300, 0]], widthM: 6, bridge: false },
        { kind: 'service', pts: [[90, 40], [110, 40]], widthM: 3, bridge: false },
      ], 750),
      sights: [],
      services: [],
    });
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = game();
    await g.start({ lon: 0, lat: 0 });
    g.openPlay();
    g.car = null;
    g.me.x = 0;
    g.me.y = 0;
    const say = { plain: 'to your building', supply: 'to your building', rush: 'to your building', clean: 'to your building' };
    g.special = { at: { lon: 100, lat: 45 }, say };
    const taken = vi.fn();
    g.onSpecialTaken = taken;
    // a fuel station's package, where the player stands
    const { pickups, jobs } = g as unknown as { pickups: Array<{ at: { lon: number; lat: number }; mesh: Group; kind?: string }>; jobs: (dt: number) => void };
    pickups.push({ at: { lon: 0, lat: 0 }, mesh: new Group(), kind: 'supply' });

    jobs.call(g, 0.016);

    expect(g.job?.special).toBe(true);
    expect(taken).toHaveBeenCalledWith('supply');
    // dropped on the street in front of the building, not somewhere at random
    const [x, y] = w.proj.toLocal(g.job!.to.at.lon, g.job!.to.at.lat);
    expect(Math.hypot(x - 100, y)).toBeLessThan(2);
  });
});

describe("a station's job on a card", () => {
  type Pickup = { at: { lon: number; lat: number }; mesh: Group; kind?: string };
  async function atStation() {
    const w = world();
    Object.assign(w, { sights: [], services: [] });
    vi.spyOn(World, 'load').mockResolvedValue(w);
    const g = game();
    await g.start({ lon: 0, lat: 0 });
    g.openPlay();
    g.car = null;
    g.me.x = 0;
    g.me.y = 0;
    const { pickups, jobs } = g as unknown as { pickups: Pickup[]; jobs: (dt: number) => void };
    pickups.splice(0);
    pickups.push({ at: { lon: 0, lat: 0 }, mesh: new Group(), kind: 'rush' });
    const answers: Array<(yes: boolean) => void> = [];
    const offer = vi.fn((_kind: string, _special: string | null, answer: (yes: boolean) => void) => void answers.push(answer));
    g.onOffer = offer;
    return { g, offer, answers, jobs: () => jobs.call(g, 0.016) };
  }

  it('asks first, and takes the job on yes', async () => {
    const { g, offer, answers, jobs } = await atStation();
    jobs();
    expect(offer).toHaveBeenCalledOnce();
    expect(offer.mock.calls[0][0]).toBe('rush');
    expect(g.job).toBeNull();
    answers[0](true);
    expect(g.job?.kind).toBe('rush');
  });

  it('"Not now" holds while the player stays, and asks again once they drive off and come back', async () => {
    const { g, offer, answers, jobs } = await atStation();
    jobs();
    answers[0](false);
    jobs();
    jobs();
    expect(offer).toHaveBeenCalledOnce();
    g.me.x = 120;
    jobs();
    g.me.x = 0;
    jobs();
    expect(offer).toHaveBeenCalledTimes(2);
    expect(g.job).toBeNull();
  });

  it('no card over another card, and none while driving fast', async () => {
    const { g, offer, jobs } = await atStation();
    g.held = true;
    jobs();
    g.held = false;
    g.me.vx = 12;
    jobs();
    expect(offer).not.toHaveBeenCalled();
  });

  it('the autopilot takes it by driving onto it, as before', async () => {
    const { g, offer, jobs } = await atStation();
    g.auto = true;
    jobs();
    expect(offer).not.toHaveBeenCalled();
    expect(g.job?.kind).toBe('rush');
  });
});
