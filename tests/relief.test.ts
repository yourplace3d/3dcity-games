import { describe, expect, it } from 'vitest';
import { reliefPixels, snowLine } from '../src/scene/relief';
import type { HeightGrid } from '../src/geo/terrain';

const COLOURS = { slope: '#808080', cliff: '#404040', snow: '#ffffff' };

/** A square 1,500 m across, its heights from a function of (column, row), row 0 at the south. */
function grid(f: (i: number, j: number) => number, n = 33): HeightGrid {
  const elev = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) elev[j * n + i] = f(i, j);
  return { n, sizeM: 1500, elev, min: Math.min(...elev), max: Math.max(...elev), zoom: 14 };
}
const alpha = (data: Uint8ClampedArray, n: number, i: number, row: number) => data[(row * n + i) * 4 + 3];

describe('relief', () => {
  it('leaves flat low ground and gentle hills untouched', () => {
    const step = 1500 / 32;
    const r = reliefPixels(grid((i) => 40 + i * step * Math.tan((15 * Math.PI) / 180)), 52, COLOURS);
    expect(r.stats).toEqual({ bare: 0, cliff: 0, snow: 0 });
    expect(r.data.every((v, k) => k % 4 !== 3 || v === 0)).toBe(true);
  });

  it('shows a steep slope bare and a cliff darker', () => {
    const step = 1500 / 32;
    // west half at 45°, east half at 60°
    const r = reliefPixels(grid((i) => (i < 16 ? i * step : 16 * step + (i - 16) * step * Math.tan(Math.PI / 3))), 52, COLOURS);
    expect(r.stats.bare).toBe(1);
    expect(r.stats.cliff).toBeGreaterThan(0.4);
    expect(alpha(r.data, 33, 30, 10)).toBeGreaterThan(200);
    // the cliff is darker than the slope beside it
    expect(r.data[(10 * 33 + 30) * 4]).toBeLessThan(r.data[(10 * 33 + 5) * 4]);
  });

  it('puts snow on high ground only, and the snow line falls towards the poles', () => {
    expect(snowLine(0)).toBe(4800);
    expect(snowLine(-46)).toBe(2900);
    expect(snowLine(70)).toBeLessThan(snowLine(60));
    // flat ground at 3,500 m: snow in the Alps, none in the tropics
    expect(reliefPixels(grid(() => 3500), 46.5, COLOURS).stats.snow).toBe(1);
    expect(reliefPixels(grid(() => 3500), 5, COLOURS).stats.snow).toBe(0);
  });

  it('draws the picture with the north at the top', () => {
    // steep only in the northern rows
    const step = 1500 / 32;
    const r = reliefPixels(grid((_, j) => (j > 28 ? (j - 28) * step * 2 : 0)), 52, COLOURS);
    expect(alpha(r.data, 33, 16, 1)).toBeGreaterThan(0);
    expect(alpha(r.data, 33, 16, 31)).toBe(0);
  });
});
