/**
 * The ground's own lie, painted on it: steep slopes bare, cliffs darker, high tops under snow.
 *
 * Worked out once, when a square loads, from the height grid the ground is built from (a point every
 * 7.8 m), so it costs nothing while playing and needs no data beyond the heights already loaded. The
 * result is a small picture, a pixel for each point of the grid, which the ground's picture draws
 * stretched and smoothed over the land and under squares, water, roads and woods (`overlay.ts`).
 *
 * The heights come from data 10–30 m across, which rounds every edge off: a slope of 30° in the grid is
 * a steep hillside, and a real cliff seldom shows steeper than 45–50°. The thresholds are set for that.
 *
 * Snow lies above the line where snow stays all year, which falls from about 4,800 m in the tropics to
 * sea level near the poles (a smooth guess from latitude alone; glaciers on the map are painted apart).
 * Snow does not stay on a cliff.
 */

import type { HeightGrid } from '../geo/terrain';

/** Slopes start to show bare from this many degrees, and are fully bare at `SLOPE_FULL`. */
export const SLOPE_FROM = 24;
export const SLOPE_FULL = 38;
/** Steeper than this the bare slope turns into a darker cliff, fully at `CLIFF_FULL`. */
export const CLIFF_FROM = 40;
export const CLIFF_FULL = 55;
/** How strongly a bare slope covers the green or fields beneath (0–1). */
const SLOPE_ALPHA = 0.7;
const CLIFF_ALPHA = 0.85;
/** Snow fades in over this many metres either side of the snow line. */
const SNOW_BAND_M = 150;

/** Latitude (degrees, either side of the equator) → height of the lasting snow line (m). */
const SNOW_LINE: Array<[number, number]> = [
  [0, 4800],
  [20, 4800],
  [35, 3800],
  [46, 2900],
  [60, 1300],
  [70, 500],
  [80, 100],
  [90, 0],
];

export function snowLine(lat: number): number {
  const a = Math.min(90, Math.abs(lat));
  for (let k = 1; k < SNOW_LINE.length; k++) {
    const [l1, h1] = SNOW_LINE[k];
    if (a <= l1) {
      const [l0, h0] = SNOW_LINE[k - 1];
      return h0 + ((a - l0) / (l1 - l0)) * (h1 - h0);
    }
  }
  return 0;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface ReliefColours {
  slope: string;
  cliff: string;
  snow: string;
}

export interface ReliefStats {
  /** share of the square's points that show bare, a cliff or snow */
  bare: number;
  cliff: number;
  snow: number;
}

/**
 * The picture's pixels: RGBA, `grid.n` × `grid.n`, row 0 at the north edge (as a picture is read).
 * Fully see-through where the ground is gentle and below the snow, which is nearly everywhere in most towns.
 */
export function reliefPixels(grid: HeightGrid, lat: number, colours: ReliefColours): { data: Uint8ClampedArray<ArrayBuffer>; stats: ReliefStats } {
  const { n, elev } = grid;
  const step = grid.sizeM / (n - 1);
  const data = new Uint8ClampedArray(n * n * 4);
  const sl = rgb(colours.slope);
  const cl = rgb(colours.cliff);
  const sn = rgb(colours.snow);
  const line = snowLine(lat);
  let bare = 0;
  let cliffs = 0;
  let snowy = 0;
  const at = (i: number, j: number) => elev[Math.max(0, Math.min(n - 1, j)) * n + Math.max(0, Math.min(n - 1, i))];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // central differences (one-sided at the edges)
      const dx = (at(i + 1, j) - at(i - 1, j)) / (step * (i === 0 || i === n - 1 ? 1 : 2));
      const dy = (at(i, j + 1) - at(i, j - 1)) / (step * (j === 0 || j === n - 1 ? 1 : 2));
      const deg = (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI;
      const wSlope = smooth(SLOPE_FROM, SLOPE_FULL, deg);
      const wCliff = smooth(CLIFF_FROM, CLIFF_FULL, deg);
      const wSnow = smooth(line - SNOW_BAND_M, line + SNOW_BAND_M, elev[j * n + i]) * (1 - wCliff);
      if (wSlope <= 0 && wSnow <= 0) continue;
      if (wSlope > 0.5) bare++;
      if (wCliff > 0.5) cliffs++;
      if (wSnow > 0.5) snowy++;
      // bare slope, darkening into cliff
      let r = sl[0] + (cl[0] - sl[0]) * wCliff;
      let g = sl[1] + (cl[1] - sl[1]) * wCliff;
      let b = sl[2] + (cl[2] - sl[2]) * wCliff;
      let a = Math.max(wSlope * SLOPE_ALPHA, wCliff * CLIFF_ALPHA);
      // snow over it ("over" compositing of a snow layer on the slope layer)
      if (wSnow > 0) {
        const aOut = wSnow + a * (1 - wSnow);
        r = (sn[0] * wSnow + r * a * (1 - wSnow)) / aOut;
        g = (sn[1] * wSnow + g * a * (1 - wSnow)) / aOut;
        b = (sn[2] * wSnow + b * a * (1 - wSnow)) / aOut;
        a = aOut;
      }
      const o = ((n - 1 - j) * n + i) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = Math.round(a * 255);
    }
  }
  const all = n * n;
  return { data, stats: { bare: bare / all, cliff: cliffs / all, snow: snowy / all } };
}

/** The picture for `Overlay.relief`, or null where the square has nothing to show (most towns). */
export function reliefImage(grid: HeightGrid, lat: number, colours: ReliefColours): { image: HTMLCanvasElement; spanM: number; px: number; stats: ReliefStats } | null {
  const { data, stats } = reliefPixels(grid, lat, colours);
  if (stats.bare === 0 && stats.snow === 0 && !data.some((v, k) => k % 4 === 3 && v > 0)) return null;
  const c = document.createElement('canvas');
  c.width = grid.n;
  c.height = grid.n;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(data, grid.n, grid.n), 0, 0);
  return { image: c, spanM: grid.sizeM, px: grid.n, stats };
}

function rgb(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
