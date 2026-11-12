/**
 * Roads as flat ribbons lying on the terrain. The ground texture has them too, but from as
 * close as the game's camera its pixels show; the ribbons keep kerbs and lane dashes sharp.
 */

import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Pt } from '../geo/polygon';
import { PALETTE } from '../scene/overlay';
import type { RoadLine, RoadNet } from './roads';

/** Ribbons bend with the ground at least this often (m). */
const STEP_M = 9;

export class Strip {
  private readonly pos: number[] = [];
  private readonly idx: number[] = [];

  /** A ribbon along `pts`, `width` wide, `lift` above the ground. */
  add(pts: Pt[], width: number, lift: number, groundY: (x: number, y: number) => number): void {
    const p: Pt[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP_M));
      for (let k = 1; k <= n; k++) p.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    const hw = width / 2;
    const base = this.pos.length / 3;
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)];
      const b = p[Math.min(p.length - 1, i + 1)];
      const c = p[i];
      // the corner's normal: the average of the two sides, stretched so the ribbon keeps its width
      let n0x = -(c[1] - a[1]);
      let n0y = c[0] - a[0];
      let n1x = -(b[1] - c[1]);
      let n1y = b[0] - c[0];
      const l0 = Math.hypot(n0x, n0y);
      const l1 = Math.hypot(n1x, n1y);
      if (l0 > 1e-6) {
        n0x /= l0;
        n0y /= l0;
      }
      if (l1 > 1e-6) {
        n1x /= l1;
        n1y /= l1;
      }
      if (l0 <= 1e-6) [n0x, n0y] = [n1x, n1y];
      if (l1 <= 1e-6) [n1x, n1y] = [n0x, n0y];
      let nx = n0x + n1x;
      let ny = n0y + n1y;
      const l = Math.hypot(nx, ny);
      if (l < 1e-6) [nx, ny] = [n0x, n0y];
      else {
        nx /= l;
        ny /= l;
      }
      const m = Math.min(1.8, 1 / Math.max(0.2, nx * n0x + ny * n0y));
      for (const s of [1, -1]) {
        const x = c[0] + nx * hw * m * s;
        const y = c[1] + ny * hw * m * s;
        this.pos.push(x, groundY(x, y) + lift, -y);
      }
      if (i > 0) {
        const v = base + i * 2;
        this.idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
      }
    }
  }

  /** The ribbon as plain geometry, for a caller with its own material. */
  geometry(): BufferGeometry {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    geo.setIndex(new BufferAttribute(Uint32Array.from(this.idx), 1));
    return geo;
  }

  mesh(colour: string, offset: number): Mesh<BufferGeometry, MeshStandardMaterial> {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    geo.setIndex(new BufferAttribute(Uint32Array.from(this.idx), 1));
    geo.computeVertexNormals();
    // every ribbon faces up, whichever way its line runs
    const normals = geo.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) if (normals.getY(i) < 0) normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
    const mat = new MeshStandardMaterial({ color: colour, roughness: 0.95, metalness: 0, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset });
    const mesh = new Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Pieces of a line: `on` metres drawn, `off` metres left out. */
function dashes(l: RoadLine, on: number, off: number): Pt[][] {
  const out: Pt[][] = [];
  const at = (s: number): Pt => {
    let i = 0;
    while (i < l.pts.length - 2 && l.cum[i + 1] < s) i++;
    const t = (s - l.cum[i]) / Math.max(1e-6, l.cum[i + 1] - l.cum[i]);
    return [l.pts[i][0] + (l.pts[i + 1][0] - l.pts[i][0]) * t, l.pts[i][1] + (l.pts[i + 1][1] - l.pts[i][1]) * t];
  };
  for (let s = off / 2; s + on < l.len; s += on + off) out.push([at(s), at(s + on)]);
  return out;
}

export function buildRoadMeshes(net: RoadNet, groundY: (x: number, y: number) => number): Group {
  const kerb = new Strip();
  const fill = new Strip();
  const path = new Strip();
  const paint = new Strip();
  for (const l of net.lines) {
    if (l.kind === 'path') {
      path.add(l.pts, l.w, 0.05, groundY);
      continue;
    }
    kerb.add(l.pts, l.w + 4, 0.07, groundY);
    fill.add(l.pts, l.w, 0.12, groundY);
    if (l.traffic && l.w >= 7.5) for (const d of dashes(l, 3, 6)) paint.add(d, 0.28, 0.17, groundY);
  }
  const g = new Group();
  g.add(path.mesh(PALETTE.path, -1), kerb.mesh(PALETTE.roadCasing, -2), fill.mesh(PALETTE.roadFill, -3), paint.mesh('#e9e6dc', -4));
  return g;
}

export function disposeRoadMeshes(g: Group): void {
  for (const m of g.children as Array<Mesh<BufferGeometry, MeshStandardMaterial>>) {
    m.geometry.dispose();
    m.material.dispose();
  }
}
