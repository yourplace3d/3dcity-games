import { describe, expect, it } from 'vitest';
import { doorPoint, nearestOnRing } from '../src/game/homes';
import type { Pt } from '../src/geo/polygon';

/** A square building from (x0, y0) to (x1, y1). */
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const inside = (r: Pt[], x: number, y: number) => x > r[0][0] && x < r[1][0] && y > r[0][1] && y < r[2][1];

describe('the door one walks to, to talk to the tenants', () => {
  it('finds the nearest point of a wall', () => {
    expect(nearestOnRing(box(0, 0, 10, 10), 5, -4)).toEqual([5, 0]);
    expect(nearestOnRing(box(0, 0, 10, 10), -3, -4)).toEqual([0, 0]);
  });

  it('is at the home’s own wall when the home is on the street', () => {
    const home = box(0, 0, 10, 10);
    const [x, y] = doorPoint(home, [5, -6], (fx, fy) => !inside(home, fx, fy));
    expect(x).toBeCloseTo(5);
    expect(y).toBeGreaterThan(-1);
    expect(y).toBeLessThanOrEqual(0);
  });

  it('is at the house on the street when the home is in a courtyard behind it (Paris)', () => {
    // the street at y = -6; a house on the street from y = 0 to 12; the courtyard house from y = 20 to 28
    const front = box(-20, 0, 20, 12);
    const home = box(0, 20, 8, 28);
    const [x, y] = doorPoint(home, [4, -6], (fx, fy) => !inside(front, fx, fy) && !inside(home, fx, fy));
    expect(x).toBeCloseTo(4);
    // as far as one can walk: right at the front house's wall, on the street side
    expect(y).toBeGreaterThan(-1);
    expect(y).toBeLessThanOrEqual(0);
  });

  it('stays on the street when nothing can be walked', () => {
    expect(doorPoint(box(0, 0, 10, 10), [5, -6], () => false)).toEqual([5, -6]);
  });
});
