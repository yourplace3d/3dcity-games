/**
 * Rivers, canals, harbours and lakes as shapes of their own, with banks and bridges that show.
 *
 * Painted into the ground picture (0.4 to 0.7 m a pixel), the water's edge was a soft blur from the
 * game's camera, with no bank, and a bridge was a street lying flat on the water. Now:
 *
 * - **The water is cut out of the ground** along the map's own outline, and lies below the bank: 1.4 m
 *   for rivers, canals, docks and the sea, 0.45 m for a lake or pond.
 * - **A quay wall** stands along the edge of a river, canal, dock or the sea: a pale stone coping on top,
 *   covering the cut edge, and a wall face down to the water that darkens where it is wet. A lake gets a
 *   low earth bank instead.
 * - **The ground under the water is levelled** with the banks before anything is built on it, so a
 *   bridge runs level from bank to bank instead of dipping to where the height data saw the river.
 * - **A bridge over the water** gets a deck wider than its street, side faces down to below the deck,
 *   a parapet along each side and piers in the water.
 *
 * The water areas are joined into one outline first (map tiles cut them at every tile edge), so no
 * wall stands across the river where two tiles meet.
 */

import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import polygonClipping, { type Geom, type MultiPolygon } from 'polygon-clipping';
import type { AreaFeature, LineFeature } from '../geo/osm';
import { pointInRing, ringBounds, type Polygon, type Pt, type Ring } from '../geo/polygon';
import { fromMulti, toGeom, closed } from '../geo/clip';
import type { HeightGrid } from '../geo/terrain';
import { isSea, seaMaskFromPolygons } from '../geo/sea';
import { Strip } from './roadMesh';
import type { RoadNet } from './roads';

/** How far the water lies below the bank (m). */
export const QUAY_DROP_M = 1.4;
const BANK_DROP_M = 0.45;
/** The coping along a quay, centred on the water's edge: it covers the soft edge of the cut in the ground picture (m). */
const COPING_W = 1.5;
const BANK_W = 1.1;
/** Shore pieces are no longer than this, so walls and copings follow the ground (m). */
const PIECE_M = 4;

/** Water the map calls these has a natural bank, not a quay wall. */
const SOFT = new Set(['lake', 'pond', 'reservoir', 'basin', 'wastewater', 'lagoon', 'oxbow']);

export interface WaterBody {
  poly: Polygon;
  /** a quay wall (river, canal, dock, sea), or a low natural bank (lake, pond) */
  quay: boolean;
}

/** Find which of many polygons contain a point, quickly. */
class PolyIndex {
  private readonly boxes: Array<[number, number, number, number]>;
  constructor(readonly polys: Polygon[]) {
    this.boxes = polys.map((p) => ringBounds(p.outer));
  }
  has(x: number, y: number): boolean {
    for (let i = 0; i < this.polys.length; i++) {
      const b = this.boxes[i];
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      const p = this.polys[i];
      if (pointInRing([x, y], p.outer) && !p.holes.some((h) => pointInRing([x, y], h))) return true;
    }
    return false;
  }
}

/** A line's points, no further apart than `step`. */
function densify(pts: Pt[], step: number, closedRing = false): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  const last = closedRing ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  if (!closedRing) out.push(pts[n - 1]);
  return out;
}

/** A line without the points that lie on the straight between their neighbours (within 0.3 m). */
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = out[out.length - 1];
    const c = pts[i + 1];
    const b = pts[i];
    const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    if (Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / l > 0.3) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A thick line as one outline: its left side out and its right side back. */
function strokeOutline(pts: Pt[], width: number): Geom {
  const hw = width / 2;
  const left = leftNormals(pts, false);
  const ring: Ring = [...pts.map((p, i): Pt => [p[0] + left[i][0] * hw, p[1] + left[i][1] * hw]), ...pts.map((p, i): Pt => [p[0] - left[i][0] * hw, p[1] - left[i][1] * hw]).reverse()];
  return [closed(ring)];
}

/** Points to the centimetre: the exact clipper stumbles on points that nearly, but not quite, meet. */
const snap = (g: Geom): Geom => (g as Ring[]).map((r) => r.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Pt));

/** One outline from many, leaving out a piece the exact clipper cannot join rather than giving up on all. */
function union(geoms: Geom[]): MultiPolygon {
  if (!geoms.length) return [];
  const all = geoms.map(snap);
  try {
    const [first, ...rest] = all;
    return polygonClipping.union(first, ...rest);
  } catch {
    let acc: MultiPolygon = [];
    for (const g of all) {
      try {
        acc = acc.length ? polygonClipping.union(acc, g) : polygonClipping.union(g);
      } catch {
        // left out
      }
    }
    return acc;
  }
}

/**
 * The water of a square as clean outlines: areas joined across tile edges, rivers and canals the
 * map has only as lines widened to their width (only where no area already covers them), clipped
 * to the square. `half` is half the square's width.
 */
export function waterBodies(areas: AreaFeature[], lines: LineFeature[], sea: Polygon[], half: number): WaterBody[] {
  const quay: Geom[] = sea.map(toGeom);
  const bank: Geom[] = [];
  const all: Polygon[] = [...sea];
  for (const a of areas) {
    if (a.kind !== 'water') continue;
    for (const p of a.polys) {
      if (p.outer.length < 3) continue;
      (a.cls && SOFT.has(a.cls) ? bank : quay).push(toGeom(p));
      all.push(p);
    }
  }
  // a river or canal drawn only as a line: widened, wherever no water area already lies under it
  const inArea = new PolyIndex(all);
  for (const l of lines) {
    if (l.kind !== 'river' && l.kind !== 'canal') continue;
    const pts = densify(l.pts, 3);
    let run: Pt[] = [];
    const flush = () => {
      if (run.length >= 2) quay.push(strokeOutline(simplify(run), l.widthM));
      run = [];
    };
    for (let i = 0; i < pts.length; i++) {
      if (!inArea.has(pts[i][0], pts[i][1])) {
        // reach a point into the area it comes from, so the two join
        if (!run.length && i > 0) run.push(pts[i - 1]);
        run.push(pts[i]);
      } else if (run.length) {
        run.push(pts[i]);
        flush();
      }
    }
    flush();
  }
  const box: Geom = [closed([[-half, -half], [half, -half], [half, half], [-half, half]])];
  try {
    const q = quay.length ? polygonClipping.intersection(union(quay), box) : [];
    let b = bank.length ? polygonClipping.intersection(union(bank), box) : [];
    if (b.length && q.length) b = polygonClipping.difference(b, q);
    return [...fromMulti(q, 4).map((poly) => ({ poly, quay: true })), ...fromMulti(b, 4).map((poly) => ({ poly, quay: false }))];
  } catch {
    // outlines the exact clipper rejects: the areas as they come, still a sharp edge, with walls on tile edges
    return all.map((poly) => ({ poly, quay: true }));
  }
}

/** Whether a point lies in any of the water. */
export function waterTest(bodies: WaterBody[]): (x: number, y: number) => boolean {
  const idx = new PolyIndex(bodies.map((b) => b.poly));
  return (x, y) => idx.has(x, y);
}

/**
 * The ground under rivers, canals and lakes raised or lowered to the level of their banks, filled
 * in from the edges. The height data often sees a river a few metres lower than its banks, and a
 * bridge laid on that sagged into a dip. The sea stays where `calmGround` put it, at sea level.
 */
export function levelUnderWater(grid: HeightGrid, bodies: WaterBody[], sea: Polygon[]): number {
  const { n, sizeM, elev } = grid;
  const step = sizeM / (n - 1);
  const h = sizeM / 2;
  // which grid points are under water: the outlines drawn with a pixel centred on every grid point
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1 / step, 0, 0, 1 / step, h / step + 0.5, h / step + 0.5);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const b of bodies) for (const r of [b.poly.outer, ...b.poly.holes]) traceRing(ctx, r);
  ctx.fill('nonzero');
  const img = ctx.getImageData(0, 0, n, n).data;
  const seaMask = sea.length ? seaMaskFromPolygons(sea, sizeM, 1024) : null;
  const known = new Uint8Array(n * n).fill(1);
  let todo = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // row j of the picture is j steps north of the south edge
      if (img[(j * n + i) * 4 + 3] < 128 || (seaMask && isSea(seaMask, -h + i * step, -h + j * step))) continue;
      known[j * n + i] = 0;
      todo++;
    }
  }
  const filled = todo;
  // ring by ring from the banks inwards, each point the mean of the known points around it
  while (todo > 0) {
    const next: Array<[number, number]> = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        if (known[k]) continue;
        let sum = 0;
        let cnt = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const a = i + di;
            const b = j + dj;
            if ((!di && !dj) || a < 0 || b < 0 || a >= n || b >= n || !known[b * n + a]) continue;
            sum += elev[b * n + a];
            cnt++;
          }
        }
        if (cnt) next.push([k, sum / cnt]);
      }
    }
    // a body with no bank in the square (all of it water): leave the rest as it is
    if (!next.length) break;
    for (const [k, v] of next) {
      elev[k] = v;
      known[k] = 1;
    }
    todo -= next.length;
  }
  return filled;
}

function traceRing(ctx: CanvasRenderingContext2D, r: Ring): void {
  if (r.length < 3) return;
  ctx.moveTo(r[0][0], r[0][1]);
  for (let k = 1; k < r.length; k++) ctx.lineTo(r[k][0], r[k][1]);
  ctx.closePath();
}

/** The left of a line's direction, at every point: averaged at bends, held to its width at sharp ones. */
function leftNormals(pts: Pt[], closedRing: boolean): Pt[] {
  const n = pts.length;
  return pts.map((c, i) => {
    const a = closedRing ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const b = closedRing ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const d0 = [c[0] - a[0], c[1] - a[1]];
    const d1 = [b[0] - c[0], b[1] - c[1]];
    const l0 = Math.hypot(d0[0], d0[1]);
    const l1 = Math.hypot(d1[0], d1[1]);
    const n0: Pt = l0 > 1e-6 ? [-d0[1] / l0, d0[0] / l0] : [0, 0];
    const n1: Pt = l1 > 1e-6 ? [-d1[1] / l1, d1[0] / l1] : [0, 0];
    if (l0 <= 1e-6) return n1;
    if (l1 <= 1e-6) return n0;
    let nx = n0[0] + n1[0];
    let ny = n0[1] + n1[1];
    const l = Math.hypot(nx, ny);
    if (l < 1e-6) return n0;
    nx /= l;
    ny /= l;
    const m = Math.min(2, 1 / Math.max(0.5, nx * n0[0] + ny * n0[1]));
    return [nx * m, ny * m];
  });
}

/** Triangles with a colour at every corner, as one shape. */
class Shape {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  /** a triangle from three points (east, up, north) */
  tri(a: number[], b: number[], c: number[], ka: Color, kb = ka, kc = ka): void {
    this.pos.push(a[0], a[1], -a[2], b[0], b[1], -b[2], c[0], c[1], -c[2]);
    for (const k of [ka, kb, kc]) this.col.push(k.r, k.g, k.b);
  }
  /**
   * An upright four-cornered face from a to b, between heights, facing `out` (east, north). Seen from
   * that side only.
   */
  wall(a: Pt, b: Pt, topA: number, topB: number, botA: number, botB: number, out: Pt, top: Color, bot: Color): void {
    const A = [a[0], topA, a[1]];
    const B = [b[0], topB, b[1]];
    const C = [b[0], botB, b[1]];
    const D = [a[0], botA, a[1]];
    // the face's normal (in east, up, north) is (b - a) × up = (dy, 0, -dx); flip the corners if it points the other way
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dy * out[0] - dx * out[1] >= 0) {
      this.tri(A, D, C, top, bot, bot);
      this.tri(A, C, B, top, bot, top);
    } else {
      this.tri(A, B, C, top, top, bot);
      this.tri(A, C, D, top, bot, bot);
    }
  }
  /** A flat top from a to b, `w` wide to the left, at the given heights, facing up. */
  top(a: Pt, b: Pt, aL: Pt, bL: Pt, ya: number, yb: number, k: Color): void {
    // corners counter-clockwise seen from above, in (east, north): a, b, bL, aL when aL is left of a→b
    const P = [a[0], ya, a[1]];
    const Q = [b[0], yb, b[1]];
    const R = [bL[0], yb, bL[1]];
    const S = [aL[0], ya, aL[1]];
    // counter-clockwise in (east, north) faces up in the scene
    this.tri(P, Q, R, k);
    this.tri(P, R, S, k);
  }
  mesh(mat: MeshStandardMaterial): Mesh | null {
    if (!this.pos.length) return null;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    geo.computeVertexNormals();
    return new Mesh(geo, mat);
  }
}

const QUAY_TOP = new Color('#c9c1b1');
const QUAY_WET = new Color('#5f5a50');
const BANK_TOP = new Color('#8e8566');
const BANK_WET = new Color('#5c5844');
const WATER = '#5d9dc8';

/**
 * The water of a square, its quay walls and banks, and the copings along them. `ground` is the
 * height of the ground as drawn; `covered` says where the coping would show through something that
 * lies over the edge (a pier, the end of a bridge). Put the group into the scene as it is.
 */
export function waterMesh(bodies: WaterBody[], grid: Pick<HeightGrid, 'n' | 'sizeM'>, ground: (x: number, y: number) => number, half: number, covered: (x: number, y: number) => boolean): Group | null {
  if (!bodies.length) return null;
  const wet = waterTest(bodies);
  const g = new Group();
  // The water surface, a little below every bank: the ground's own grid squares wherever there is
  // water in them, lowered. The ground is cut away above the water only, and covers the rest; a
  // surface following the ground keeps the water below the banks of a river that falls, and below
  // a bridge that runs level from bank to bank.
  const { n, sizeM } = grid;
  const step = sizeM / (n - 1);
  const h = sizeM / 2;
  const cells = (quay: boolean): Uint8Array => {
    const c = document.createElement('canvas');
    c.width = n - 1;
    c.height = n - 1;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    // cell (i, j) is pixel (i, j): x = -h + i·step, y = -h + j·step, j counted from the south
    ctx.setTransform(1 / step, 0, 0, 1 / step, h / step, h / step);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (const b of bodies) if (b.quay === quay) for (const r of [b.poly.outer, ...b.poly.holes]) traceRing(ctx, r);
    ctx.fill('nonzero');
    const img = ctx.getImageData(0, 0, n - 1, n - 1).data;
    const out = new Uint8Array((n - 1) * (n - 1));
    // any water in a square, and the squares beside it (under the bank, where the ground covers it)
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) {
        if (!img[(j * (n - 1) + i) * 4 + 3]) continue;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const a = i + di;
            const b = j + dj;
            if (a >= 0 && b >= 0 && a < n - 1 && b < n - 1) out[b * (n - 1) + a] = 1;
          }
      }
    return out;
  };
  const quayCells = cells(true);
  const bankCells = cells(false);
  // a corner by a quay lies as low as a quay's water
  const drop = new Float32Array(n * n);
  const vert = new Int32Array(n * n).fill(-1);
  const pos: number[] = [];
  const idx: number[] = [];
  for (const [mask, d] of [[bankCells, BANK_DROP_M], [quayCells, QUAY_DROP_M]] as Array<[Uint8Array, number]>)
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) if (mask[j * (n - 1) + i]) for (const k of [j * n + i, j * n + i + 1, (j + 1) * n + i, (j + 1) * n + i + 1]) drop[k] = Math.max(drop[k], d);
  const corner = (i: number, j: number): number => {
    const k = j * n + i;
    if (vert[k] < 0) {
      const x = -h + i * step;
      const y = -h + j * step;
      vert[k] = pos.length / 3;
      pos.push(x, ground(x, y) - drop[k], -y);
    }
    return vert[k];
  };
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      if (!quayCells[j * (n - 1) + i] && !bankCells[j * (n - 1) + i]) continue;
      const a = corner(i, j);
      const b = corner(i + 1, j);
      const c = corner(i, j + 1);
      const d = corner(i + 1, j + 1);
      // the same two triangles as the ground's square (split along b–c), counter-clockwise from above
      idx.push(a, b, c, b, d, c);
    }
  const wgeo = new BufferGeometry();
  wgeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  wgeo.setIndex(idx);
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  wgeo.setAttribute('normal', new BufferAttribute(nor, 3));
  const water = new Mesh(wgeo, new MeshStandardMaterial({ color: WATER, roughness: 0.42, metalness: 0.05 }));
  water.receiveShadow = true;
  // drawn before the ground, which is cut away over it: where the ground is not cut it covers the water
  water.renderOrder = -1;
  g.add(water);

  const walls = new Shape();
  const rim = new Strip();
  const quayCope = new Strip();
  const bankCope = new Strip();
  const edge = half - 0.6;
  for (const b of bodies) {
    const drop = b.quay ? QUAY_DROP_M : BANK_DROP_M;
    const coping = b.quay ? COPING_W : BANK_W;
    const [kTop, kWet] = b.quay ? [QUAY_TOP, QUAY_WET] : [BANK_TOP, BANK_WET];
    // outlines run counter-clockwise and holes clockwise: either way the water is on the left
    for (const ring of [b.poly.outer, ...b.poly.holes]) {
      const pts = densify(ring, PIECE_M, true);
      const n = pts.length;
      if (n < 3) continue;
      const left = leftNormals(pts, true);
      const keepWall: boolean[] = [];
      const keepCope: boolean[] = [];
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const c = pts[(i + 1) % n];
        const mx = (a[0] + c[0]) / 2;
        const my = (a[1] + c[1]) / 2;
        // the square's own edge is no shore
        const onEdge = (Math.abs(a[0]) > edge && Math.abs(c[0]) > edge && Math.sign(a[0]) === Math.sign(c[0])) || (Math.abs(a[1]) > edge && Math.abs(c[1]) > edge && Math.sign(a[1]) === Math.sign(c[1]));
        const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        // water on the land side too: a gap between two outlines, not a shore
        const landX = mx + ((c[1] - a[1]) / l) * 1.2;
        const landY = my - ((c[0] - a[0]) / l) * 1.2;
        const ok = !onEdge && !wet(landX, landY);
        keepWall.push(ok);
        keepCope.push(ok && !covered(mx, my));
      }
      // the wall, at the coping's water side
      const off = coping / 2 - 0.05;
      for (let i = 0; i < n; i++) {
        if (!keepWall[i]) continue;
        const j = (i + 1) % n;
        const a = pts[i];
        const c = pts[j];
        const A: Pt = [a[0] + left[i][0] * off, a[1] + left[i][1] * off];
        const C: Pt = [c[0] + left[j][0] * off, c[1] + left[j][1] * off];
        const ga = ground(a[0], a[1]);
        const gc = ground(c[0], c[1]);
        const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        walls.wall(A, C, ga + 0.08, gc + 0.08, ga - drop - 0.6, gc - drop - 0.6, [-(c[1] - a[1]) / l, (c[0] - a[0]) / l], kTop, kWet);
      }
      // runs of pieces kept, starting after a gap so a run does not break at the ring's first point
      const runs = (keep: boolean[], into: (run: number[]) => void) => {
        const start = keep.indexOf(false);
        let run: number[] = [];
        for (let k = 0; k < n; k++) {
          const i = (Math.max(0, start) + k) % n;
          if (keep[i]) {
            if (!run.length) run.push(i);
            run.push((i + 1) % n);
          } else {
            if (run.length >= 2) into(run);
            run = [];
          }
        }
        if (run.length >= 2) into(run);
      };
      const cope = b.quay ? quayCope : bankCope;
      runs(keepCope, (run) => cope.add(run.map((i) => pts[i]), coping, 0.08, ground));
      // the shade of the wall on the water: a band along it
      const water = (x: number, y: number) => ground(x, y) - drop;
      const inWater = (run: number[], d: number) => run.map((i): Pt => [pts[i][0] + left[i][0] * d, pts[i][1] + left[i][1] * d]);
      if (b.quay)
        runs(keepWall, (run) => {
          rim.add(inWater(run, off + 0.7), 1.4, 0.04, water);
        });
    }
  }
  const wallMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const wallMesh = walls.mesh(wallMat);
  if (wallMesh) {
    wallMesh.renderOrder = -1;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    g.add(wallMesh);
  }
  // the water darker along the walls, where they shade it
  g.add(rim.mesh('#4f87aa', -1));
  // over the ground, under every street and path: a street along the river stays whole
  g.add(quayCope.mesh('#b4afa5', 0), bankCope.mesh('#8f8a69', 0));
  return g;
}

const DECK_TOP = new Color('#d8d2c5');
const DECK_SIDE = new Color('#a59d8e');
const DECK_UNDER = new Color('#6f695f');
const PIER = new Color('#8f887b');

/** How wide a bridge's deck is, for what it carries: the street with its pavements, a path, a track (m). */
export function deckWidth(l: { w: number; kind: string; train: boolean; tram: boolean; drive: boolean }): number {
  if (l.train) return 13;
  if (l.tram) return 6;
  if (l.kind === 'path') return Math.max(l.w, 2.4) + 1.2;
  return l.w + 5;
}

/**
 * Bridges over the water: side faces from the deck down, a parapet along each side, and piers
 * standing in the water. The deck itself is a ribbon with the streets (`roadMesh.ts`). Only the
 * part over the water and a few metres onto each bank is built: a bridge over a street or a
 * railway is left as it was.
 */
export function bridgeMesh(net: RoadNet, ground: (x: number, y: number) => number, wet: (x: number, y: number) => boolean): Mesh | null {
  const s = new Shape();
  for (const l of net.lines) {
    if (!l.bridge) continue;
    const pts = densify(l.pts, PIECE_M);
    const n = pts.length;
    if (n < 2) continue;
    const over = overWaterPieces(pts, wet);
    if (!over.some(Boolean)) continue;
    const hw = deckWidth(l) / 2;
    const left = leftNormals(pts, false);
    const rail = l.train ? 0.7 : 0.95;
    const thick = l.kind === 'path' ? 0.3 : 0.55;
    for (let i = 0; i + 1 < n; i++) {
      if (!over[i]) continue;
      const a = pts[i];
      const c = pts[i + 1];
      const ga = ground(a[0], a[1]);
      const gc = ground(c[0], c[1]);
      for (const side of [1, -1]) {
        const o: Pt[] = [left[i], left[i + 1]].map((v) => [v[0] * side, v[1] * side]) as Pt[];
        const outA: Pt = [a[0] + o[0][0] * hw, a[1] + o[0][1] * hw];
        const outC: Pt = [c[0] + o[1][0] * hw, c[1] + o[1][1] * hw];
        const inA: Pt = [a[0] + o[0][0] * (hw - thick), a[1] + o[0][1] * (hw - thick)];
        const inC: Pt = [c[0] + o[1][0] * (hw - thick), c[1] + o[1][1] * (hw - thick)];
        const l2 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        const out: Pt = [(-(c[1] - a[1]) / l2) * side, ((c[0] - a[0]) / l2) * side];
        const inward: Pt = [-out[0], -out[1]];
        // the side of the deck and the outside of the parapet, in one face, down below the deck
        s.wall(outA, outC, ga + rail, gc + rail, ga - 1.1, gc - 1.1, out, DECK_SIDE, DECK_UNDER);
        // the inside of the parapet and its top
        s.wall(inA, inC, ga + rail, gc + rail, ga + 0.05, gc + 0.05, inward, DECK_SIDE, DECK_SIDE);
        if (side === 1) s.top(inA, inC, outA, outC, ga + rail, gc + rail, DECK_TOP);
        else s.top(outA, outC, inA, inC, ga + rail, gc + rail, DECK_TOP);
      }
      // the parapet's ends, where it stops on the bank
      for (const [k, end, dir] of [[i, a, -1], [i + 1, c, 1]] as Array<[number, Pt, number]>) {
        const atEnd = dir < 0 ? i === 0 || !over[i - 1] : i + 1 === n - 1 || !over[i + 1];
        if (!atEnd) continue;
        const gy = ground(end[0], end[1]);
        const l2 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
        const along: Pt = [((c[0] - a[0]) / l2) * dir, ((c[1] - a[1]) / l2) * dir];
        for (const side of [1, -1]) {
          const o: Pt = [left[k][0] * side, left[k][1] * side];
          const p: Pt = [end[0] + o[0] * hw, end[1] + o[1] * hw];
          const q: Pt = [end[0] + o[0] * (hw - thick), end[1] + o[1] * (hw - thick)];
          s.wall(p, q, gy + rail, gy + rail, gy + 0.05, gy + 0.05, along, DECK_SIDE, DECK_SIDE);
        }
      }
    }
    // piers in the water, about every 30 m along the part over it, not right at the banks
    let wetRun: number[] = [];
    const piers = (run: number[]) => {
      if (run.length < 6) return;
      const lenM = run.length * PIECE_M;
      const count = Math.max(1, Math.round(lenM / 30) - 1);
      for (let k = 1; k <= count; k++) {
        const i = run[Math.floor((k * run.length) / (count + 1))];
        const p = pts[i];
        const q = pts[Math.min(n - 1, i + 1)];
        const l2 = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
        const along: Pt = [(q[0] - p[0]) / l2, (q[1] - p[1]) / l2];
        const across: Pt = [-along[1], along[0]];
        const gy = ground(p[0], p[1]);
        const hl = Math.max(1, hw - 1.2);
        const ht = l.kind === 'path' ? 0.4 : 0.9;
        const corner = (u: number, v: number): Pt => [p[0] + across[0] * u + along[0] * v, p[1] + across[1] * u + along[1] * v];
        const c4 = [corner(hl, -ht), corner(hl, ht), corner(-hl, ht), corner(-hl, -ht)];
        for (let e = 0; e < 4; e++) {
          const A = c4[e];
          const B = c4[(e + 1) % 4];
          const mx = (A[0] + B[0]) / 2 - p[0];
          const my = (A[1] + B[1]) / 2 - p[1];
          s.wall(A, B, gy - 1.0, gy - 1.0, gy - 7, gy - 7, [mx, my], PIER, DECK_UNDER);
        }
      }
    };
    for (let i = 0; i + 1 < n; i++) {
      const m: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      if (wet(m[0], m[1])) wetRun.push(i);
      else {
        piers(wetRun);
        wetRun = [];
      }
    }
    piers(wetRun);
  }
  const mesh = s.mesh(new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
  if (!mesh) return null;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** For each piece of a line, whether it is over the water or within a piece of it (the bridge's ends on the banks). */
export function overWaterPieces(pts: Pt[], wet: (x: number, y: number) => boolean): boolean[] {
  const n = pts.length;
  const w: boolean[] = [];
  for (let i = 0; i + 1 < n; i++) w.push(wet((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2));
  return w.map((v, i) => v || !!w[i - 1] || !!w[i + 1]);
}

/** The pieces of a line over the water (with a piece onto each bank), as runs of points, for the deck. */
export function overWaterRuns(linePts: Pt[], wet: (x: number, y: number) => boolean): Pt[][] {
  const pts = densify(linePts, PIECE_M);
  const over = overWaterPieces(pts, wet);
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  for (let i = 0; i < over.length; i++) {
    if (over[i]) {
      if (!run.length) run.push(pts[i]);
      run.push(pts[i + 1]);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/** Whether a point lies on a bridge's deck, where it crosses the water: the coping stops there. */
export function onBridgeDeck(net: RoadNet): (x: number, y: number) => boolean {
  const lines = net.lines.filter((l) => l.bridge);
  const boxes = lines.map((l) => {
    const hw = deckWidth(l) / 2;
    const [x0, y0, x1, y1] = ringBounds(l.pts);
    return [x0 - hw, y0 - hw, x1 + hw, y1 + hw];
  });
  return (x, y) => {
    for (let k = 0; k < lines.length; k++) {
      const b = boxes[k];
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      const l = lines[k];
      // a little inside the deck's edge: the coping runs on under it, so no water shows between them
      const hw = deckWidth(l) / 2 - 0.4;
      for (let i = 0; i + 1 < l.pts.length; i++) {
        const [ax, ay] = l.pts[i];
        const [bx, by] = l.pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(ax + dx * t - x, ay + dy * t - y) <= hw) return true;
      }
    }
    return false;
  };
}
