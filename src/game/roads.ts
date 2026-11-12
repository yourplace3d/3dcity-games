/**
 * The road network of one square, for driving and walking: the map's road lines with their
 * lengths, a spatial index of their segments, and where lines meet. Cars and people follow a
 * line by arc length and move to a connected line at its end, or at a junction along it.
 */

import type { LineFeature, LineKind } from '../geo/osm';
import type { Pt } from '../geo/polygon';

const DRIVE = new Set<LineKind>(['motorway', 'primary', 'secondary', 'tertiary', 'minor', 'service']);
const WALK = new Set<LineKind>(['primary', 'secondary', 'tertiary', 'minor', 'service', 'path']);
/** Traffic keeps to real streets; driveways and car parks stay quiet. */
const TRAFFIC = new Set<LineKind>(['motorway', 'primary', 'secondary', 'tertiary', 'minor']);

/** How fast traffic drives on each kind of road (m/s). */
export const SPEED_LIMIT: Record<string, number> = { motorway: 21, primary: 14, secondary: 12.5, tertiary: 11, minor: 8.5, service: 5 };

const CELL = 32;
/** Line ends this close to another line are joined to it (m). */
const JOIN_M = 2.5;

export interface Conn {
  line: number;
  /** arc length on that line where the two meet */
  s: number;
}

export interface RoadLine {
  kind: LineKind;
  pts: Pt[];
  /** arc length at each point */
  cum: Float32Array;
  len: number;
  w: number;
  drive: boolean;
  bridge: boolean;
  walk: boolean;
  traffic: boolean;
  tram: boolean;
  /** lines met at the start and at the end */
  ends: [Conn[], Conn[]];
  /** other lines that begin or end somewhere along this one */
  joins: Array<{ s: number; line: number; s2: number }>;
}

/** A place on the network, and the way along the line (+1 with the points, -1 against). */
export interface PathState {
  line: number;
  s: number;
  dir: 1 | -1;
}

export interface Near {
  line: number;
  s: number;
  d: number;
  x: number;
  y: number;
}

export interface RouteField {
  dist: Float64Array;
  line: number;
  s: number;
  x: number;
  y: number;
}

export type Pick = (options: PathState[], from: PathState | null) => PathState | null;

export class RoadNet {
  readonly lines: RoadLine[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly segLine: number[] = [];
  private readonly segIdx: number[] = [];
  private readonly trafficLines: number[] = [];
  private readonly walkLines: number[] = [];
  private readonly driveLines: number[] = [];
  private readonly tramLines: number[] = [];
  // the drivable network as a graph, for routes: a node at each line end and junction
  private readonly bps: Float32Array[] = [];
  private readonly nodeAt: Int32Array[] = [];
  private readonly nodeLine: number[] = [];
  private readonly nodeS: number[] = [];
  private readonly adj: Array<Array<[number, number]>> = [];

  constructor(features: LineFeature[], readonly half: number) {
    for (const f of features) {
      // tram tracks come as narrow rail lines; trams follow them like cars follow roads
      const tram = f.kind === 'rail' && f.widthM < 2;
      if (!DRIVE.has(f.kind) && !WALK.has(f.kind) && !tram) continue;
      const pts: Pt[] = [];
      for (const p of f.pts) {
        const q = pts[pts.length - 1];
        if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) pts.push(p);
      }
      if (pts.length < 2) continue;
      const cum = new Float32Array(pts.length);
      for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const len = cum[pts.length - 1];
      if (len < 2) continue;
      const id = this.lines.length;
      this.lines.push({ kind: f.kind, pts, cum, len, w: f.widthM, bridge: f.bridge, drive: DRIVE.has(f.kind), walk: WALK.has(f.kind), traffic: TRAFFIC.has(f.kind), tram, ends: [[], []], joins: [] });
      for (let i = 0; i < pts.length - 1; i++) {
        const seg = this.segLine.length;
        this.segLine.push(id);
        this.segIdx.push(i);
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const x0 = Math.floor(Math.min(ax, bx) / CELL);
        const x1 = Math.floor(Math.max(ax, bx) / CELL);
        const y0 = Math.floor(Math.min(ay, by) / CELL);
        const y1 = Math.floor(Math.max(ay, by) / CELL);
        for (let cy = y0; cy <= y1; cy++)
          for (let cx = x0; cx <= x1; cx++) {
            const k = key(cx, cy);
            const list = this.cells.get(k);
            if (list) list.push(seg);
            else this.cells.set(k, [seg]);
          }
      }
    }
    this.connect();
    this.lines.forEach((l, i) => {
      if (l.traffic) this.trafficLines.push(i);
      if (l.walk) this.walkLines.push(i);
      if (l.drive) this.driveLines.push(i);
      if (l.tram) this.tramLines.push(i);
    });
    this.graph();
  }

  private graph(): void {
    this.lines.forEach((l, i) => {
      if (!l.drive) {
        this.bps.push(new Float32Array(0));
        this.nodeAt.push(new Int32Array(0));
        return;
      }
      const at = [0, ...l.joins.filter((j) => this.lines[j.line].drive).map((j) => j.s), l.len].sort((a, b) => a - b).filter((v, k, arr) => k === 0 || v - arr[k - 1] > 0.01);
      const ids = new Int32Array(at.length);
      at.forEach((sv, k) => {
        ids[k] = this.adj.length;
        this.adj.push([]);
        this.nodeLine.push(i);
        this.nodeS.push(sv);
        if (k > 0) {
          this.adj[ids[k]].push([ids[k - 1], sv - at[k - 1]]);
          this.adj[ids[k - 1]].push([ids[k], sv - at[k - 1]]);
        }
      });
      this.bps.push(Float32Array.from(at));
      this.nodeAt.push(ids);
    });
    this.lines.forEach((l, i) => {
      if (!l.drive) return;
      for (const j of l.joins) {
        if (!this.lines[j.line].drive) continue;
        const a = this.nodeNear(i, j.s);
        const b = this.nodeNear(j.line, j.s2);
        this.adj[a].push([b, 1]);
        this.adj[b].push([a, 1]);
      }
      for (const end of [0, 1] as const) {
        const a = this.nodeAt[i][end === 0 ? 0 : this.nodeAt[i].length - 1];
        for (const c of l.ends[end]) {
          if (!this.lines[c.line].drive) continue;
          const b = this.nodeNear(c.line, c.s);
          this.adj[a].push([b, 1]);
          this.adj[b].push([a, 1]);
        }
      }
    });
  }

  private nodeNear(line: number, sv: number): number {
    const at = this.bps[line];
    let best = 0;
    for (let k = 1; k < at.length; k++) if (Math.abs(at[k] - sv) < Math.abs(at[best] - sv)) best = k;
    return this.nodeAt[line][best];
  }

  /** The two nodes either side of a place on a line, with the metres to each. */
  private around(line: number, sv: number): Array<[number, number]> {
    const at = this.bps[line];
    let k = 0;
    while (k < at.length - 2 && at[k + 1] < sv) k++;
    return [[this.nodeAt[line][k], Math.abs(sv - at[k])], [this.nodeAt[line][k + 1], Math.abs(at[k + 1] - sv)]];
  }

  /** The points of a line from one arc length to another, either way round. */
  private slice(line: number, from: number, to: number): Pt[] {
    const l = this.lines[line];
    const out: Pt[] = [this.point(line, from)];
    if (to >= from) {
      for (let i = 0; i < l.pts.length; i++) if (l.cum[i] > from && l.cum[i] < to) out.push(l.pts[i]);
    } else {
      for (let i = l.pts.length - 1; i >= 0; i--) if (l.cum[i] < from && l.cum[i] > to) out.push(l.pts[i]);
    }
    out.push(this.point(line, to));
    return out;
  }

  /** Driving distances from everywhere to the road nearest a point: what a route there follows. */
  field(x: number, y: number): RouteField | null {
    const n = this.nearest(x, y, 200, 'drive');
    if (!n) return null;
    const dist = new Float64Array(this.adj.length).fill(Infinity);
    // a binary heap of [distance, node]
    const heap: Array<[number, number]> = [];
    const push = (d: number, v: number) => {
      heap.push([d, v]);
      let k = heap.length - 1;
      while (k > 0) {
        const up = (k - 1) >> 1;
        if (heap[up][0] <= heap[k][0]) break;
        [heap[up], heap[k]] = [heap[k], heap[up]];
        k = up;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const a = k * 2 + 1;
          const b = a + 1;
          let m = k;
          if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
          if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    for (const [v, d] of this.around(n.line, n.s)) {
      if (d < dist[v]) {
        dist[v] = d;
        push(d, v);
      }
    }
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      for (const [v, c] of this.adj[u]) {
        if (d + c < dist[v]) {
          dist[v] = d + c;
          push(d + c, v);
        }
      }
    }
    return { dist, line: n.line, s: n.s, x: n.x, y: n.y };
  }

  /** The way by road from a point to a field's goal, and its length; null when there is none. */
  route(f: RouteField, x: number, y: number, maxM = Infinity): { pts: Pt[]; metres: number } | null {
    const n = this.nearest(x, y, 120, 'drive');
    if (!n) return null;
    if (n.line === f.line) {
      const [[a], [b]] = this.around(n.line, n.s);
      const [[c], [d]] = this.around(f.line, f.s);
      if (a === c && b === d) return { pts: this.slice(n.line, n.s, f.s), metres: Math.abs(n.s - f.s) };
    }
    const [p, q] = this.around(n.line, n.s);
    const first = f.dist[p[0]] + p[1] <= f.dist[q[0]] + q[1] ? p : q;
    const metres = f.dist[first[0]] + first[1];
    if (!Number.isFinite(metres)) return null;
    const pts = this.slice(n.line, n.s, this.nodeS[first[0]]);
    let u = first[0];
    let run = first[1];
    for (let guard = 0; guard < 5000 && run < maxM; guard++) {
      let next = -1;
      let cost = 0;
      for (const [v, c] of this.adj[u]) {
        if (f.dist[v] + c < f.dist[u] - 1e-3 && (next < 0 || f.dist[v] + c < f.dist[next] + cost)) {
          next = v;
          cost = c;
        }
      }
      if (next < 0) break;
      if (this.nodeLine[next] === this.nodeLine[u]) pts.push(...this.slice(this.nodeLine[u], this.nodeS[u], this.nodeS[next]).slice(1));
      else pts.push(this.point(this.nodeLine[next], this.nodeS[next]));
      run += cost;
      u = next;
    }
    if (run < maxM && this.nodeLine[u] === f.line) pts.push(...this.slice(f.line, this.nodeS[u], f.s).slice(1));
    return { pts, metres };
  }

  private connect(): void {
    this.lines.forEach((l, id) => {
      for (const end of [0, 1] as const) {
        const p = end === 0 ? l.pts[0] : l.pts[l.pts.length - 1];
        const best = new Map<number, Near>();
        this.each(p[0], p[1], JOIN_M, (line, i) => {
          if (line === id) return;
          const n = this.project(line, i, p[0], p[1]);
          if (n.d > JOIN_M) return;
          const prev = best.get(line);
          if (!prev || n.d < prev.d) best.set(line, n);
        });
        for (const n of best.values()) {
          const other = this.lines[n.line];
          l.ends[end].push({ line: n.line, s: n.s });
          if (n.s > 3 && n.s < other.len - 3) other.joins.push({ s: n.s, line: id, s2: end === 0 ? 0 : l.len });
        }
      }
    });
    this.cross();
    for (const l of this.lines) l.joins.sort((a, b) => a.s - b.s);
  }

  /**
   * Streets that cross: the map's lines often run straight through a crossing with no end
   * there, so every place where two lines intersect is a junction on both. A bridge and the
   * road under it don't meet.
   */
  private cross(): void {
    const seen = new Set<string>();
    for (const list of this.cells.values()) {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const la = this.segLine[list[a]];
          const lb = this.segLine[list[b]];
          if (la === lb) continue;
          const A = this.lines[la];
          const B = this.lines[lb];
          if (A.bridge !== B.bridge) continue;
          const ia = this.segIdx[list[a]];
          const ib = this.segIdx[list[b]];
          const [x1, y1] = A.pts[ia];
          const [x2, y2] = A.pts[ia + 1];
          const [x3, y3] = B.pts[ib];
          const [x4, y4] = B.pts[ib + 1];
          const den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
          if (Math.abs(den) < 1e-9) continue;
          const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den;
          const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const sa = A.cum[ia] + (A.cum[ia + 1] - A.cum[ia]) * t;
          const sb = B.cum[ib] + (B.cum[ib + 1] - B.cum[ib]) * u;
          const k = `${la}|${lb}|${Math.round(sa / 2)}`;
          if (seen.has(k)) continue;
          seen.add(k);
          A.joins.push({ s: sa, line: lb, s2: sb });
          B.joins.push({ s: sb, line: la, s2: sa });
        }
      }
    }
  }

  private each(x: number, y: number, r: number, fn: (line: number, seg: number) => void): void {
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL);
    const y1 = Math.floor((y + r) / CELL);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(key(cx, cy));
        if (list) for (const s of list) fn(this.segLine[s], this.segIdx[s]);
      }
  }

  private project(line: number, i: number, x: number, y: number): Near {
    const l = this.lines[line];
    const [ax, ay] = l.pts[i];
    const [bx, by] = l.pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    const px = ax + dx * t;
    const py = ay + dy * t;
    return { line, s: l.cum[i] + Math.sqrt(L2) * t, d: Math.hypot(x - px, y - py), x: px, y: py };
  }

  /** The nearest point on a line of the wanted sort within `maxD`, or null. */
  nearest(x: number, y: number, maxD: number, want: 'drive' | 'walk' | 'traffic' | 'tram' | 'any' = 'any'): Near | null {
    let best: Near | null = null;
    this.each(x, y, maxD, (line, i) => {
      const l = this.lines[line];
      if (want !== 'any' && !l[want]) return;
      const n = this.project(line, i, x, y);
      if (n.d <= maxD && (!best || n.d < best.d)) best = n;
    });
    return best;
  }

  /** Kilometres of real streets, for telling how well a place is mapped. */
  get streetKm(): number {
    return this.trafficLines.reduce((a, i) => a + this.lines[i].len, 0) / 1000;
  }

  get hasTrams(): boolean {
    return this.tramLines.length > 0;
  }

  /** Whether a point is on a road or path (bridges count, so they carry you over water). */
  onRoad(x: number, y: number): boolean {
    let hit = false;
    this.each(x, y, 12, (line, i) => {
      if (hit) return;
      const l = this.lines[line];
      if (this.project(line, i, x, y).d <= l.w / 2 + 2.5) hit = true;
    });
    return hit;
  }

  point(line: number, s: number): Pt {
    const l = this.lines[line];
    const i = segAt(l, s);
    const a = l.pts[i];
    const b = l.pts[i + 1];
    const t = (s - l.cum[i]) / Math.max(1e-6, l.cum[i + 1] - l.cum[i]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  /** Unit direction of travel at a place. */
  heading(p: PathState): Pt {
    const l = this.lines[p.line];
    const i = segAt(l, p.s);
    const a = l.pts[i];
    const b = l.pts[i + 1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [((b[0] - a[0]) / d) * p.dir, ((b[1] - a[1]) / d) * p.dir];
  }

  /** A place, moved `side` metres to the right of travel (the lane, or the pavement). */
  lanePoint(p: PathState, side: number): Pt {
    const [x, y] = this.point(p.line, p.s);
    const [hx, hy] = this.heading(p);
    return [x + hy * side, y - hx * side];
  }

  /** Ways on from a meeting point on a line: along it in each direction that has road left. */
  private optionsAt(c: Conn, want: 'drive' | 'walk' | 'tram'): PathState[] {
    const l = this.lines[c.line];
    if (!l[want]) return [];
    const out: PathState[] = [];
    if (l.len - c.s > 4) out.push({ line: c.line, s: c.s, dir: 1 });
    if (c.s > 4) out.push({ line: c.line, s: c.s, dir: -1 });
    return out;
  }

  /**
   * Move along the network by `ds` metres. At the end of a line `pick` chooses among the ways
   * on (null: turn round). Passing a junction, `pick` gets the side road and "carry on" (null).
   */
  advance(p: PathState, ds: number, want: 'drive' | 'walk' | 'tram', pick: Pick): void {
    const l = this.lines[p.line];
    const from = p.s;
    const to = p.s + p.dir * ds;
    for (const j of l.joins) {
      if (p.dir > 0 ? j.s > from && j.s <= to : j.s < from && j.s >= to) {
        const options = this.optionsAt({ line: j.line, s: j.s2 }, want);
        if (!options.length) continue;
        const chosen = pick(options, p);
        if (chosen) {
          Object.assign(p, chosen);
          return;
        }
      }
    }
    if (to >= 0 && to <= l.len) {
      p.s = to;
      return;
    }
    const options = l.ends[p.dir > 0 ? 1 : 0].flatMap((c) => this.optionsAt(c, want));
    const chosen = options.length ? pick(options, null) : null;
    if (chosen) Object.assign(p, chosen);
    else {
      p.s = Math.max(0, Math.min(l.len, to));
      p.dir = p.dir > 0 ? -1 : 1;
    }
  }

  /** A random place on the network between two distances from a point, inside the square. */
  randomPlace(want: 'drive' | 'walk' | 'traffic' | 'tram', x: number, y: number, minD: number, maxD: number, rnd: () => number = Math.random): PathState | null {
    const pool = want === 'traffic' ? this.trafficLines : want === 'walk' ? this.walkLines : want === 'tram' ? this.tramLines : this.driveLines;
    if (!pool.length) return null;
    const edge = this.half - 25;
    for (let k = 0; k < 60; k++) {
      // near the point: a random spot in the ring, snapped to the network; far: any line
      let place: PathState | null = null;
      if (maxD < 700) {
        const a = rnd() * Math.PI * 2;
        const r = minD + rnd() * (maxD - minD);
        const n = this.nearest(x + Math.cos(a) * r, y + Math.sin(a) * r, 40, want);
        if (n) place = { line: n.line, s: n.s, dir: rnd() < 0.5 ? 1 : -1 };
      } else {
        const line = pool[Math.floor(rnd() * pool.length)];
        place = { line, s: rnd() * this.lines[line].len, dir: rnd() < 0.5 ? 1 : -1 };
      }
      if (!place) continue;
      const [px, py] = this.point(place.line, place.s);
      const d = Math.hypot(px - x, py - y);
      if (d < minD || d > maxD || Math.abs(px) > edge || Math.abs(py) > edge) continue;
      return place;
    }
    return null;
  }
}

function key(cx: number, cy: number): number {
  return (cx + 4096) * 8192 + (cy + 4096);
}

function segAt(l: RoadLine, s: number): number {
  let i = 0;
  const last = l.pts.length - 2;
  while (i < last && l.cum[i + 1] < s) i++;
  return i;
}

/** How far to the right of the centre line a car drives on a road of this width. */
export function laneOffset(l: RoadLine): number {
  return l.w < 5 ? 0.7 : Math.min(3.2, l.w * 0.25);
}
