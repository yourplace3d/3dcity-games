/**
 * Roads as flat ribbons lying on the terrain. The ground texture has them too, but from as
 * close as the game's camera its pixels show; the ribbons keep kerbs and lane dashes sharp.
 */

import { BufferAttribute, BufferGeometry, DoubleSide, Group, type Material, Mesh, MeshStandardMaterial } from 'three';
import type { Pt } from '../geo/polygon';
import { PALETTE } from '../scene/overlay';
import type { RoadLine, RoadNet } from './roads';

/**
 * Seen from straight above a hill looks flat. The light is made to treat every slope as this many
 * times steeper than it is, so the side of a hill away from the sun is clearly darker.
 */
export const RELIEF = 3.2;

/** Give a mesh's surface the leaning normals that make its slopes show (y is up). */
export function showRelief(geo: BufferGeometry): void {
  const nor = geo.getAttribute('normal') as BufferAttribute | undefined;
  if (!nor) return;
  const a = nor.array as Float32Array;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i] * RELIEF;
    const z = a[i + 2] * RELIEF;
    const l = Math.hypot(x, a[i + 1], z) || 1;
    a[i] = x / l;
    a[i + 1] /= l;
    a[i + 2] = z / l;
  }
  nor.needsUpdate = true;
}

/** Ribbons bend with the ground at least this often (m). */
const STEP_M = 5;
/** Wide ribbons bend across their width too, in pieces no wider than this (m). */
const ACROSS_M = 5;

/**
 * A normal for every corner, from the triangles around it, always facing up whichever way the
 * ribbon's line runs. Plain arrays: the library's own routine took a third of the time to lay a
 * square's streets.
 */
function upNormals(pos: number[], idx: number[]): Float32Array {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    let x = uy * vz - uz * vy;
    let y = uz * vx - ux * vz;
    let z = ux * vy - uy * vx;
    if (y < 0) {
      x = -x;
      y = -y;
      z = -z;
    }
    n[a] += x;
    n[a + 1] += y;
    n[a + 2] += z;
    n[b] += x;
    n[b + 1] += y;
    n[b + 2] += z;
    n[c] += x;
    n[c + 1] += y;
    n[c + 2] += z;
  }
  for (let i = 0; i < n.length; i += 3) {
    // lean further than the ground does, as the ground's own shading is made to (see `showRelief`)
    const flat = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] *= RELIEF;
    n[i + 2] *= RELIEF;
    n[i + 1] = Math.max(n[i + 1], flat * 0.05);
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (l > 0) {
      n[i] /= l;
      n[i + 1] /= l;
      n[i + 2] /= l;
    } else n[i + 1] = 1;
  }
  return n;
}

/**
 * Draw a flat thing on the ground as if it were a little nearer the camera than it is, without
 * moving it. A ribbon bends every few metres and the ground between can rise a touch above it;
 * this keeps the ground from showing through. Less than the height of anything that stands on a
 * street, so cars, people and signs still cover the road.
 */
export function drawnOverGround(mat: Material, metres = 0.3): void {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
vec4 nearer = projectionMatrix * (mvPosition + vec4(0.0, 0.0, ${metres.toFixed(2)}, 0.0));
gl_Position.z = nearer.z / nearer.w * gl_Position.w;`,
    );
  };
  mat.customProgramCacheKey = () => `over-ground-${metres}`;
}

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
    const cols = Math.max(1, Math.ceil(width / ACROSS_M));
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
      for (let k = 0; k <= cols; k++) {
        const s = 1 - (2 * k) / cols;
        const x = c[0] + nx * hw * m * s;
        const y = c[1] + ny * hw * m * s;
        this.pos.push(x, groundY(x, y) + lift, -y);
      }
      if (i > 0) {
        const row = cols + 1;
        for (let k = 0; k < cols; k++) {
          const v = base + i * row + k;
          this.idx.push(v - row, v - row + 1, v, v - row + 1, v + 1, v);
        }
      }
    }
  }

  /** A flat round patch on the ground: the end of a street that leads nowhere further. */
  disc(x: number, y: number, r: number, lift: number, groundY: (x: number, y: number) => number): void {
    const base = this.pos.length / 3;
    this.pos.push(x, groundY(x, y) + lift, -y);
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      this.pos.push(px, groundY(px, py) + lift, -py);
    }
    for (let i = 0; i < N; i++) this.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % N));
  }

  /** The ribbon as plain geometry, for a caller with its own material. */
  geometry(): BufferGeometry {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    geo.setIndex(new BufferAttribute(Uint32Array.from(this.idx), 1));
    return geo;
  }

  /** `layer`: ribbons with a higher number are drawn over those with a lower one. */
  mesh(colour: string, layer: number): Mesh<BufferGeometry, MeshStandardMaterial> {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    geo.setIndex(new BufferAttribute(Uint32Array.from(this.idx), 1));
    geo.setAttribute('normal', new BufferAttribute(upNormals(this.pos, this.idx), 3));
    const mat = new MeshStandardMaterial({ color: colour, roughness: 0.95, metalness: 0, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false });
    drawnOverGround(mat);
    const mesh = new Mesh(geo, mat);
    // ribbons don't hide one another by height: where streets cross on a slope the kerb of one
    // would cut through the surface of the other. They are drawn in a fixed order instead.
    mesh.renderOrder = layer;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** The point `s` metres along a line. */
function at(l: RoadLine, s: number): Pt {
  let i = 0;
  while (i < l.pts.length - 2 && l.cum[i + 1] < s) i++;
  const t = (s - l.cum[i]) / Math.max(1e-6, l.cum[i + 1] - l.cum[i]);
  return [l.pts[i][0] + (l.pts[i + 1][0] - l.pts[i][0]) * t, l.pts[i][1] + (l.pts[i + 1][1] - l.pts[i][1]) * t];
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

/** A line moved `d` metres to its left (negative: right), for one rail of a track. */
function beside(pts: Pt[], d: number): Pt[] {
  return pts.map((c, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [c[0] - ((b[1] - a[1]) / l) * d, c[1] + ((b[0] - a[0]) / l) * d];
  });
}

/** `pause` is awaited halfway, so the caller can let a frame through. */
export async function buildRoadMeshes(net: RoadNet, groundY: (x: number, y: number) => number, pause: () => Promise<void>): Promise<Group> {
  const kerb = new Strip();
  const fill = new Strip();
  const path = new Strip();
  const paint = new Strip();
  const rails = new Strip();
  // a railway: a bed of gravel, sleepers across it, two rails
  const bed = new Strip();
  const sleepers = new Strip();
  // a tram's track lies in the street: a darker band with two rails
  const groove = new Strip();
  const stairs = new Strip();
  const treads = new Strip();
  const arrows = new Strip();
  // in a big station the sleepers are spaced out, to keep the square quick to build
  const trackM = net.lines.reduce((a, l) => a + (l.train ? l.len : 0), 0);
  const gap = trackM > 20000 ? 1.9 : 0.8;
  for (const l of net.lines) {
    if (l.tram || l.train) {
      const gauge = l.train ? 0.78 : 0.72;
      if (l.train) {
        bed.add(l.pts, 3.6, 0.04, groundY);
        for (const d of dashes(l, 0.34, gap)) sleepers.add(d, 2.7, 0.06, groundY);
      } else groove.add(l.pts, 2, 0.14, groundY);
      rails.add(beside(l.pts, gauge), 0.22, 0.18, groundY);
      rails.add(beside(l.pts, -gauge), 0.22, 0.18, groundY);
      continue;
    }
    if (l.steps) {
      // a stairway: a pale strip with a tread every step, plainly not for cars
      stairs.add(l.pts, 3, 0.05, groundY);
      for (const d of dashes(l, 0.3, 0.55)) treads.add(d, 3, 0.07, groundY);
      continue;
    }
    if (l.kind === 'path') {
      path.add(l.pts, l.w, 0.05, groundY);
      continue;
    }
    kerb.add(l.pts, l.w + 4, 0.07, groundY);
    fill.add(l.pts, l.w, 0.12, groundY);
    // where a street stops with no street to go on to, a round end: the ground picture draws one,
    // and showed as a dark blob past the street's square end
    for (const e of [0, 1]) {
      if (l.ends[e].some((c) => net.lines[c.line].drive)) continue;
      const [x, y] = l.pts[e ? l.pts.length - 1 : 0];
      kerb.disc(x, y, l.w / 2 + 2, 0.07, groundY);
      fill.disc(x, y, l.w / 2, 0.12, groundY);
    }
    if (l.traffic && l.w >= 7.5) for (const d of dashes(l, 3, 6)) paint.add(d, 0.28, 0.17, groundY);
    // steep streets carry arrowheads pointing uphill, every 22 m where the street climbs more than 1 in 10
    if (l.traffic) {
      for (let s0 = 11; s0 + 6 < l.len; s0 += 22) {
        const a = at(l, s0);
        const b = at(l, s0 + 6);
        const rise = groundY(b[0], b[1]) - groundY(a[0], a[1]);
        if (Math.abs(rise) < 0.6) continue;
        // from the low end to the high end
        const [lo, hi] = rise > 0 ? [a, b] : [b, a];
        const ux = (hi[0] - lo[0]) / 6;
        const uy = (hi[1] - lo[1]) / 6;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const arm = Math.min(1.5, l.w / 2 - 0.7);
        const tip: Pt = [mx + ux * 0.9, my + uy * 0.9];
        for (const side of [-1, 1]) arrows.add([[mx - ux * 0.9 - uy * arm * side, my - uy * 0.9 + ux * arm * side], tip], 0.34, 0.17, groundY);
      }
    }
  }
  await pause();
  const g = new Group();
  // drawn in this order: a street lies over the gravel where they cross, and the rails over the street
  g.add(stairs.mesh('#d8d0c0', 1), treads.mesh('#8f8676', 2), arrows.mesh('#c9c3b4', 6), bed.mesh('#a39a8b', 1), sleepers.mesh('#6f6355', 2), path.mesh(PALETTE.path, 3), kerb.mesh(PALETTE.roadCasing, 4), fill.mesh(PALETTE.roadFill, 5), paint.mesh('#e9e6dc', 6), groove.mesh('#3a3e45', 7), rails.mesh('#c3c8d0', 8));
  return g;
}

export function disposeRoadMeshes(g: Group): void {
  for (const m of g.children as Array<Mesh<BufferGeometry, MeshStandardMaterial>>) {
    m.geometry.dispose();
    m.material.dispose();
  }
}
