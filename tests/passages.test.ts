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

describe('bridges over buildings', () => {
  // a valley 7 m deep between y = -30 and 30, like Waverley station under North Bridge
  const valley = (_x: number, y: number) => (Math.abs(y) < 30 ? 33 : 40);
  const level = () => 40;
  // a station roof the bridge crosses, standing in the valley
  const station = () => box(-60, -25, 60, 25, 15);

  it('cuts away what a bridge crosses high over the ground, open to the sky', () => {
    const bridge = line('primary', [[0, -50], [0, 50]], { bridge: true, widthM: 11 });
    const { shapes, opened } = carvePassages([station()], [bridge], valley);
    expect(opened.has(0)).toBe(true);
    // no roof over the street: from above it crosses the roof of the station
    expect(shapes.every((s) => s.minHeight === 0)).toBe(true);
    const solids = new Solids(shapes);
    expect(clear(solids, [0, -45], [0, 45], 1)).toBe(true);
    // on the pavement beside it as well, and the station is still there beside the bridge
    expect(clear(solids, [7, -45], [7, 45], 0.4)).toBe(true);
    expect(clear(solids, [20, -45], [20, 45], 1)).toBe(false);
  });

  it('leaves no strip of the building standing between a bridge and its pavements', () => {
    // North Bridge: the pavements are lines of their own, 7 and 9.5 m from the middle of the street
    const lines = [line('primary', [[0, -50], [0, 50]], { bridge: true, widthM: 11 }), line('path', [[7.3, -50], [7.3, 50]], { bridge: true }), line('path', [[-9.5, -50], [-9.5, 50]], { bridge: true })];
    const { shapes } = carvePassages([station()], lines, valley);
    const solids = new Solids(shapes);
    // walk straight across the bridge from one pavement to the other
    for (const y of [-20, 0, 20]) expect(clear(solids, [-9.5, y], [7.3, y], 0.3)).toBe(true);
  });

  it('leaves a building alone that a bridge reaches on level ground: a walkway between two houses', () => {
    const lines = [line('path', [[0, -50], [0, 50]], { bridge: true }), line('primary', [[20, -50], [20, 50]], { bridge: true, widthM: 11 })];
    const { shapes, opened } = carvePassages([station()], lines, level);
    expect(opened.size).toBe(0);
    expect(shapes).toEqual([station()]);
  });

  it('does not count a slope as a valley: the ground follows the line between the ends', () => {
    // the ground climbs 20 m from one end to the other, evenly
    const slope = (_x: number, y: number) => 40 + (y + 50) * 0.2;
    const { opened } = carvePassages([station()], [line('minor', [[0, -50], [0, 50]], { bridge: true })], slope);
    expect(opened.size).toBe(0);
  });

  it('leaves no sliver of a wall across the street where a bridge starts right on it', () => {
    // as at the north end of North Bridge: the station's wall runs at a slant, through the very
    // point where the bridge begins, and the street before it comes up to the wall
    const wall = (x: number) => -25 + 0.27 * x;
    const slanted = { ...station(), poly: { outer: [[-60, wall(-60)], [60, wall(60)], [60, 25], [-60, 25]] as Pt[], holes: [] as Pt[][] } };
    const start: Pt = [3.1, wall(3.1)];
    const ground = (x: number, y: number) => (y > wall(x) + 4 && y < 20 ? 33 : 40);
    const lines = [line('primary', [[start[0] - 4, start[1] - 40], start], { widthM: 11 }), line('primary', [start, [start[0] + 4, 60]], { bridge: true, widthM: 11 })];
    const { shapes } = carvePassages([slanted], lines, ground);
    expect(clear(new Solids(shapes), [start[0] - 3, start[1] - 20], [start[0] + 3, 50], 1)).toBe(true);
  });

  it('opens a low building under a bridge where the heights show little of the valley', () => {
    // the valley shows only 2 m deep over the first 20 m of the bridge, 7 m further on; a shed of 4 m stands there
    const ground = (_x: number, y: number) => (y < -50 || y > 50 ? 40 : y < -30 ? 38 : 33);
    const shed = { ...box(-20, -42, 20, -38, 4), id: 'shed' };
    const { shapes, opened } = carvePassages([shed], [line('primary', [[0, -50], [0, 50]], { bridge: true, widthM: 11 })], ground);
    expect(opened.has(0)).toBe(true);
    expect(clear(new Solids(shapes), [0, -48], [0, 48], 1)).toBe(true);
  });

  it('leaves a building alone that a footbridge crosses on its own, even high over the ground', () => {
    // walkways from house to house are footbridges; in Hong Kong some run 4 m over the line between their ends
    const { opened } = carvePassages([station()], [line('path', [[0, -50], [0, 50]], { bridge: true })], valley);
    expect(opened.size).toBe(0);
  });

  it('leaves the houses alone at both ends of a walkway over a sunken street', () => {
    // a walkway from the first floor of one house to the other, over a street in a cutting 5 m deep
    const ground = (_x: number, y: number) => (Math.abs(y) < 6 ? 35 : 40);
    const houses = [{ ...box(-10, -30, 10, -8), id: 'a' }, { ...box(-10, 8, 10, 30), id: 'b' }];
    const { shapes, opened } = carvePassages(houses, [line('path', [[0, -20], [0, 20]], { bridge: true })], ground);
    expect(opened.size).toBe(0);
    expect(shapes).toEqual(houses);
  });

  it('measures a bridge cut in pieces as one whole bridge', () => {
    // the map has the bridge in three pieces; the middle one has both ends over the valley
    const deep = (_x: number, y: number) => (Math.abs(y) < 40 ? 33 : 40);
    const lines = [[[0, -50], [0, -30]], [[0, -30], [0, 30]], [[0, 30], [0, 50]]].map((pts) => line('primary', pts as Pt[], { bridge: true, widthM: 11 }));
    const { shapes, opened } = carvePassages([station()], lines, deep);
    expect(opened.has(0)).toBe(true);
    expect(clear(new Solids(shapes), [0, -45], [0, 45], 1)).toBe(true);
    // the middle piece alone would not have opened it
    expect(carvePassages([station()], [lines[1]], deep).opened.size).toBe(0);
  });

  it('opens with a pavement only what its street opens: a tower beside the bridge stays', () => {
    // a walkway beside the bridge all the way, through a tower the street itself does not cross
    const tower = { ...box(9, -5, 16, 5, 60), id: 'tower' };
    const lines = [line('primary', [[0, -50], [0, 50]], { bridge: true, widthM: 11 }), line('path', [[12, -50], [12, 50]], { bridge: true })];
    const { shapes, opened } = carvePassages([station(), tower], lines, valley);
    expect(opened.has(0)).toBe(true);
    expect(opened.has(1)).toBe(false);
    expect(shapes.filter((b) => b.id === 'tower')).toEqual([tower]);
  });

  it('takes the roof off a passage where a bridge runs over it', () => {
    // a street goes through the station under its roof, and a bridge crosses the same stretch
    const lines = [line('service', [[-50, 0], [50, 0]]), line('minor', [[0, -50], [0, 50]], { bridge: true, widthM: 8 })];
    const { shapes } = carvePassages([station()], lines, valley);
    const roof = shapes.filter((s) => s.minHeight > 0);
    expect(roof.length).toBeGreaterThan(0);
    const roofed = new Solids(roof.map((r) => ({ ...r, minHeight: 0 })));
    expect(roofed.inside(-30, 0)).toBe(true);
    expect(roofed.inside(0, 0)).toBe(false);
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
