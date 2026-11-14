/**
 * Roofs in the colours of the place. Where a mapper recorded a building's colour or material, the
 * building gets it. One with nothing recorded takes the colour of one of its nearest recorded
 * neighbours, so a brick quarter comes out brick and a plastered one pale. Where too little is
 * recorded nearby, the square's own mix is used if it has one, and otherwise the plain palette
 * every place had before.
 *
 * The pick comes from where the building stands on the earth, so a building keeps its colour on
 * every visit and when the next square loads.
 */

import { Color } from 'three';
import type { Projector } from '../geo/projection';
import type { MappedColour } from '../geo/tiles';

/** The plain roofs of a place with nothing recorded. */
const PLAIN = ['#e9e2d3', '#d9cfc0', '#c9b9a6', '#b9a394', '#cfd3d6', '#b4bcc2', '#d6b9a0', '#c98f78', '#a8b3a0', '#e3d8b8'].map((c) => new Color(c));

const CELL = 80;
/** a building looks this far for recorded neighbours (m), and needs this many to follow them */
const REACH = 400;
const ENOUGH = 6;
const NEAREST = 12;
/** the whole square's mix is used from this many recorded buildings */
const SQUARE_ENOUGH = 15;

interface Shade {
  colour: Color;
  /** greens and blues are shown where recorded but never handed on: a guessed roof must not read as a park, water or a package */
  spreads: boolean;
}

/** A recorded colour as a roof seen from above: toned down, never a signal colour. */
function roof(hex: string): Shade {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const hue = hsl.h * 360;
  const spreads = !(hsl.s > 0.22 && hue > 75 && hue < 300);
  // pure yellow turns olive when darkened: keep it light and warm
  const s = Math.min(hsl.s, 0.42);
  const l = Math.min(0.86, Math.max(0.42, hsl.l * 0.8 + 0.16));
  return { colour: new Color().setHSL(hsl.h, s, l), spreads };
}

function hash(a: number, b: number): number {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export interface LocalColours {
  at(e: number, n: number): Color;
  /** of the buildings asked about: how many had a recorded colour, took a neighbour's, the square's, or stayed plain */
  counts: { mapped: number; neighbours: number; square: number; plain: number };
}

export function localColours(mapped: MappedColour[], proj: Projector): LocalColours {
  const shades = new Map<string, Shade>();
  const pts = mapped.map((m) => {
    // colours that differ by a hair are one colour
    const key = m.colour.toLowerCase().replace(/^#(.).(.).(.).$/, '$1$2$3');
    let shade = shades.get(key);
    if (!shade) shades.set(key, (shade = roof(m.colour)));
    return { x: m.x, y: m.y, shade, tall: m.height >= 25 };
  });
  const cells = new Map<number, number[]>();
  const cellOf = (cx: number, cy: number) => (cx + 512) * 1024 + cy + 512;
  pts.forEach((p, i) => {
    const k = cellOf(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
    const list = cells.get(k);
    if (list) list.push(i);
    else cells.set(k, [i]);
  });
  // the square's own mix, for buildings with too few recorded neighbours
  const whole = new Map<Shade, number>();
  for (const p of pts) if (p.shade.spreads && !p.tall) whole.set(p.shade, (whole.get(p.shade) ?? 0) + 1);
  const wholeN = [...whole.values()].reduce((a, b) => a + b, 0);

  /** One of the shades, each with the chance of its count squared: what is common spreads, an odd one barely. */
  const pick = (mix: Map<Shade, number>, r: number): Shade => {
    let total = 0;
    for (const n of mix.values()) total += n * n;
    let t = r * total;
    for (const [shade, n] of mix) {
      t -= n * n;
      if (t <= 0) return shade;
    }
    return mix.keys().next().value as Shade;
  };

  const counts = { mapped: 0, neighbours: 0, square: 0, plain: 0 };
  const rings = Math.ceil(REACH / CELL);
  return {
    counts,
    at(e, n) {
      const ll = proj.toLngLat(e, n);
      const a = Math.round(ll.lat * 1e5);
      const b = Math.round(ll.lon * 1e5);
      const r = hash(a, b);
      const cx = Math.floor(e / CELL);
      const cy = Math.floor(n / CELL);
      const near: Array<{ d: number; i: number }> = [];
      for (let ring = 0; ring <= rings; ring++) {
        for (let dy = -ring; dy <= ring; dy++)
          for (let dx = -ring; dx <= ring; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            for (const i of cells.get(cellOf(cx + dx, cy + dy)) ?? []) {
              const d = Math.hypot(pts[i].x - e, pts[i].y - n);
              if (d <= REACH) near.push({ d, i });
            }
          }
        // what the next ring holds is further off than a ring's width
        if (near.length >= NEAREST && ring >= 1) break;
      }
      near.sort((p, q) => p.d - q.d);
      // its own recorded colour
      if (near.length && near[0].d < 2.5) {
        counts.mapped++;
        return pts[near[0].i].shade.colour;
      }
      const mix = new Map<Shade, number>();
      let got = 0;
      for (const { i } of near) {
        const p = pts[i];
        // houses take from houses: a tower's glass or a recorded green doesn't spread
        if (!p.shade.spreads || p.tall) continue;
        mix.set(p.shade, (mix.get(p.shade) ?? 0) + 1);
        if (++got >= NEAREST) break;
      }
      if (got >= ENOUGH) {
        counts.neighbours++;
        return pick(mix, r).colour;
      }
      if (wholeN >= SQUARE_ENOUGH && hash(b, a) < 0.6) {
        counts.square++;
        return pick(whole, r).colour;
      }
      counts.plain++;
      return PLAIN[Math.floor(r * PLAIN.length)];
    },
  };
}
