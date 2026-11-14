/**
 * Fuel stations, fire stations and police stations, from the map's points of interest. They are
 * marked with a symbol and carry no name, and each kind hands out its own kind of job: a supply
 * run from a fuel station, a rush job from a fire station, a clean run from a police station.
 *
 * Where a part of town has none of a kind on the map, one is made up, so that every place has all
 * three kinds of job. A made-up one stands at a spot worked out from its position on the earth: the
 * same on every visit and for every player. Its symbol has a dashed ring, so the game never claims
 * a station stands where the map has none.
 */

import type { Projector } from '../geo/projection';
import type { LoadedTile } from '../geo/tiles';
import type { RoadNet } from './roads';

export type ServiceKind = 'fuel' | 'fire' | 'police';

export interface Service {
  kind: ServiceKind;
  x: number;
  y: number;
  /** not on the map: made up so that this part of town has one */
  invented?: boolean;
}

/** The job a kind of place hands out. `plain` is a package from a street corner, where no place is near. */
export type JobKind = 'plain' | 'supply' | 'rush' | 'clean';
export const JOB_OF: Record<ServiceKind, JobKind> = { fuel: 'supply', fire: 'rush', police: 'clean' };

const KIND: Record<string, ServiceKind> = { fuel: 'fuel', fire_station: 'fire', police: 'police' };

export function readServices(tiles: LoadedTile[], proj: Projector, half: number): Service[] {
  const out: Service[] = [];
  for (const t of tiles) {
    const layer = t.tile.layers.poi;
    if (!layer) continue;
    const n = 2 ** t.z;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type !== 1) continue;
      // by the map's sub-kind: its "fuel" class holds charging points for electric cars too
      const kind = KIND[String(f.properties.subclass ?? '')];
      if (!kind) continue;
      const pt = f.loadGeometry()[0]?.[0];
      // points near a tile's edge are repeated in its neighbours
      if (!pt || pt.x < 0 || pt.y < 0 || pt.x >= layer.extent || pt.y >= layer.extent) continue;
      const lon = ((t.x + pt.x / layer.extent) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
      const [x, y] = proj.toLocal(lon, lat);
      if (Math.abs(x) > half || Math.abs(y) > half) continue;
      // one mark for a place mapped twice (the building and its entrance, say)
      if (out.some((o) => o.kind === kind && Math.hypot(o.x - x, o.y - y) < 40)) continue;
      out.push({ kind, x, y });
    }
  }
  return out;
}

function hash(a: number, b: number, c: number): number {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b) ^ Math.imul(c, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** A cell of the earth about 1.2 km across holds one made-up place of each kind, unless a real one is near. */
const CELL_DEG = 0.011;
/** a real place of the kind this near (m) and none is made up */
const REAL_NEAR = 450;

/**
 * The made-up places a square needs. `real` is every real one in the loaded map, also those just
 * outside the square, so that the answer is the same from whichever square a spot is looked at.
 */
export function inventServices(real: Service[], proj: Projector, half: number, roads: RoadNet): Service[] {
  const out: Service[] = [];
  const sw = proj.toLngLat(-half, -half);
  const ne = proj.toLngLat(half, half);
  const kinds: ServiceKind[] = ['fuel', 'fire', 'police'];
  for (let row = Math.floor(sw.lat / CELL_DEG); row <= Math.floor(ne.lat / CELL_DEG); row++) {
    // cells as wide as they are tall, whatever the latitude
    const lonStep = CELL_DEG / Math.max(0.2, Math.cos((((row + 0.5) * CELL_DEG) * Math.PI) / 180));
    for (let col = Math.floor(sw.lon / lonStep); col <= Math.floor(ne.lon / lonStep); col++) {
      kinds.forEach((kind, k) => {
        const lat = (row + 0.15 + 0.7 * hash(row, col, k * 2 + 1)) * CELL_DEG;
        const lon = (col + 0.15 + 0.7 * hash(row, col, k * 2 + 2)) * lonStep;
        const [x, y] = proj.toLocal(lon, lat);
        if (Math.abs(x) > half - 40 || Math.abs(y) > half - 40) return;
        if (real.some((r) => r.kind === kind && Math.hypot(r.x - x, r.y - y) < REAL_NEAR)) return;
        // beside a street a car can reach
        const n = roads.nearest(x, y, 240, 'traffic');
        if (!n) return;
        const [rx, ry] = roads.point(n.line, n.s);
        const [hx, hy] = roads.heading({ line: n.line, s: n.s, dir: 1 });
        const side = roads.lines[n.line].w / 2 + 7;
        out.push({ kind, x: rx + hy * side, y: ry - hx * side, invented: true });
      });
    }
  }
  return out;
}

const icons = new Map<string, HTMLCanvasElement>();

/** The symbol of a kind of place: a round sign, 128 px, drawn once. A made-up place has a dashed ring. */
export function serviceIcon(kind: ServiceKind, invented = false): HTMLCanvasElement {
  const had = icons.get(kind + invented);
  if (had) return had;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const disc = (fill: string) => {
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fillStyle = '#16181c';
    g.fill();
    g.beginPath();
    g.arc(64, 64, 50, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  if (kind === 'fuel') {
    // a pump: a box with a window, and the hose at its side
    disc('#e8862e');
    g.fillStyle = '#16181c';
    g.fillRect(38, 34, 34, 58);
    g.fillRect(32, 90, 46, 8);
    g.fillStyle = '#f4f1ea';
    g.fillRect(44, 41, 22, 16);
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.strokeStyle = '#16181c';
    g.beginPath();
    g.moveTo(72, 56);
    g.lineTo(88, 56);
    g.lineTo(88, 84);
    g.stroke();
  } else if (kind === 'fire') {
    // a flame
    disc('#f4f1ea');
    g.fillStyle = '#d8362e';
    g.beginPath();
    g.moveTo(64, 24);
    g.bezierCurveTo(70, 46, 94, 54, 90, 80);
    g.bezierCurveTo(88, 96, 76, 104, 64, 104);
    g.bezierCurveTo(52, 104, 40, 96, 38, 80);
    g.bezierCurveTo(36, 66, 46, 60, 50, 50);
    g.bezierCurveTo(54, 58, 58, 60, 60, 56);
    g.bezierCurveTo(64, 46, 60, 34, 64, 24);
    g.fill();
    g.fillStyle = '#ffd400';
    g.beginPath();
    g.moveTo(64, 66);
    g.bezierCurveTo(72, 76, 78, 82, 74, 92);
    g.bezierCurveTo(72, 99, 56, 99, 54, 92);
    g.bezierCurveTo(51, 82, 60, 78, 64, 66);
    g.fill();
  } else {
    // a badge
    disc('#1f4fa8');
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.moveTo(64, 28);
    g.lineTo(92, 38);
    g.lineTo(92, 64);
    g.bezierCurveTo(92, 84, 78, 96, 64, 102);
    g.bezierCurveTo(50, 96, 36, 84, 36, 64);
    g.lineTo(36, 38);
    g.closePath();
    g.fill();
    g.fillStyle = '#1f4fa8';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 7 : 17;
      g.lineTo(64 + Math.cos(a) * r, 62 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }
  if (invented) {
    g.setLineDash([15, 11]);
    g.lineWidth = 9;
    g.strokeStyle = '#f4f1ea';
    g.beginPath();
    g.arc(64, 64, 55, 0, Math.PI * 2);
    g.stroke();
  }
  icons.set(kind + invented, c);
  return c;
}
