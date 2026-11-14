/**
 * Fuel stations, fire stations and police stations, from the map's points of interest. They are
 * marked with a symbol and carry no name. They do nothing yet: the marks are there so that later
 * play can build on places the player has already seen.
 */

import type { Projector } from '../geo/projection';
import type { LoadedTile } from '../geo/tiles';

export type ServiceKind = 'fuel' | 'fire' | 'police';

export interface Service {
  kind: ServiceKind;
  x: number;
  y: number;
}

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

const icons = new Map<ServiceKind, HTMLCanvasElement>();

/** The symbol of a kind of place: a round sign, 128 px, drawn once. */
export function serviceIcon(kind: ServiceKind): HTMLCanvasElement {
  const had = icons.get(kind);
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
  icons.set(kind, c);
  return c;
}
