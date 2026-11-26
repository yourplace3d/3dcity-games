import { describe, expect, it } from 'vitest';
import { overWaterRuns, waterBodies, waterTest } from '../src/game/river';
import type { AreaFeature, LineFeature } from '../src/geo/osm';
import type { Pt } from '../src/geo/polygon';

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

describe('water outlines', () => {
  it('joins a river cut at a tile edge into one outline, so no wall stands across it', () => {
    // two tiles' pieces, overlapping by a metre as the tiles' clipping leaves them
    const areas: AreaFeature[] = [
      { kind: 'water', cls: 'river', polys: [{ outer: rect(-400, -30, 1, 30), holes: [] }] },
      { kind: 'water', cls: 'river', polys: [{ outer: rect(-1, -30, 400, 30), holes: [] }] },
    ];
    const bodies = waterBodies(areas, [], [], 750);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].quay).toBe(true);
    const xs = bodies[0].poly.outer.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(-400);
    expect(Math.max(...xs)).toBeCloseTo(400);
  });

  it('widens a canal the map has only as a line, and leaves a river line inside its area alone', () => {
    const areas: AreaFeature[] = [{ kind: 'water', cls: 'river', polys: [{ outer: rect(-300, -30, 300, 30), holes: [] }] }];
    const lines: LineFeature[] = [
      { kind: 'river', widthM: 22, bridge: false, pts: [[-300, 0], [300, 0]] },
      { kind: 'canal', widthM: 14, bridge: false, pts: [[0, 0], [0, 200]] },
    ];
    const bodies = waterBodies(areas, lines, [], 750);
    expect(bodies).toHaveLength(1);
    const wet = waterTest(bodies);
    expect(wet(0, 150)).toBe(true);
    expect(wet(6, 150)).toBe(true);
    expect(wet(9, 150)).toBe(false);
    // the river's centreline is 22 m wide, but the river itself 60 m: the river's own banks stand
    expect(wet(100, 25)).toBe(true);
    expect(wet(100, 35)).toBe(false);
  });

  it('gives a lake a natural bank, and clips water to the square', () => {
    const areas: AreaFeature[] = [
      { kind: 'water', cls: 'lake', polys: [{ outer: rect(-50, -50, 50, 50), holes: [] }] },
      { kind: 'water', cls: 'river', polys: [{ outer: rect(600, -30, 900, 30), holes: [] }] },
    ];
    const bodies = waterBodies(areas, [], [], 750);
    expect(bodies.find((b) => !b.quay)).toBeTruthy();
    const river = bodies.find((b) => b.quay)!;
    expect(Math.max(...river.poly.outer.map((p) => p[0]))).toBeCloseTo(750);
  });

  it('keeps an island in a river as land', () => {
    const areas: AreaFeature[] = [{ kind: 'water', cls: 'river', polys: [{ outer: rect(-300, -40, 300, 40), holes: [rect(-20, -10, 20, 10).reverse() as Pt[]] }] }];
    const wet = waterTest(waterBodies(areas, [], [], 750));
    expect(wet(0, 0)).toBe(false);
    expect(wet(0, 25)).toBe(true);
  });
});

describe('bridges', () => {
  it('builds the deck over the water and a piece onto each bank, not over the land beyond', () => {
    const wet = (_x: number, y: number) => Math.abs(y) < 30;
    const runs = overWaterRuns([[0, -100], [0, 100]], wet);
    expect(runs).toHaveLength(1);
    const ys = runs[0].map((p) => p[1]);
    expect(Math.min(...ys)).toBeGreaterThan(-40);
    expect(Math.min(...ys)).toBeLessThan(-30);
    expect(Math.max(...ys)).toBeGreaterThan(30);
    expect(Math.max(...ys)).toBeLessThan(40);
  });
});
