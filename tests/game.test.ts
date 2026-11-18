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
