import { describe, expect, it } from 'vitest';
import { Solids, type SolidBuilding } from '../src/game/solids';
import { World } from '../src/game/world';

const building = (outer: SolidBuilding['poly']['outer'], holes: SolidBuilding['poly']['holes'] = []): SolidBuilding => ({
  poly: { outer, holes }, height: 8, minHeight: 0,
});

describe('building sight lines', () => {
  it('detects a thin wall between points less than four metres apart', () => {
    const solids = new Solids([building([[0, -10], [0.2, -10], [0.2, 10], [0, 10]])]);
    expect(solids.blocked(-1, 0, 1, 0)).toBe(true);
    expect(solids.blocked(1, 0, -1, 0)).toBe(true);
  });

  it('does not skip a thin wall between samples on a long sight line', () => {
    const solids = new Solids([building([[1, -10], [2, -10], [2, 10], [1, 10]])]);
    expect(solids.blocked(-20, 0, 20, 0)).toBe(true);
    expect(solids.blocked(-20, 11, 20, 11)).toBe(false);
  });

  it('allows sight within a courtyard but blocks sight through its walls', () => {
    const solids = new Solids([building(
      [[-10, -10], [10, -10], [10, 10], [-10, 10]],
      [[[-8, -8], [-8, 8], [8, 8], [8, -8]]],
    )]);
    expect(solids.blocked(-5, 0, 5, 0)).toBe(false);
    expect(solids.blocked(0, 0, 20, 0)).toBe(true);
    expect(solids.blocked(20, 20, 30, 30)).toBe(false);
  });
});

describe('safe places over water', () => {
  it('allows a bridge road and still refuses open water', () => {
    const world = Object.assign(Object.create(World.prototype), {
      half: 750,
      solids: new Solids([]),
      water: { at: () => true },
      roads: { onRoad: (_x: number, y: number) => Math.abs(y) < 3 },
    }) as World;
    expect(world.free(0, 0, 0.4)).toBe(true);
    expect(world.free(0, 10, 0.4)).toBe(false);
  });
});

describe('tree trunks', () => {
  it('push a circle off a trunk, and leave one beside it alone', () => {
    const s = new Solids([]);
    s.addPosts([{ x: 10, y: 0, r: 0.5 }]);
    const c = { x: 9.2, y: 0.1 };
    const hit = s.push(c, 1);
    expect(hit).not.toBeNull();
    expect(Math.hypot(c.x - 10, c.y)).toBeCloseTo(1.5, 5);
    expect(hit!.nx).toBeLessThan(0);
    expect(s.push({ x: 7, y: 0 }, 1)).toBeNull();
  });

  it('stop a car circle driving at a trunk from passing through it', () => {
    const s = new Solids([]);
    s.addPosts([{ x: 0, y: 0, r: 0.5 }]);
    const c = { x: -3, y: 0.2 };
    for (let i = 0; i < 60; i++) {
      c.x += 0.1;
      s.push(c, 1.1);
    }
    expect(c.x).toBeLessThan(0.5);
  });
});
