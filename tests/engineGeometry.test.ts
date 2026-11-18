import { describe, expect, it } from 'vitest';
import { groupPolygons, type Ring } from '../src/geo/polygon';
import { fillHoles, type HeightGrid } from '../src/geo/terrain';
import { addRoads, surfaceMm } from '../src/export/roads';
import { buildPrint, toBinaryStl, Triangles } from '../src/export/stl';

const square = (lo: number, hi: number): Ring => [[lo, lo], [hi, lo], [hi, hi], [lo, hi]];

describe('map geometry', () => {
  it('assigns a hole on an island to that island, regardless of outer-ring order', () => {
    const lake = square(-100, 100);
    const island = square(-20, 20);
    const islandLake = square(-5, 5);
    const islandShore = square(-30, 30);
    for (const outers of [[lake, island], [island, lake]]) {
      const polygons = groupPolygons(outers, [islandShore, islandLake]);
      expect(polygons.find((p) => p.outer === lake)?.holes).toHaveLength(1);
      expect(polygons.find((p) => p.outer === island)?.holes).toHaveLength(1);
    }
  });

  it('fills enclosed elevation defects but preserves deep water continuing beyond the mosaic', () => {
    const enclosed = new Float32Array(25).fill(2);
    enclosed[12] = -100;
    expect(fillHoles(enclosed, 5, 5)).toBe(1);
    expect(enclosed[12]).toBe(2);

    const openWater = new Float32Array(25).fill(2);
    openWater[10] = openWater[11] = -100;
    expect(fillHoles(openWater, 5, 5)).toBe(0);
    expect(openWater[11]).toBe(-100);
  });
});

describe('print roads', () => {
  it('interpolates variable road heights where the model boundary clips a road', () => {
    const grid: HeightGrid = { n: 2, sizeM: 100, elev: new Float32Array(4), min: 0, max: 0, zoom: 14 };
    const triangles = new Triangles();
    addRoads(triangles, grid, [{ pts: [[-100, 0], [100, 0]], widthM: 10, bridge: false, raises: [1, 21] }], { s: 1, exaggeration: 1 });
    let checked = 0;
    for (let i = 0; i < triangles.count * 9; i += 3) {
      const x = triangles.data[i];
      const z = triangles.data[i + 2];
      if (z < 0) continue; // buried floor
      expect(z).toBeCloseTo(1 + (x + 100) / 10, 2);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('keeps a bridge deck at its interpolated height where the square cuts it', () => {
    const grid: HeightGrid = { n: 2, sizeM: 100, elev: new Float32Array([0, 20, 0, 20]), min: 0, max: 20, zoom: 14 };
    const triangles = new Triangles();
    addRoads(triangles, grid, [{ pts: [[-100, 0], [100, 0]], widthM: 10, bridge: true }], { s: 1, exaggeration: 1 });
    let checked = 0;
    for (let i = 0; i < triangles.count * 9; i += 3) {
      const x = triangles.data[i];
      const y = triangles.data[i + 1];
      const z = triangles.data[i + 2];
      if (Math.abs(x + 49.99) > 0.001 || z < surfaceMm(grid, x, y, 1, 1)) continue;
      expect(z).toBeCloseTo((x + 100) / 10 + 0.4, 3);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('exports closed terrain, courtyard buildings and clipped roads with finite STL normals', () => {
    const grid: HeightGrid = { n: 3, sizeM: 100, elev: new Float32Array([0, 2, 4, 1, 5, 2, 3, 2, 1]), min: 0, max: 5, zoom: 14 };
    const triangles = buildPrint(grid, [{ poly: { outer: square(-20, 20), holes: [square(-10, 10).reverse()] }, top: 15 }], {
      sideMm: 100, baseMm: 3, exaggeration: 1,
    }, [{ pts: [[-80, -30], [80, -30]], widthM: 6, bridge: true }]);
    expect(triangles.skipped).toBe(0);
    const edges = new Map<string, number>();
    const point = (i: number) => [...triangles.data.subarray(i, i + 3)].join(',');
    for (let i = 0; i < triangles.count * 9; i += 9) {
      for (const [a, b] of [[i, i + 3], [i + 3, i + 6], [i + 6, i]]) {
        const key = [point(a), point(b)].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
    const stl = toBinaryStl(triangles, 'regression');
    expect(stl.byteLength).toBe(84 + triangles.count * 50);
    const view = new DataView(stl);
    for (let offset = 84; offset < stl.byteLength; offset += 50) {
      const normal = [0, 4, 8].map((n) => view.getFloat32(offset + n, true));
      expect(Math.hypot(...normal)).toBeCloseTo(1, 5);
    }
  });
});
