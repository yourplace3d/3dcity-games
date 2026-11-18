/**
 * Windows and doors on the buildings, drawn by the picture's own program: no extra shapes, no
 * pictures to load. Every wall is divided into bays and floors; each bay has a dark window, and on
 * the ground floor every fourth bay has a door instead. Not meant to be real: the map knows
 * nothing of windows.
 *
 * Buildings differ. Each gets a pattern by its size and by a number worked out from where it
 * stands, so it looks the same on every visit:
 * - small houses: few, squarish windows, often with a cross of glazing bars, sometimes shutters;
 * - houses of several floors: taller windows closer together, some with bars or shutters;
 * - tall or very large buildings: a tight grid, or bands of glass running round each floor.
 * A building at a well-known sight gets no pattern at all: an arch or a tower is not a block of flats.
 *
 * The part of the world nudges the odds for the smaller two kinds (`HABITS` below): glazing bars
 * are likelier in Britain, shutters and a rail below the window in France and around the
 * Mediterranean, a plain square grid in eastern Europe, wide windows in East Asia, and so on.
 *
 * A trial for now, switched on with `?try=windows` in the address and remembered by the browser
 * until `?try=nowindows`.
 */

import { BufferAttribute, type BufferGeometry, type MeshStandardMaterial } from 'three';

const KEPT = '3da-windows';

/** Whether the trial is on in this browser. Reads the address once and remembers. */
export function windowsOn(): boolean {
  try {
    const tries = (new URLSearchParams(location.search).get('try') ?? '').split(',');
    if (tries.includes('windows')) localStorage.setItem(KEPT, '1');
    if (tries.includes('nowindows')) localStorage.removeItem(KEPT);
    return localStorage.getItem(KEPT) === '1';
  } catch {
    return false;
  }
}

/** A number from 0 to 1 out of a spot and a salt, always the same for the same spot. */
function hash(x: number, z: number, salt: number): number {
  let h = (Math.imul(Math.round(x * 4), 0x9e3779b1) ^ Math.imul(Math.round(z * 4), 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** what a window has besides its glass: nothing, a cross of glazing bars, shutters at the sides, (a band of glass,) a rail below, a grille */
const PLAIN = 0;
const BARS = 1;
const SHUTTERS = 2;
const BAND = 3;
const RAIL = 4;
const GRILLE = 5;

/**
 * How windows tend to look in a part of the world: a nudge to the odds, not a rule. It touches
 * small houses and houses of several floors only; tall buildings look alike the world over. Near
 * the edge of a region its buildings mix with the neighbour's, so nothing flips at a border.
 * These are rough habits of older streets, and wrong for many a building: every town is mixed.
 */
interface Habit {
  /** south, west, north, east */
  box: [number, number, number, number];
  /** the glass in a bay, left and right edge, and in a floor, bottom and top */
  glass: [number, number, number, number];
  /** bay width: least, and how much more at most (m) */
  bay: [number, number];
  /** odds of glazing bars, shutters, a rail below, a grille; the rest are plain */
  odds: [number, number, number, number];
}

const HABITS: Habit[] = [
  // Britain and Ireland: tall, narrow, glazing bars
  { box: [49.9, -10.7, 59, 1.8], glass: [0.32, 0.66, 0.2, 0.84], bay: [2.8, 0.8], odds: [0.6, 0.02, 0, 0] },
  // France, the Low Countries, Spain and Portugal: very tall windows, shutters, a rail below
  { box: [36, -9.5, 51.3, 7.5], glass: [0.3, 0.68, 0.14, 0.86], bay: [2.8, 0.9], odds: [0.1, 0.4, 0.25, 0] },
  // Italy: the same habits
  { box: [36.5, 7.5, 46.5, 18.5], glass: [0.3, 0.68, 0.16, 0.86], bay: [3, 0.9], odds: [0.05, 0.5, 0.15, 0] },
  // central and northern Europe: squarer, a split of bars, few shutters
  { box: [46.5, 6, 71, 19], glass: [0.26, 0.72, 0.3, 0.78], bay: [3, 0.9], odds: [0.35, 0.08, 0, 0] },
  // eastern Europe and northern Asia: a rigid grid of square, plain windows
  { box: [41, 19, 70, 180], glass: [0.2, 0.8, 0.3, 0.74], bay: [3, 0.1], odds: [0.15, 0, 0, 0] },
  // North America: sash windows, some shutters
  { box: [24, -130, 60, -60], glass: [0.3, 0.68, 0.24, 0.82], bay: [3.2, 1.1], odds: [0.4, 0.12, 0, 0] },
  // Latin America: squarish, some grilles, some rails
  { box: [-56, -118, 24, -34], glass: [0.28, 0.7, 0.3, 0.78], bay: [3, 1], odds: [0.05, 0.1, 0.15, 0.2] },
  // North Africa and the Middle East: fewer and smaller openings
  { box: [12, -17, 36, 60], glass: [0.36, 0.6, 0.3, 0.76], bay: [3.6, 1], odds: [0, 0.05, 0, 0.1] },
  // South Asia: grilles here and there
  { box: [5, 60, 36, 93], glass: [0.28, 0.72, 0.3, 0.78], bay: [3, 1], odds: [0, 0.05, 0.05, 0.2] },
  // East Asia: wide windows close together, a strip of balcony
  { box: [18, 100, 46, 146], glass: [0.16, 0.84, 0.34, 0.76], bay: [2.6, 0.5], odds: [0, 0, 0.15, 0] },
  // South-East Asia: wide openings, some shutters
  { box: [-11, 92, 18, 142], glass: [0.18, 0.82, 0.3, 0.78], bay: [2.8, 0.7], odds: [0, 0.15, 0.05, 0.05] },
];

/** how far outside a region its habits still reach, fading (degrees) */
const FADE_DEG = 1.5;

/** How much each habit counts at a place: 1 well inside its region, fading to 0 outside. */
function habitsAt(lat: number, lon: number): Array<{ habit: Habit; share: number }> {
  const out: Array<{ habit: Habit; share: number }> = [];
  let sum = 0;
  for (const habit of HABITS) {
    const [s, w, n, e] = habit.box;
    const inside = Math.min(lat - s, n - lat, lon - w, e - lon);
    const share = Math.max(0, Math.min(1, (inside + FADE_DEG) / (2 * FADE_DEG)));
    if (share > 0) {
      out.push({ habit, share });
      sum += share;
    }
  }
  for (const o of out) o.share /= sum;
  return out;
}

/**
 * Give every building of the mesh its pattern, as two values per corner point:
 * `aWinA` = bay width (m; 0 = no windows), floor height (m), left and right edge of the glass in a bay;
 * `aWinB` = bottom and top edge of the glass in a floor, the kind of bars, a number for small differences.
 * `sights` are spots (metres east and north of the middle) whose building stays bare.
 * `lat`, `lon`: where on the earth the square lies, for the habits of the region.
 */
export function styleWindows(geometry: BufferGeometry, sights: Array<{ x: number; y: number }>, lat = 0, lon = 0): void {
  const habits = habitsAt(lat, lon);
  /** The habit a building follows: one of the region's, picked by the building's own number. */
  const habitFor = (r: number): Habit | null => {
    let upTo = 0;
    for (const h of habits) {
      upTo += h.share;
      if (r < upTo) return h.habit;
    }
    return null;
  };
  /** What a window has, by the habit's odds. */
  const extra = (h: Habit, r: number): number => {
    const [bars, shutters, rail, grille] = h.odds;
    return r < bars ? BARS : r < bars + shutters ? SHUTTERS : r < bars + shutters + rail ? RAIL : r < bars + shutters + rail + grille ? GRILLE : PLAIN;
  };
  const pos = geometry.getAttribute('position');
  const foot = geometry.getAttribute('aFoot');
  const hag = geometry.getAttribute('aHag');
  const n = pos.count;
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  let from = 0;
  while (from < n) {
    // a building's points lie together, and all carry the middle of its footprint
    const fx = foot.getX(from);
    const fz = foot.getY(from);
    let to = from;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    let high = 0;
    while (to < n && foot.getX(to) === fx && foot.getY(to) === fz) {
      const x = pos.getX(to);
      const z = pos.getZ(to);
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      z1 = Math.max(z1, z);
      high = Math.max(high, hag.getX(to));
      to++;
    }
    const ground = (x1 - x0) * (z1 - z0);
    const r1 = hash(fx, fz, 1);
    const r2 = hash(fx, fz, 2);
    const r3 = hash(fx, fz, 3);
    const habit = habitFor(hash(fx, fz, 4));
    // scene z runs south: a sight's north is -z
    const bare = sights.some((s) => s.x > x0 - 10 && s.x < x1 + 10 && -s.y > z0 - 10 && -s.y < z1 + 10);
    let A: [number, number, number, number];
    let B: [number, number, number, number];
    if (bare || high < 2.4) {
      A = [0, 3.2, 0, 0];
      B = [0, 0, PLAIN, r3];
    } else if (high > 26 || ground > 2200) {
      // tall or very large: bands of glass, or a tight grid
      if (r1 < 0.45) {
        A = [3, 3.4, -0.01, 1.01];
        B = [0.38, 0.8, BAND, r3];
      } else {
        A = [2.2 + r2 * 0.6, 3.3, 0.14, 0.86];
        B = [0.22, 0.82, PLAIN, r3];
      }
    } else if (high > 9) {
      // several floors: taller windows, closer together
      if (habit) {
        A = [habit.bay[0] + r2 * habit.bay[1], 3.2, habit.glass[0], habit.glass[1]];
        B = [habit.glass[2], habit.glass[3], extra(habit, r1), r3];
      } else {
        A = [2.7 + r2 * 0.9, 3.2, 0.26, 0.7 + r1 * 0.06];
        B = [0.24, 0.82, r1 < 0.35 ? BARS : r1 < 0.55 ? SHUTTERS : PLAIN, r3];
      }
    } else {
      // a small house: few, squarish windows
      const floor = Math.max(2.6, Math.min(3.2, high));
      if (habit) {
        // a house has fewer windows than a house of flats: wider bays, a little less glass
        A = [habit.bay[0] + 0.5 + r2 * habit.bay[1], floor, habit.glass[0] + 0.03, habit.glass[1] - 0.03];
        B = [Math.max(habit.glass[2], 0.26), Math.min(habit.glass[3], 0.8), extra(habit, r1), r3];
      } else {
        A = [3.3 + r2 * 1.1, floor, 0.3, 0.66];
        B = [0.34, 0.76, r1 < 0.5 ? BARS : r1 < 0.75 ? SHUTTERS : PLAIN, r3];
      }
    }
    for (let k = from; k < to; k++) {
      a.set(A, k * 4);
      b.set(B, k * 4);
    }
    from = to;
  }
  geometry.setAttribute('aWinA', new BufferAttribute(a, 4));
  geometry.setAttribute('aWinB', new BufferAttribute(b, 4));
}

/** Add windows and doors to the buildings' material, on top of what it already does. */
export function addWindows(mat: MeshStandardMaterial): void {
  const before = mat.onBeforeCompile;
  mat.customProgramCacheKey = () => 'bldg-ao-windows-3';
  mat.onBeforeCompile = (shader, renderer) => {
    before.call(mat, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWinA;\nattribute vec4 aWinB;\nvarying vec4 vWinA;\nvarying vec4 vWinB;\nvarying vec3 vWinPos;\nvarying vec3 vWinNrm;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWinA = aWinA;\nvWinB = aWinB;\nvWinPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWinNrm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vWinA;\nvarying vec4 vWinB;\nvarying vec3 vWinPos;\nvarying vec3 vWinNrm;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
if (abs(vWinNrm.y) < 0.5 && vWinA.x > 0.5) {
  // along the wall and up it, counted in bays and floors
  vec2 along = normalize(vec2(-vWinNrm.z, vWinNrm.x));
  float u = dot(vWinPos.xz, along) / vWinA.x;
  float v = vHag / vWinA.y;
  float fu = fract(u);
  float fv = fract(v);
  // soft edges, and the whole pattern fades from far up, so that it does not flicker
  float eu = fwidth(u) * 1.2 + 0.001;
  float ev = fwidth(v) * 1.2 + 0.001;
  float far = clamp(1.0 - max(eu, ev) * 2.2, 0.0, 1.0);
  float kind = vWinB.z;
  float band = step(2.5, kind) * step(kind, 3.5);
  float inU = smoothstep(vWinA.z - eu, vWinA.z + eu, fu) * (1.0 - smoothstep(vWinA.w - eu, vWinA.w + eu, fu));
  float inV = smoothstep(vWinB.x - ev, vWinB.x + ev, fv) * (1.0 - smoothstep(vWinB.y - ev, vWinB.y + ev, fv));
  float win = mix(inU, 1.0, band) * inV;
  // a door in every fourth bay of the ground floor; a banded front has a glass ground floor instead
  float doorBay = step(mod(floor(u), 4.0), 0.5) * step(v, 1.0) * (1.0 - band);
  float door = smoothstep(0.28 - eu, 0.28 + eu, fu) * (1.0 - smoothstep(0.7 - eu, 0.7 + eu, fu)) * (1.0 - smoothstep(0.72 - ev, 0.72 + ev, fv));
  // the glass: a little lighter or bluer from one building to the next
  vec3 glass = mix(vec3(0.11, 0.14, 0.19), vec3(0.2, 0.27, 0.34), vWinB.w);
  diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * (1.0 - doorBay) * 0.82 * far);
  // glazing bars: a pale cross through the middle of the glass
  float bars = step(0.5, kind) * step(kind, 1.5);
  float mu = (vWinA.z + vWinA.w) * 0.5;
  float mv = (vWinB.x + vWinB.y) * 0.5;
  float cross = max(1.0 - smoothstep(0.012, 0.012 + eu, abs(fu - mu)), 1.0 - smoothstep(0.014, 0.014 + ev, abs(fv - mv)));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.86, 0.8), cross * win * bars * (1.0 - doorBay) * 0.85 * far);
  // shutters: a strip of colour at each side of the glass
  float shut = step(1.5, kind) * step(kind, 2.5);
  float side = (smoothstep(vWinA.z - 0.1 - eu, vWinA.z - 0.1 + eu, fu) * (1.0 - smoothstep(vWinA.z - eu, vWinA.z + eu, fu))
              + smoothstep(vWinA.w - eu, vWinA.w + eu, fu) * (1.0 - smoothstep(vWinA.w + 0.1 - eu, vWinA.w + 0.1 + eu, fu))) * inV;
  vec3 paint = vWinB.w < 0.34 ? vec3(0.2, 0.36, 0.27) : vWinB.w < 0.67 ? vec3(0.42, 0.25, 0.15) : vec3(0.2, 0.32, 0.47);
  diffuseColor.rgb = mix(diffuseColor.rgb, paint, side * shut * (1.0 - doorBay) * 0.9 * far);
  // a rail: a dark bar across the foot of the window, a little wider than the glass
  float rail = step(3.5, kind) * step(kind, 4.5);
  float railU = smoothstep(vWinA.z - 0.07 - eu, vWinA.z - 0.07 + eu, fu) * (1.0 - smoothstep(vWinA.w + 0.07 - eu, vWinA.w + 0.07 + eu, fu));
  float railV = smoothstep(vWinB.x - ev, vWinB.x + ev, fv) * (1.0 - smoothstep(vWinB.x + 0.09 - ev, vWinB.x + 0.09 + ev, fv));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.1, 0.11), railU * railV * rail * (1.0 - doorBay) * 0.85 * far);
  // a grille: thin upright bars over the glass
  float grille = step(4.5, kind) * step(kind, 5.5);
  float gu = fract((fu - vWinA.z) / max(vWinA.w - vWinA.z, 0.01) * 4.0);
  float gbar = 1.0 - smoothstep(0.1, 0.1 + eu * 6.0, abs(gu - 0.5));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.62, 0.6), gbar * win * grille * (1.0 - doorBay) * 0.6 * far);
  // the door, darker wood or lighter by the building
  vec3 wood = mix(vec3(0.3, 0.17, 0.1), vec3(0.16, 0.2, 0.24), step(0.6, vWinB.w));
  diffuseColor.rgb = mix(diffuseColor.rgb, wood, door * doorBay * 0.9 * far);
}`,
      );
  };
  mat.needsUpdate = true;
}
