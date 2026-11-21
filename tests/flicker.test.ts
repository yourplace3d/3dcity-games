import { describe, expect, it } from 'vitest';
import { ROOF_STEP_M, roofTops, type BuildingSpec } from '../src/scene/buildingsMesh';
import { localColours } from '../src/game/localColours';
import { makeProjector } from '../src/geo/projection';
import { paintKind } from '../src/scene/overlay';
import type { Ring } from '../src/geo/polygon';

const box = (x0: number, y0: number, x1: number, y1: number): Ring => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const spec = (outer: Ring, height: number): BuildingSpec => ({ poly: { outer, holes: [] }, height, minHeight: 0, estimated: false });

describe('roofs that overlap', () => {
  it('lifts one of two overlapping roofs at the same height, so they do not flicker', () => {
    const tops = roofTops([spec(box(0, 0, 40, 20), 24), spec(box(10, 5, 30, 15), 24), spec(box(12, 6, 20, 14), 24)]);
    expect(tops[0]).toBe(24);
    expect(new Set([...tops].map((t) => t.toFixed(2))).size).toBe(3);
    for (const t of tops) expect(t - 24).toBeLessThanOrEqual(ROOF_STEP_M * 2 + 1e-6);
  });

  it('leaves neighbours that only touch, and roofs at other heights, alone', () => {
    const tops = roofTops([spec(box(0, 0, 10, 10), 12), spec(box(10, 0, 20, 10), 12), spec(box(2, 2, 8, 8), 20)]);
    expect([...tops]).toEqual([12, 12, 20]);
  });
});

describe('roof colours', () => {
  it('gives a building the same colour from any square, by its number', () => {
    const a = localColours([], makeProjector({ lat: 52.52, lon: 13.4 }));
    const b = localColours([], makeProjector({ lat: 52.5335, lon: 13.4 }));
    // the same building, cut off differently at the edge of two squares: its middle moves
    const one = a.at(100, 740, '12345').getHexString();
    const two = b.at(100, -760, '12345').getHexString();
    expect(two).toBe(one);
  });

  it('finds a recorded colour by the building number even when the middle moved', () => {
    const c = localColours([{ x: 0, y: 0, colour: '#aa3322', height: 10, id: '7' }], makeProjector({ lat: 52.52, lon: 13.4 }));
    expect(c.at(30, 30, '7').getHexString()).toBe(c.at(0, 0).getHexString());
  });
});

describe('green on squares', () => {
  it('paints lawns over a pedestrian square, parks under it', () => {
    expect(paintKind({ kind: 'green', polys: [], cls: 'grass' })).toBe('lawn');
    expect(paintKind({ kind: 'green', polys: [], cls: 'park' })).toBe('green');
    expect(paintKind({ kind: 'green', polys: [] })).toBe('green');
    expect(paintKind({ kind: 'plaza', polys: [] })).toBe('plaza');
  });
});
