/**
 * The little map in the corner: the streets around you, north up like the game itself, with the
 * way to the next ring drawn in, the rings, the subway entrances, and the police when they're
 * after you. The streets of a square are painted once; each frame only moves that picture.
 *
 * The same drawing makes the big map a tap on the little one opens: the whole loaded square,
 * standing still, with you moving on it.
 */

import type { Game } from './game';
import type { World } from './world';
import { serviceIcon } from './services';

/** How far the map shows in each direction from you (m). */
const RANGE_M = 260;
const BASE_PX = 1200;

const MAJOR = new Set(['motorway', 'primary', 'secondary', 'tertiary']);

export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement | null = null;
  private baseOf: World | null = null;

  /** `whole`: show the whole loaded square instead of the streets around you. */
  constructor(private readonly canvas: HTMLCanvasElement, private readonly whole = false) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** The streets of a square, painted once. */
  private streets(world: World): HTMLCanvasElement {
    if (this.base && this.baseOf === world) return this.base;
    const c = this.base ?? document.createElement('canvas');
    c.width = BASE_PX;
    c.height = BASE_PX;
    const ctx = c.getContext('2d')!;
    const size = world.half * 2;
    const s = BASE_PX / size;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a2f37';
    ctx.fillRect(0, 0, BASE_PX, BASE_PX);
    ctx.setTransform(s, 0, 0, -s, world.half * s, world.half * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const major of [false, true]) {
      ctx.strokeStyle = major ? '#d5d9df' : '#7f8792';
      ctx.lineWidth = (major ? 3.4 : 1.7) / s;
      ctx.beginPath();
      for (const l of world.roads.lines) {
        if (!l.drive || l.kind === 'service' || MAJOR.has(l.kind) !== major) continue;
        ctx.moveTo(l.pts[0][0], l.pts[0][1]);
        for (let k = 1; k < l.pts.length; k++) ctx.lineTo(l.pts[k][0], l.pts[k][1]);
      }
      ctx.stroke();
    }
    this.base = c;
    this.baseOf = world;
    return c;
  }

  draw(game: Game): void {
    const el = this.canvas;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const css = el.clientWidth;
    if (!css) return;
    const W = Math.round(css * dpr);
    if (el.width !== W) {
      el.width = W;
      el.height = W;
    }
    const ctx = this.ctx;
    const view = game.mapView();
    const world = game.world;
    const m = W / (2 * (this.whole ? world.half : RANGE_M));
    // the middle of the picture: you, or the middle of the square
    const cx = this.whole ? 0 : view.x;
    const cy = this.whole ? 0 : view.y;
    /** marks are a little bigger on the big map */
    const big = this.whole ? 1.35 : 1;
    const base = this.streets(world);
    const k = (m * world.half * 2) / BASE_PX;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // outside the loaded square: open ground
    ctx.fillStyle = '#20242a';
    ctx.fillRect(0, 0, W, W);
    ctx.setTransform(k, 0, 0, k, W / 2 - ((cx + world.half) / (world.half * 2)) * BASE_PX * k, W / 2 - ((world.half - cy) / (world.half * 2)) * BASE_PX * k);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const at = (x: number, y: number): [number, number] => [W / 2 + (x - cx) * m, W / 2 - (y - cy) * m];
    /** A point kept inside the frame: what is further away sits at the edge, in its direction. */
    const pinned = (x: number, y: number): [number, number, boolean] => {
      const [sx, sy] = at(x, y);
      const lim = W / 2 - 7 * dpr;
      const dx = sx - W / 2;
      const dy = sy - W / 2;
      const over = Math.max(Math.abs(dx), Math.abs(dy)) / lim;
      return over > 1 ? [W / 2 + dx / over, W / 2 + dy / over, true] : [sx, sy, false];
    };
    const dot = (x: number, y: number, r: number, fill: string, ring?: string) => {
      ctx.beginPath();
      ctx.arc(x, y, r * dpr * big, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      if (ring) {
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = ring;
        ctx.stroke();
      }
    };

    if (view.route && view.route.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [width, colour] of [[5, 'rgba(0,0,0,0.55)'], [3, view.drop ? '#ffd400' : '#2bd4e0']] as Array<[number, string]>) {
        ctx.lineWidth = width * dpr * big;
        ctx.strokeStyle = colour;
        ctx.beginPath();
        view.route.forEach(([x, y], i) => {
          const [sx, sy] = at(x, y);
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        });
        ctx.stroke();
      }
    }
    for (const s of world.stops) {
      if (s.kind !== 'subway') continue;
      const [sx, sy] = at(s.x, s.y);
      if (sx < 0 || sy < 0 || sx > W || sy > W) continue;
      ctx.fillStyle = '#1f6fd6';
      ctx.fillRect(sx - 2.5 * dpr * big, sy - 2.5 * dpr * big, 5 * dpr * big, 5 * dpr * big);
    }
    // fuel, fire and police stations: their symbol
    for (const s of world.services) {
      const [sx, sy] = at(s.x, s.y);
      if (sx < 0 || sy < 0 || sx > W || sy > W) continue;
      const r = (this.whole ? 9 : 7) * dpr;
      ctx.drawImage(serviceIcon(s.kind, !!s.invented), sx - r, sy - r, r * 2, r * 2);
    }
    // well-known sights: a gold star, and on the big map the name beside it
    for (const s of world.sights) {
      const [sx, sy] = at(s.x, s.y);
      if (sx < 0 || sy < 0 || sx > W || sy > W) continue;
      const r = 6.5 * dpr * big;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const q = i % 2 ? r * 0.45 : r;
        ctx.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffd400';
      ctx.fill();
      ctx.lineWidth = 1.2 * dpr;
      ctx.strokeStyle = '#2a2400';
      ctx.stroke();
      if (this.whole) {
        ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        const left = sx > W * 0.7;
        ctx.textAlign = left ? 'right' : 'left';
        const tx = sx + (left ? -1 : 1) * (r + 4 * dpr);
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = 'rgba(16,18,22,0.9)';
        ctx.strokeText(s.name, tx, sy);
        ctx.fillStyle = '#ffe680';
        ctx.fillText(s.name, tx, sy);
      }
    }
    for (const [x, y] of view.pickups) {
      const [sx, sy] = pinned(x, y);
      dot(sx, sy, 4.5, '#2bd4e0', '#0c2a2e');
    }
    if (view.drop) {
      const [sx, sy] = pinned(view.drop[0], view.drop[1]);
      dot(sx, sy, 5.5, '#ffd400', '#2a2400');
    }
    if (view.cops.length && Math.floor(performance.now() / 300) % 2 === 0) {
      for (const [x, y] of view.cops) {
        const [sx, sy, far] = pinned(x, y);
        if (!far) dot(sx, sy, 3.5, '#ff5a4d', '#fff');
      }
    }
    // you: an arrowhead the way you face
    ctx.save();
    ctx.translate(...at(view.x, view.y));
    ctx.rotate(Math.PI / 2 - view.th);
    ctx.scale(big, big);
    ctx.beginPath();
    ctx.moveTo(0, -7 * dpr);
    ctx.lineTo(5 * dpr, 6 * dpr);
    ctx.lineTo(0, 3 * dpr);
    ctx.lineTo(-5 * dpr, 6 * dpr);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = '#1c1f24';
    ctx.stroke();
    ctx.restore();
    if (this.whole) return;
    // a mark in the corner: this map opens
    const c = W - 13 * dpr;
    const a = 5 * dpr;
    ctx.lineWidth = 1.6 * dpr;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    for (const sgn of [1, -1]) {
      ctx.moveTo(c + sgn * a, 13 * dpr - sgn * a + sgn * a * 0.9);
      ctx.lineTo(c + sgn * a, 13 * dpr - sgn * a);
      ctx.lineTo(c + sgn * a - sgn * a * 0.9, 13 * dpr - sgn * a);
    }
    ctx.moveTo(c - a, 13 * dpr + a);
    ctx.lineTo(c + a, 13 * dpr - a);
    ctx.stroke();
  }
}
