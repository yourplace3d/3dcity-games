/**
 * What you can't drive or walk through: the walls of the buildings, as an index of their edges,
 * and the water, as a raster. Circles are pushed out of walls; cars are two circles.
 */

import type { AreaFeature, LineFeature } from '../geo/osm';
import { pointInRing, type Polygon } from '../geo/polygon';

const CELL = 24;
/** Building parts that start this high are roofs and bridges between houses: you pass beneath. */
const OVERHEAD_M = 2.6;

export interface SolidBuilding {
  poly: Polygon;
  height: number;
  minHeight: number;
}

export interface Push {
  /** the direction the circle was pushed (unit), and how far */
  nx: number;
  ny: number;
  depth: number;
}

export class Solids {
  private ax: Float32Array;
  private ay: Float32Array;
  private bx: Float32Array;
  private by: Float32Array;
  private readonly cells = new Map<number, number[]>();
  private readonly polyCells = new Map<number, number[]>();
  private readonly polys: Polygon[] = [];
  private readonly tall = new Map<number, number>();

  constructor(buildings: SolidBuilding[]) {
    const ax: number[] = [];
    const ay: number[] = [];
    const bx: number[] = [];
    const by: number[] = [];
    for (const b of buildings) {
      if (b.minHeight > OVERHEAD_M) continue;
      const id = this.polys.length;
      this.polys.push(b.poly);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const ring of [b.poly.outer, ...b.poly.holes]) {
        for (let i = 0; i < ring.length; i++) {
          const p = ring[i];
          const q = ring[(i + 1) % ring.length];
          const e = ax.length;
          ax.push(p[0]);
          ay.push(p[1]);
          bx.push(q[0]);
          by.push(q[1]);
          add(this.cells, Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), e);
          x0 = Math.min(x0, p[0]);
          y0 = Math.min(y0, p[1]);
          x1 = Math.max(x1, p[0]);
          y1 = Math.max(y1, p[1]);
        }
      }
      add(this.polyCells, x0, y0, x1, y1, id);
      // the tallest roof per cell, so the camera can stay above the houses around you
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
        for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
          const k = key(cx, cy);
          if ((this.tall.get(k) ?? 0) < b.height) this.tall.set(k, b.height);
        }
    }
    this.ax = Float32Array.from(ax);
    this.ay = Float32Array.from(ay);
    this.bx = Float32Array.from(bx);
    this.by = Float32Array.from(by);
  }

  /**
   * Push a circle out of the walls it overlaps. Outer rings run counter-clockwise and holes
   * clockwise, so the open side of every edge is on its right: a centre that has slipped just
   * behind a wall is pushed back out through it.
   */
  push(c: { x: number; y: number }, r: number): Push | null {
    let out: Push | null = null;
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      const x0 = Math.floor((c.x - r) / CELL);
      const x1 = Math.floor((c.x + r) / CELL);
      const y0 = Math.floor((c.y - r) / CELL);
      const y1 = Math.floor((c.y + r) / CELL);
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const list = this.cells.get(key(cx, cy));
          if (!list) continue;
          for (const e of list) {
            const ax = this.ax[e];
            const ay = this.ay[e];
            const dx = this.bx[e] - ax;
            const dy = this.by[e] - ay;
            const L2 = dx * dx + dy * dy;
            if (L2 < 1e-8) continue;
            const t = ((c.x - ax) * dx + (c.y - ay) * dy) / L2;
            const tc = Math.max(0, Math.min(1, t));
            const ox = c.x - (ax + dx * tc);
            const oy = c.y - (ay + dy * tc);
            const d = Math.hypot(ox, oy);
            if (d >= r) continue;
            const L = Math.sqrt(L2);
            let nx = dy / L;
            let ny = -dx / L;
            let depth: number;
            if (t > 0 && t < 1) {
              const side = ox * nx + oy * ny;
              // far behind the wall is the inside of a big building: leave that to the caller
              if (side < -r) continue;
              depth = r - side;
            } else {
              if (d < 1e-6) continue;
              nx = ox / d;
              ny = oy / d;
              depth = r - d;
            }
            c.x += nx * depth;
            c.y += ny * depth;
            moved = true;
            if (!out || depth > out.depth) out = { nx, ny, depth };
          }
        }
      if (!moved) break;
    }
    return out;
  }

  /** Whether a point is inside a building. */
  inside(x: number, y: number): boolean {
    const list = this.polyCells.get(key(Math.floor(x / CELL), Math.floor(y / CELL)));
    if (!list) return false;
    for (const id of list) {
      const p = this.polys[id];
      if (pointInRing([x, y], p.outer) && !p.holes.some((h) => pointInRing([x, y], h))) return true;
    }
    return false;
  }

  /** Whether a building stands between two points. */
  blocked(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(d / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.inside(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
    }
    return false;
  }

  /** The tallest building near a point (m). */
  tallestNear(x: number, y: number, r: number): number {
    let m = 0;
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++)
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) m = Math.max(m, this.tall.get(key(cx, cy)) ?? 0);
    return m;
  }
}

function key(cx: number, cy: number): number {
  return (cx + 4096) * 8192 + (cy + 4096);
}

function add(cells: Map<number, number[]>, x0: number, y0: number, x1: number, y1: number, id: number): void {
  for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      const k = key(cx, cy);
      const list = cells.get(k);
      if (list) list.push(id);
      else cells.set(k, [id]);
    }
}

/** Lakes, rivers and the sea as a raster over the square: 1 where there is water. */
export class WaterMask {
  private readonly data: Uint8Array;
  private readonly px = 1024;

  constructor(areas: AreaFeature[], lines: LineFeature[], sea: Polygon[], private readonly sizeM: number) {
    const c = document.createElement('canvas');
    c.width = this.px;
    c.height = this.px;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const s = this.px / sizeM;
    const h = sizeM / 2;
    ctx.setTransform(s, 0, 0, -s, h * s, h * s);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const p of [...areas.filter((a) => a.kind === 'water').flatMap((a) => a.polys), ...sea]) {
      for (const ring of [p.outer, ...p.holes]) {
        if (ring.length < 3) continue;
        ctx.moveTo(ring[0][0], ring[0][1]);
        for (let k = 1; k < ring.length; k++) ctx.lineTo(ring[k][0], ring[k][1]);
        ctx.closePath();
      }
    }
    ctx.fill('nonzero');
    for (const l of lines) {
      if (l.kind !== 'river' && l.kind !== 'canal') continue;
      ctx.lineWidth = l.widthM;
      ctx.beginPath();
      ctx.moveTo(l.pts[0][0], l.pts[0][1]);
      for (let k = 1; k < l.pts.length; k++) ctx.lineTo(l.pts[k][0], l.pts[k][1]);
      ctx.stroke();
    }
    const img = ctx.getImageData(0, 0, this.px, this.px).data;
    this.data = new Uint8Array(this.px * this.px);
    for (let i = 0; i < this.data.length; i++) this.data[i] = img[i * 4] > 127 ? 1 : 0;
  }

  at(x: number, y: number): boolean {
    const h = this.sizeM / 2;
    const i = Math.floor(((x + h) / this.sizeM) * this.px);
    const j = Math.floor(((h - y) / this.sizeM) * this.px);
    if (i < 0 || j < 0 || i >= this.px || j >= this.px) return false;
    return this.data[j * this.px + i] === 1;
  }
}

/** Streams and ditches: narrow water a car can ford. Their lines, findable by place. */
export class Streams {
  private readonly cells = new Map<number, number[]>();
  private readonly segs: number[] = [];
  private static readonly CELL = 40;

  constructor(lines: Array<{ kind: string; widthM: number; pts: Array<[number, number]> }>) {
    for (const l of lines) {
      if (l.kind !== 'stream') continue;
      for (let i = 0; i < l.pts.length - 1; i++) {
        const [ax, ay] = l.pts[i];
        const [bx, by] = l.pts[i + 1];
        const id = this.segs.length / 5;
        this.segs.push(ax, ay, bx, by, l.widthM / 2);
        const c = Streams.CELL;
        for (let cy = Math.floor((Math.min(ay, by) - 4) / c); cy <= Math.floor((Math.max(ay, by) + 4) / c); cy++)
          for (let cx = Math.floor((Math.min(ax, bx) - 4) / c); cx <= Math.floor((Math.max(ax, bx) + 4) / c); cx++) {
            const k = (cx + 512) * 1024 + cy + 512;
            const list = this.cells.get(k);
            if (list) list.push(id);
            else this.cells.set(k, [id]);
          }
      }
    }
  }

  /** Whether a point is in a stream's bed (with a little bank either side). */
  at(x: number, y: number): boolean {
    const c = Streams.CELL;
    const list = this.cells.get((Math.floor(x / c) + 512) * 1024 + Math.floor(y / c) + 512);
    if (!list) return false;
    for (const id of list) {
      const [ax, ay, bx, by, hw] = this.segs.slice(id * 5, id * 5 + 5);
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(x - ax - dx * t, y - ay - dy * t) <= hw + 0.8) return true;
    }
    return false;
  }
}
