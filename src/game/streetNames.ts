/**
 * The names of the main streets, for the big map only. The street view and the little map stay
 * without names.
 *
 * The map data carries a name along each named street. Kept here are the main ones (motorways,
 * trunk roads, and what the map calls primary, secondary and tertiary streets), one label for a
 * name every few hundred metres, each at the middle of its longest piece and turned to lie along it.
 */

import type { Projector } from '../geo/projection';
import type { LoadedTile } from '../geo/tiles';

export interface StreetLabel {
  name: string;
  /** where the label's middle lies (metres east and north of the square's middle) */
  x: number;
  y: number;
  /** the direction of the street there (radians, east = 0, north = π/2) */
  angle: number;
  /** how long the piece it lies on is (m): a label longer than that is left out */
  room: number;
  /** 0 for the biggest streets, rising */
  rank: number;
}

const RANK: Record<string, number> = { motorway: 0, trunk: 0, primary: 1, secondary: 2, tertiary: 3 };
/** no two labels closer than this (m), and none of the same name closer than that */
const APART_M = 110;
const SAME_NAME_APART_M = 480;
const MOST = 60;

export function readStreetNames(tiles: LoadedTile[], proj: Projector, half: number): StreetLabel[] {
  const found: StreetLabel[] = [];
  for (const t of tiles) {
    const layer = t.tile.layers.transportation_name;
    if (!layer) continue;
    const n = 2 ** t.z;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type !== 2) continue;
      const rank = RANK[String(f.properties.class ?? '')];
      const name = String(f.properties['name:latin'] ?? f.properties.name ?? '').trim();
      if (rank === undefined || !name) continue;
      for (const line of f.loadGeometry()) {
        // the piece as points in the square, with its length up to each
        const pts: Array<[number, number]> = [];
        for (const p of line) {
          const lon = ((t.x + p.x / layer.extent) / n) * 360 - 180;
          const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + p.y / layer.extent)) / n))) * 180) / Math.PI;
          pts.push(proj.toLocal(lon, lat));
        }
        if (pts.length < 2) continue;
        let length = 0;
        const upTo = [0];
        for (let k = 1; k < pts.length; k++) {
          length += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
          upTo.push(length);
        }
        if (length < 60) continue;
        // its middle, and the direction there
        let k = 1;
        while (k < pts.length - 1 && upTo[k] < length / 2) k++;
        const [ax, ay] = pts[k - 1];
        const [bx, by] = pts[k];
        const seg = upTo[k] - upTo[k - 1] || 1;
        const f2 = (length / 2 - upTo[k - 1]) / seg;
        const x = ax + (bx - ax) * f2;
        const y = ay + (by - ay) * f2;
        if (Math.abs(x) > half - 20 || Math.abs(y) > half - 20) continue;
        found.push({ name, x, y, angle: Math.atan2(by - ay, bx - ax), room: length, rank });
      }
    }
  }
  // the biggest streets first, and of those the longest pieces
  found.sort((a, b) => a.rank - b.rank || b.room - a.room);
  const kept: StreetLabel[] = [];
  for (const l of found) {
    if (kept.length >= MOST) break;
    if (kept.some((o) => Math.hypot(o.x - l.x, o.y - l.y) < (o.name === l.name ? SAME_NAME_APART_M : APART_M))) continue;
    kept.push(l);
  }
  return kept;
}

/** Every named street piece in the square, of any size, as points: to say which street a building stands on. */
export function readNamedStreets(tiles: LoadedTile[], proj: Projector, half: number): Array<{ name: string; pts: Array<[number, number]> }> {
  const out: Array<{ name: string; pts: Array<[number, number]> }> = [];
  for (const t of tiles) {
    const layer = t.tile.layers.transportation_name;
    if (!layer) continue;
    const n = 2 ** t.z;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type !== 2) continue;
      const name = String(f.properties['name:latin'] ?? f.properties.name ?? '').trim();
      if (!name) continue;
      for (const line of f.loadGeometry()) {
        const pts: Array<[number, number]> = [];
        for (const p of line) {
          const lon = ((t.x + p.x / layer.extent) / n) * 360 - 180;
          const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + p.y / layer.extent)) / n))) * 180) / Math.PI;
          pts.push(proj.toLocal(lon, lat));
        }
        if (pts.length >= 2 && pts.some(([x, y]) => Math.abs(x) < half + 60 && Math.abs(y) < half + 60)) out.push({ name, pts });
      }
    }
  }
  return out;
}
