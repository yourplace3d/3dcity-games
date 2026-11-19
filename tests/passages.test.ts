import { describe, expect, it } from 'vitest';
import type { LineFeature } from '../src/geo/osm';
import type { Pt } from '../src/geo/polygon';
import { carvePassages, keepPassages, PASSAGE_CLEAR_M } from '../src/game/passages';
import { Solids } from '../src/game/solids';

const box = (x0: number, y0: number, x1: number, y1: number, height = 15) => ({
  poly: { outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[], holes: [] as Pt[][] },
  height,
  minHeight: 0,
  id: 'b1',
});
const line = (kind: LineFeature['kind'], pts: Pt[], extra: Partial<LineFeature> = {}): LineFeature => ({ kind, widthM: kind === 'path' ? 1.8 : 3.5, pts, bridge: false, ...extra });

/** Whether a circle of radius r can go along a straight line from a to b without touching a wall. */
function clear(solids: Solids, a: Pt, b: Pt, r: number): boolean {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25);
  for (let k = 0; k <= n; k++) {
    const c = { x: a[0] + ((b[0] - a[0]) * k) / n, y: a[1] + ((b[1] - a[1]) * k) / n };
    if (solids.inside(c.x, c.y) || solids.push(c, r)) return false;
  }
  return true;
}

describe('ways through buildings', () => {
  it('cuts a corridor a car fits through, and keeps the floors above as a roof', () => {
    const b = box(-10, -6, 10, 6);
    const { shapes, opened } = carvePassages([b], [line('service', [[0, -20], [0, 20]])]);
    expect(opened.has(0)).toBe(true);
    const roof = shapes.filter((s) => s.minHeight > 0);
    const walls = shapes.filter((s) => s.minHeight === 0);
    expect(walls).toHaveLength(2);
    expect(roof).toHaveLength(1);
    expect(roof[0].minHeight).toBe(PASSAGE_CLEAR_M);
    expect(shapes.every((s) => s.id === 'b1' && s.height === 15)).toBe(true);
    const solids = new Solids(shapes);
    // a car is two circles of about a metre
    expect(clear(solids, [0, -15], [0, 15], 1)).toBe(true);
    // beside the passage the building is still a wall
    expect(clear(solids, [5, -15], [5, 15], 1)).toBe(false);
  });

  it('cuts a footpath wide enough to walk, and to squeeze a small car through', () => {
    const { shapes } = carvePassages([box(-10, -6, 10, 6)], [line('path', [[0, -20], [0, 20]])]);
    const solids = new Solids(shapes);
    expect(clear(solids, [0, -15], [0, 15], 0.4)).toBe(true);
    expect(clear(solids, [0, -15], [0, 15], 1)).toBe(true);
  });

  it('opens a passage into a courtyard', () => {
    const b = { ...box(-20, -20, 20, 20), poly: { outer: box(-20, -20, 20, 20).poly.outer, holes: [[[-12, -12], [-12, 12], [12, 12], [12, -12]] as Pt[]] } };
    const { shapes } = carvePassages([b], [line('service', [[0, -30], [0, 0]])]);
    const solids = new Solids(shapes);
    expect(clear(solids, [0, -28], [0, 0], 1)).toBe(true);
  });

  it('opens a gate in a low wall to the sky', () => {
    const { shapes } = carvePassages([box(-30, -1, 30, 1, 3)], [line('minor', [[0, -10], [0, 10]], { widthM: 6 })]);
    expect(shapes.every((s) => s.minHeight === 0)).toBe(true);
    expect(clear(new Solids(shapes), [0, -8], [0, 8], 1)).toBe(true);
  });

  it('leaves a building alone that a street only grazes', () => {
    const b = box(-10, 0, 10, 12);
    // the street's line drawn 40 cm into the front
    const { shapes, opened } = carvePassages([b], [line('minor', [[-30, 0.4], [30, 0.4]], { widthM: 6 })]);
    expect(opened.size).toBe(0);
    expect(shapes).toEqual([b]);
  });

  it('does not open a building for a bridge, a railway or a river', () => {
    const b = box(-10, -6, 10, 6);
    const { opened } = carvePassages([b], [line('minor', [[0, -20], [0, 20]], { bridge: true }), line('rail', [[-2, -20], [-2, 20]]), line('river', [[3, -20], [3, 20]])]);
    expect(opened.size).toBe(0);
  });

  it('keeps a "tunnel" under a building and drops one that is not', () => {
    const b = box(-10, -6, 10, 6);
    const passage = line('service', [[0, -6.5], [0, 6.5]], { passage: true });
    const tunnel = line('primary', [[100, -200], [100, 200]], { passage: true });
    const street = line('minor', [[-50, -20], [50, -20]]);
    expect(keepPassages([passage, tunnel, street], [b])).toEqual([passage, street]);
  });
});

describe('cutting a frame at a time', () => {
  it('gives the same pieces as cutting at once', async () => {
    const { carvePassagesInSteps } = await import('../src/game/passages');
    const bs = [box(-10, -6, 10, 6), box(30, -6, 50, 6), box(100, 100, 110, 110)];
    const ls = [line('service', [[0, -20], [0, 20]]), line('path', [[40, -20], [40, 20]])];
    const once = carvePassages(bs, ls);
    const steps = await carvePassagesInSteps(bs, ls, () => Promise.resolve());
    expect(steps.shapes).toEqual(once.shapes);
    expect([...steps.opened].sort()).toEqual([...once.opened].sort());
  });
});
