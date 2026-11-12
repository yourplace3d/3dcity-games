/**
 * The game: you, the cars, the people on the pavements, the police and the delivery jobs, on
 * one square of the city at a time. Everything lives in the square's local metres (E, N).
 */

import {
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Pt } from '../geo/polygon';
import type { LngLat } from '../geo/projection';
import { Car, collideCars, type CarKind } from './cars';
import type { Input } from './input';
import { Strip } from './roadMesh';
import { laneOffset, SPEED_LIMIT, type PathState, type Pick, type RouteField } from './roads';
import { areaCentre, World } from './world';

const FOV = 42;
const TRAFFIC = 13;
const PEOPLE = 26;
const PARKED = 70;
const WALK_SPEED = 6.2;
const MAX_HEAT = 4;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pickOne = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

interface Person {
  x: number;
  y: number;
  th: number;
  vx: number;
  vy: number;
  state: 'walk' | 'flee' | 'down';
  t: number;
  path: PathState | null;
  side: number;
  pace: number;
  mesh: Group;
}

interface Marker {
  at: LngLat;
  mesh: Group;
  /** driving distances to it, in the square they were worked out for */
  field?: RouteField | null;
  fieldIn?: World;
}

export interface Job {
  to: Marker;
  left: number;
  pay: number;
  metres: number;
}

export interface Hud {
  cash: number;
  heat: number;
  health: number;
  carHp: number | null;
  kmh: number;
  job: { left: number; metres: number; pay: number } | null;
  hint: string;
  /** where the arrow points: the drop-off, or the nearest job */
  target: { ndcX: number; ndcY: number; metres: number; kind: 'drop' | 'job' } | null;
  delivered: number;
  /** the run of deliveries being scored: which one is next, and the score so far */
  run: { n: number; of: number; score: number } | null;
}

/** A run is this many deliveries; each asks a little more than the one before. */
export const RUN_JOBS = 5;
/** Per delivery of a run: how far the drop-off is (m, from, to) and the speed the clock assumes (m/s). */
const RUN_STEPS: Array<[number, number, number]> = [
  [250, 550, 7],
  [350, 700, 7.5],
  [450, 850, 8],
  [550, 1000, 8.5],
  [650, 1200, 9],
];

const SHIRTS = ['#d9534f', '#3f7fbf', '#e8c547', '#5aa469', '#8e6bbf', '#e07b39', '#f2f2f2', '#3a3f47', '#4fb3bf', '#d87ca8'];
const personBody = new CylinderGeometry(0.3, 0.26, 1.15, 10);
const personHead = new SphereGeometry(0.24, 12, 8);
const skin = new MeshStandardMaterial({ color: '#e8c9a8', roughness: 0.8 });

function personMesh(colour: string, you = false): Group {
  const g = new Group();
  // people are drawn larger than life, so you can see them from the air
  g.scale.setScalar(1.5);
  const body = new Mesh(personBody, new MeshStandardMaterial({ color: colour, roughness: 0.8 }));
  body.position.y = 0.6;
  body.castShadow = true;
  const head = new Mesh(personHead, skin);
  head.position.y = 1.42;
  head.castShadow = true;
  g.add(body, head);
  if (you) {
    const ring = new Mesh(new RingGeometry(0.75, 1.05, 28), new MeshBasicMaterial({ color: '#ffd400', side: DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.4;
    g.add(ring);
  }
  return g;
}

function markerMesh(colour: string): Group {
  const g = new Group();
  const flat = (geo: RingGeometry | CircleGeometry, opacity: number) => {
    const m = new Mesh(geo, new MeshBasicMaterial({ color: colour, side: DoubleSide, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.7;
    return m;
  };
  g.add(flat(new RingGeometry(3.7, 5, 44), 0.95), flat(new CircleGeometry(3.7, 44), 0.25));
  return g;
}

export class Game {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(FOV, 1, 2, 4000);
  private readonly sun = new DirectionalLight('#fff4e0', 2.5);
  world!: World;
  readonly cars: Car[] = [];
  readonly people: Person[] = [];
  /** you, on foot */
  readonly me = { x: 0, y: 0, th: 0, vx: 0, vy: 0, hp: 100, mesh: personMesh('#ffd400', true) };
  /** the car you are driving, or null on foot */
  car: Car | null = null;
  cash = 0;
  delivered = 0;
  heat = 0;
  job: Job | null = null;
  private pickups: Marker[] = [];
  private cam = { x: 0, y: 0, h: 90 };
  private viewR = 100;
  private clock = 0;
  private spawnT = 0;
  private copT = 0;
  private caughtT = 0;
  private routeT = 0;
  private routePts: Pt[] | null = null;
  private readonly routeLine = new Mesh<BufferGeometry, MeshBasicMaterial>(new BufferGeometry(), new MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  /** drive yourself (for filming and tests), how fast, and whether to brake for what's ahead */
  auto = false;
  /** draw the way to the next ring as a line on the road; off: the arrow alone shows the direction */
  showRoute = false;
  /** the car you last drove, ringed while you're on foot so you can find it again */
  private mine: Car | null = null;
  private readonly mineRing = new Mesh(new RingGeometry(3.3, 3.8, 40), new MeshBasicMaterial({ color: '#ffffff', side: DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
  autoSpeed = 16;
  autoAvoid = true;
  private offenceAt = 0;
  private loading = false;
  private retryAt = 0;
  private frozen = 0;
  private readonly smoke: Array<{ mesh: Mesh<SphereGeometry, MeshBasicMaterial>; life: number }> = [];
  private smokeT = 0;
  /** off in tests that only step the game */
  render = true;
  onToast: (text: string, kind?: 'good' | 'bad' | 'info') => void = () => undefined;
  onFlash: (text: string) => void = () => undefined;
  onRide: (text: string) => void = () => undefined;
  onSquare: (state: 'loading' | 'ready') => void = () => undefined;
  onSave: () => void = () => undefined;
  /** The last delivery of a run is in: what it scored and how long it took (s). */
  onRunEnd: (score: number, seconds: number) => void = () => undefined;
  /** The run being scored: deliveries done, what they earned less fines, and the time played. */
  run = { done: 0, score: 0, seconds: 0, over: false };

  /** Start counting a new run of deliveries. */
  newRun(): void {
    this.run = { done: 0, score: 0, seconds: 0, over: false };
  }

  constructor(readonly canvas: HTMLCanvasElement, private readonly small: boolean) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.scene.background = new Color('#d8d2c2');
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 2;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.25;
    this.scene.add(new HemisphereLight('#ffffff', '#c9c0b0', 1.3), this.sun, this.sun.target, this.me.mesh, this.routeLine, this.mineRing);
    this.mineRing.rotation.x = -Math.PI / 2;
    this.mineRing.visible = false;
    this.routeLine.visible = false;
    this.camera.up.set(0, 0, -1);
    const geo = new SphereGeometry(0.6, 8, 6);
    for (let i = 0; i < 28; i++) {
      const mesh = new Mesh(geo, new MeshBasicMaterial({ color: '#3a3a3a', transparent: true, opacity: 0, depthWrite: false }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.smoke.push({ mesh, life: 0 });
    }
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  get texturePx(): number {
    const gl = this.renderer.getContext();
    return Math.min(this.small ? 2048 : 4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  }

  private resize(): void {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ squares

  /** Start in the square around a place, on foot beside a car. */
  async start(at: LngLat): Promise<void> {
    const world = await World.load(areaCentre(at), this.texturePx);
    const [x, y] = world.proj.toLocal(at.lon, at.lat);
    const spot = world.roads.nearest(x, y, 500, 'traffic') ?? world.roads.nearest(x, y, 900, 'drive');
    const place: PathState | null = spot ? { line: spot.line, s: spot.s, dir: 1 } : world.roads.randomPlace('drive', 0, 0, 0, 2000);
    if (!place) {
      // nowhere to stand: keep whatever was loaded before
      world.dispose();
      throw new Error('no roads here');
    }
    this.clear();
    this.world = world;
    this.scene.add(world.model.group);
    const line = world.roads.lines[place.line];
    const [cx, cy] = world.roads.lanePoint(place, line.w / 2 + 1);
    const [hx, hy] = world.roads.heading(place);
    const car = this.addCar('sedan', cx, cy, Math.atan2(hy, hx));
    car.driver = 'none';
    const [px, py] = this.standBeside(place);
    this.me.x = px;
    this.me.y = py;
    this.me.hp = 100;
    this.car = null;
    this.heat = 0;
    this.cam = { x: px, y: py, h: 90 };
    this.parkCars(null);
    this.onSquare('ready');
  }

  private clear(): void {
    if (this.world) {
      this.scene.remove(this.world.model.group);
      this.world.dispose();
    }
    for (const c of this.cars.splice(0)) this.scene.remove(c.mesh);
    for (const p of this.people.splice(0)) this.scene.remove(p.mesh);
    for (const m of this.pickups.splice(0)) this.scene.remove(m.mesh);
    if (this.job) this.scene.remove(this.job.to.mesh);
    this.job = null;
    this.routeLine.visible = false;
  }

  /** The next square is ready: move everything near you over to it. */
  private swap(next: World): void {
    const old = this.world;
    const move = (o: { x: number; y: number }) => {
      const ll = old.proj.toLngLat(o.x, o.y);
      [o.x, o.y] = next.proj.toLocal(ll.lon, ll.lat);
    };
    const [px, py] = this.pos();
    const near = (o: { x: number; y: number }) => Math.hypot(o.x - px, o.y - py) < 330;
    for (const c of this.cars) if (c !== this.car && !near(c)) this.dropCar(c);
    this.sweep();
    for (let i = this.people.length - 1; i >= 0; i--) if (!near(this.people[i])) this.dropPerson(i);
    for (const o of [this.me, this.cam, ...this.cars, ...this.people]) move(o);
    for (const s of this.smoke) s.life = 0;
    this.scene.remove(old.model.group);
    this.scene.add(next.model.group);
    this.world = next;
    old.dispose();
    for (const c of this.cars) {
      c.lastStop = -1;
      if (c.path) c.path = this.attach(c.x, c.y, c.th, c.kind === 'tram' ? 'tram' : 'drive');
    }
    for (const p of this.people) p.path = this.attach(p.x, p.y, p.th, 'walk');
    this.parkCars(this.pos());
    this.routeT = 0;
    this.routePts = null;
  }

  private maybeLoadNext(): void {
    if (this.loading || this.clock < this.retryAt) return;
    const [x, y] = this.pos();
    const next = this.world.needsRecentre(x, y);
    if (!next) return;
    this.loading = true;
    this.onSquare('loading');
    World.load(next, this.texturePx)
      .then((w) => {
        this.swap(w);
        this.onSquare('ready');
      })
      .catch((err) => {
        console.warn('next square failed', err);
        this.retryAt = this.clock + 6;
        this.onSquare('ready');
      })
      .finally(() => (this.loading = false));
  }

  /** The place on the network nearest to a point, facing the way `th` points. */
  private attach(x: number, y: number, th: number, want: 'drive' | 'walk' | 'tram'): PathState | null {
    const n = this.world.roads.nearest(x, y, 60, want);
    if (!n) return null;
    const p: PathState = { line: n.line, s: n.s, dir: 1 };
    const [hx, hy] = this.world.roads.heading(p);
    if (hx * Math.cos(th) + hy * Math.sin(th) < 0) p.dir = -1;
    return p;
  }

  // ------------------------------------------------------------------ cars

  private addCar(kind: CarKind, x: number, y: number, th: number): Car {
    const c = new Car(kind);
    c.x = x;
    c.y = y;
    c.th = th;
    this.cars.push(c);
    this.scene.add(c.mesh);
    return c;
  }

  private dropCar(c: Car): void {
    c.gone = true;
    this.scene.remove(c.mesh);
  }

  private sweep(): void {
    for (let i = this.cars.length - 1; i >= 0; i--) if (this.cars[i].gone) this.cars.splice(i, 1);
  }

  private carNear(x: number, y: number, r: number): boolean {
    return this.cars.some((c) => !c.gone && Math.hypot(c.x - x, c.y - y) < r);
  }

  /** Parked cars along the smaller streets; `keepClear` leaves the part you came from alone. */
  private parkCars(keepClear: [number, number] | null): void {
    const w = this.world;
    for (let k = 0; k < PARKED * 3 && this.cars.filter((c) => c.driver === 'none').length < PARKED; k++) {
      const p = w.roads.randomPlace('drive', 0, 0, 0, 5000);
      if (!p) return;
      const line = w.roads.lines[p.line];
      if (line.kind === 'motorway' || line.kind === 'primary') continue;
      const [x, y] = w.roads.lanePoint(p, line.w / 2 + 1);
      if (keepClear && Math.hypot(x - keepClear[0], y - keepClear[1]) < 330) continue;
      const [hx, hy] = w.roads.heading(p);
      if (!w.free(x, y, 1.3) || !w.free(x + hx * 1.6, y + hy * 1.6, 1.2) || !w.free(x - hx * 1.6, y - hy * 1.6, 1.2)) continue;
      if (this.carNear(x, y, 7)) continue;
      const r = Math.random();
      this.addCar(r < 0.6 ? 'sedan' : r < 0.8 ? 'sport' : 'van', x, y, Math.atan2(hy, hx));
    }
  }

  private spawnTraffic(kind: CarKind, minD: number, maxD: number): Car | null {
    const w = this.world;
    const [px, py] = this.pos();
    const p = w.roads.randomPlace(kind === 'tram' ? 'tram' : 'traffic', px, py, minD, maxD);
    if (!p) return null;
    const line = w.roads.lines[p.line];
    // buses keep to the bigger streets
    if (kind === 'bus' && (line.kind === 'minor' || line.kind === 'motorway')) return null;
    const [x, y] = w.roads.lanePoint(p, this.lane(p, kind));
    if (this.carNear(x, y, kind === 'bus' || kind === 'tram' ? 24 : 12) || !w.free(x, y, 1.2)) return null;
    const [hx, hy] = w.roads.heading(p);
    const c = this.addCar(kind, x, y, Math.atan2(hy, hx));
    c.driver = kind === 'police' ? 'cop' : 'ai';
    c.path = p;
    const v = kind === 'tram' || kind === 'bus' ? 6 : SPEED_LIMIT[line.kind] * 0.7;
    c.vx = hx * v;
    c.vy = hy * v;
    return c;
  }

  /** How far to the side of a line a vehicle keeps: its lane, on the side this country drives on. */
  private lane(p: PathState, kind: CarKind): number {
    if (kind === 'tram') return 0;
    return laneOffset(this.world.roads.lines[p.line]) * (this.world.leftHand ? -1 : 1);
  }

  private chasing(c: Car): boolean {
    return c.driver === 'cop' && this.heat > 0 && this.frozen <= 0;
  }

  /** Steer a car along its road, or at you. */
  private drive(c: Car, dt: number): void {
    const w = this.world;
    const net = w.roads;
    const [px, py] = this.pos();
    const chase = this.chasing(c);
    const toMe = Math.hypot(px - c.x, py - c.y);
    let tx: number;
    let ty: number;
    let limit: number;
    const vf = c.forward;
    const want = c.kind === 'tram' ? 'tram' : 'drive';
    const transit = c.kind === 'tram' || c.kind === 'bus';
    if (chase && toMe < 110 && !w.solids.blocked(c.x, c.y, px, py)) {
      // in sight: straight at where you'll be
      const [vx, vy] = this.vel();
      const lead = Math.min(1, toMe / 30);
      tx = px + vx * lead;
      ty = py + vy * lead;
      limit = toMe < 14 ? 12 + this.speed() : 33;
      c.path = this.attach(c.x, c.y, c.th, 'drive') ?? c.path;
    } else {
      if (!c.path) c.path = this.attach(c.x, c.y, c.th, want);
      if (!c.path) {
        c.controls.throttle = 0;
        return;
      }
      const p = c.path;
      const fx = Math.cos(c.th);
      const fy = Math.sin(c.th);
      const pick: Pick = chase
        ? (options, from) => {
            const d = Math.hypot(px - c.x, py - c.y) || 1;
            const score = (o: PathState) => {
              const [hx, hy] = net.heading(o);
              return (hx * (px - c.x) + hy * (py - c.y)) / d;
            };
            const best = options.reduce((a, b) => (score(b) > score(a) ? b : a));
            return !from || score(best) > score(from) + 0.3 ? best : null;
          }
        : (options, from) => {
            // trams and buses mostly carry straight on; cars turn off more often
            if (from && Math.random() > (transit ? 0.08 : 0.25)) return null;
            if (c.kind === 'tram') {
              const dot = (o: PathState) => net.heading(o)[0] * fx + net.heading(o)[1] * fy;
              return options.reduce((a, b) => (dot(b) > dot(a) ? b : a));
            }
            const ahead = options.filter((o) => {
              const [hx, hy] = net.heading(o);
              return hx * fx + hy * fy > -0.7;
            });
            const real = ahead.filter((o) => net.lines[o.line].traffic);
            const pool = real.length ? real : from ? [] : ahead.length ? ahead : options;
            return pool.length ? pickOne(pool) : null;
          };
      const look = 7 + Math.abs(vf) * 0.55;
      [tx, ty] = net.lanePoint(p, this.lane(p, c.kind));
      for (let k = 0; k < 30 && Math.hypot(tx - c.x, ty - c.y) < look; k++) {
        net.advance(p, 2, want, pick);
        [tx, ty] = net.lanePoint(p, this.lane(p, c.kind));
      }
      const base = SPEED_LIMIT[net.lines[p.line].kind] ?? 8;
      limit = chase ? Math.min(31, base * 2.3) : transit ? Math.min(base, 11) : base;
      // buses and trams wait a moment at each of their stops
      if (transit) {
        if (c.dwell > 0) {
          c.dwell -= dt;
          limit = 0;
        } else {
          const stops = w.stops;
          for (let i = 0; i < stops.length; i++) {
            const st = stops[i];
            if (st.kind !== c.kind || i === c.lastStop || Math.abs(st.x - c.x) > 11 || Math.abs(st.y - c.y) > 11) continue;
            c.dwell = 3.5;
            c.lastStop = i;
            break;
          }
        }
      }
    }
    this.pilot(c, tx, ty, limit, !chase, chase, dt);
  }

  /** Work the wheel and pedals of a car towards a point, at up to `limit` m/s. */
  private pilot(c: Car, tx: number, ty: number, limit: number, avoid: boolean, chase: boolean, dt: number): void {
    const vf = c.forward;
    const err = wrap(Math.atan2(ty - c.y, tx - c.x) - c.th);
    let want = limit * (1 - Math.min(0.72, Math.abs(err) * 0.9));

    // what's ahead: other cars, people, you
    let blocked = false;
    if (avoid && c.pushy <= 0) {
      const fx = Math.cos(c.th);
      const fy = Math.sin(c.th);
      const look = 9 + Math.max(0, vf) * 1.3;
      const gapTo = (ox: number, oy: number, r: number, wide: number) => {
        const dx = ox - c.x;
        const dy = oy - c.y;
        const ahead = dx * fx + dy * fy;
        if (ahead <= 0 || ahead > look + r || Math.abs(dx * fy - dy * fx) > wide) return;
        const gap = ahead - r - c.a - c.r;
        const cap = Math.max(0, gap - 2.5) * 1.1;
        if (cap < want) {
          want = cap;
          blocked = cap < 1;
        }
      };
      for (const o of this.cars) if (o !== c && !o.gone && Math.abs(o.x - c.x) < 40 && Math.abs(o.y - c.y) < 40) gapTo(o.x, o.y, o.a + o.r, 1.5);
      for (const o of this.people) if (o.state !== 'down') gapTo(o.x, o.y, 0.4, 1.4);
      if (!this.car && c !== this.car) gapTo(this.me.x, this.me.y, 0.4, 1.4);
    }
    c.pushy = Math.max(0, c.pushy - dt);

    if (c.backing > 0) {
      c.backing -= dt;
      c.controls.throttle = -1;
      c.controls.steer = clamp(-err * 2, -1, 1);
      return;
    }
    c.controls.steer = clamp(err * 2.2, -1, 1);
    c.controls.throttle = clamp((want - vf) * 0.6, -1, 1);
    if (want < 0.3 && vf < 0.3) c.controls.throttle = vf > 0.05 ? -1 : 0;
    if (c.speed < 0.5 && (want > 1 || blocked)) {
      c.stuck += dt;
      if (blocked && c.stuck > 5) {
        c.pushy = 3;
        c.stuck = 0;
      } else if (!blocked && c.stuck > (chase ? 0.8 : 2.2)) {
        c.backing = 1.1;
        c.stuck = 0;
      }
    } else c.stuck = 0;
  }

  // ------------------------------------------------------------------ people

  private spawnPerson(): void {
    const w = this.world;
    const [px, py] = this.pos();
    const p = w.roads.randomPlace('walk', px, py, this.viewR + 6, this.viewR + 110);
    if (!p) return;
    const line = w.roads.lines[p.line];
    if (line.kind === 'primary' && Math.random() < 0.6) return;
    const side = line.kind === 'path' ? 0 : line.w / 2 + 1.4;
    const [x, y] = w.roads.lanePoint(p, side);
    if (!w.free(x, y, 0.4)) return;
    const mesh = personMesh(pickOne(SHIRTS));
    this.scene.add(mesh);
    this.people.push({ x, y, th: 0, vx: 0, vy: 0, state: 'walk', t: 0, path: p, side, pace: 1.2 + Math.random() * 0.8, mesh });
  }

  private dropPerson(i: number): void {
    this.scene.remove(this.people[i].mesh);
    this.people.splice(i, 1);
  }

  private stepPeople(dt: number): void {
    const w = this.world;
    const net = w.roads;
    const [px, py] = this.pos();
    for (let i = this.people.length - 1; i >= 0; i--) {
      const p = this.people[i];
      if (Math.hypot(p.x - px, p.y - py) > this.viewR + 160 || Math.abs(p.x) > w.half - 5 || Math.abs(p.y) > w.half - 5) {
        this.dropPerson(i);
        continue;
      }
      if (p.state === 'down') {
        p.t -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-4 * dt);
        p.vy *= Math.exp(-4 * dt);
        if (p.t <= 0) {
          p.state = 'flee';
          p.t = 3;
          p.vx = 0;
          p.vy = 0;
          p.path = this.attach(p.x, p.y, p.th, 'walk');
        }
      } else {
        // a fast car close by and coming this way: jump aside
        if (p.state === 'walk') {
          for (const c of this.cars) {
            if (c.gone || c.speed < 6) continue;
            const dx = p.x - c.x;
            const dy = p.y - c.y;
            const d = Math.hypot(dx, dy);
            if (d > 11 || dx * c.vx + dy * c.vy < 0) continue;
            const side = Math.sign(dx * c.vy - dy * c.vx) || 1;
            p.state = 'flee';
            p.t = 1.2;
            p.vx = (c.vy / c.speed) * side;
            p.vy = (-c.vx / c.speed) * side;
            break;
          }
        }
        let speed = p.pace;
        let dx = 0;
        let dy = 0;
        if (p.state === 'flee' && p.t > 0 && (p.vx || p.vy)) {
          p.t -= dt;
          dx = p.vx;
          dy = p.vy;
          speed = 5;
          if (p.t <= 0) {
            p.state = 'walk';
            p.vx = 0;
            p.vy = 0;
          }
        } else if (p.path) {
          if (p.state === 'flee') {
            p.t -= dt;
            speed = 4.5;
            if (p.t <= 0) p.state = 'walk';
          }
          let [tx, ty] = net.lanePoint(p.path, p.side);
          if (Math.hypot(tx - p.x, ty - p.y) < 1.6) {
            net.advance(p.path, 2.5, 'walk', (options, from) => (from && Math.random() > 0.3 ? null : pickOne(options)));
            const line = net.lines[p.path.line];
            p.side = line.kind === 'path' ? 0 : line.w / 2 + 1.4;
            [tx, ty] = net.lanePoint(p.path, p.side);
          }
          dx = tx - p.x;
          dy = ty - p.y;
        } else {
          p.path = this.attach(p.x, p.y, p.th, 'walk');
        }
        const d = Math.hypot(dx, dy);
        if (d > 0.01) {
          p.x += (dx / d) * speed * dt;
          p.y += (dy / d) * speed * dt;
          p.th = Math.atan2(dy, dx);
        }
      }
      w.solids.push(p, 0.35);
      if (w.water.at(p.x, p.y) && !net.onRoad(p.x, p.y)) {
        this.dropPerson(i);
        continue;
      }
      p.mesh.position.set(p.x, w.groundY(p.x, p.y), -p.y);
      p.mesh.rotation.set(0, p.th, p.state === 'down' ? Math.PI / 2 : 0);
      if (p.state === 'down') p.mesh.position.y += 0.3;
    }
  }

  /** Cars against people and against you on foot. */
  private bumps(): void {
    for (const c of this.cars) {
      if (c.gone) continue;
      const fx = Math.cos(c.th);
      const fy = Math.sin(c.th);
      const reach = c.a + c.r + 0.5;
      const touch = (o: { x: number; y: number }, r: number): [number, number] | null => {
        if (Math.abs(o.x - c.x) > reach || Math.abs(o.y - c.y) > reach) return null;
        for (const s of c.offs) {
          const dx = o.x - (c.x + fx * c.a * s);
          const dy = o.y - (c.y + fy * c.a * s);
          const d = Math.hypot(dx, dy);
          if (d < c.r + r && d > 1e-6) {
            const push = c.r + r - d;
            o.x += (dx / d) * push;
            o.y += (dy / d) * push;
            return [dx / d, dy / d];
          }
        }
        return null;
      };
      for (const p of this.people) {
        const n = touch(p, 0.35);
        if (!n || p.state === 'down') continue;
        const closing = c.vx * n[0] + c.vy * n[1];
        if (closing > 3.5) {
          p.state = 'down';
          p.t = 4.5;
          p.vx = c.vx * 0.7;
          p.vy = c.vy * 0.7;
          if (c === this.car) this.offence(1, 'You knocked someone over');
        }
      }
      if (!this.car && this.frozen <= 0) {
        const n = touch(this.me, 0.4);
        if (n) {
          const closing = c.vx * n[0] + c.vy * n[1];
          if (closing > 4) {
            this.me.hp -= (closing - 3) * 5;
            this.me.vx = c.vx * 0.8;
            this.me.vy = c.vy * 0.8;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ you

  pos(): [number, number] {
    return this.car ? [this.car.x, this.car.y] : [this.me.x, this.me.y];
  }

  private vel(): [number, number] {
    return this.car ? [this.car.vx, this.car.vy] : [this.me.vx, this.me.vy];
  }

  private speed(): number {
    const [vx, vy] = this.vel();
    return Math.hypot(vx, vy);
  }

  /** The car you could get into from where you stand. */
  private carInReach(): Car | null {
    let best: Car | null = null;
    let bd = Infinity;
    for (const c of this.cars) {
      // trams stay on their rails: you can't take one
      if (c.gone || c.kind === 'tram') continue;
      const d = Math.hypot(c.x - this.me.x, c.y - this.me.y) - c.a - c.r;
      if (d < 2.2 && d < bd && c.speed < 9) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** Get into the car beside you, or out of the one you're in. */
  action(): void {
    if (this.frozen > 0) return;
    const w = this.world;
    if (this.car) {
      const c = this.car;
      if (c.speed > 4) {
        this.onToast('Slow down to get out', 'info');
        return;
      }
      const fx = Math.cos(c.th);
      const fy = Math.sin(c.th);
      const out = c.r + 0.9;
      const spots: Array<[number, number]> = [[-fy * out, fx * out], [fy * out, -fx * out], [-fx * (c.a + out), -fy * (c.a + out)], [fx * (c.a + out), fy * (c.a + out)]];
      const s = spots.find(([dx, dy]) => w.free(c.x + dx, c.y + dy, 0.4)) ?? spots[0];
      this.me.x = c.x + s[0];
      this.me.y = c.y + s[1];
      this.me.vx = 0;
      this.me.vy = 0;
      c.driver = 'none';
      c.controls.throttle = 0;
      c.controls.steer = 0;
      c.controls.handbrake = false;
      this.car = null;
      return;
    }
    const c = this.carInReach();
    if (!c) {
      this.rideSubway();
      return;
    }
    if (c.driver !== 'none') {
      // the driver gets out and runs
      const mesh = personMesh(c.driver === 'cop' ? '#1d3f8f' : pickOne(SHIRTS));
      this.scene.add(mesh);
      const side = c.r + 1;
      this.people.push({ x: c.x + Math.sin(c.th) * side, y: c.y - Math.cos(c.th) * side, th: c.th, vx: 0, vy: 0, state: 'flee', t: 6, path: this.attach(c.x, c.y, c.th + Math.PI, 'walk'), side: 3, pace: 1.6, mesh });
      this.offence(c.driver === 'cop' ? 2 : 1, c.driver === 'cop' ? 'You took a police car' : c.kind === 'bus' ? 'You took a bus' : 'You took someone’s car');
    }
    c.driver = 'player';
    c.path = null;
    this.car = c;
    this.mine = c;
  }

  /** The subway entrance you're standing at, if any. */
  private subwayHere(): number {
    const stops = this.world.stops;
    for (let i = 0; i < stops.length; i++) if (stops[i].kind === 'subway' && Math.hypot(stops[i].x - this.me.x, stops[i].y - this.me.y) < 4.5) return i;
    return -1;
  }

  /** Down the stairs here, up again at the station nearest to where you're headed. */
  private rideSubway(): void {
    const w = this.world;
    const here = this.subwayHere();
    if (here < 0) return;
    const goal = this.goal();
    const [gx, gy] = goal ? this.local(goal) : [NaN, NaN];
    let best = -1;
    let bd = Infinity;
    w.stops.forEach((st, i) => {
      if (st.kind !== 'subway' || Math.hypot(st.x - this.me.x, st.y - this.me.y) < 200) return;
      const d = goal ? Math.hypot(st.x - gx, st.y - gy) : Math.random();
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) {
      this.onToast('No other station near here', 'info');
      return;
    }
    const to = w.stops[best];
    // riding only pays when it brings you closer
    if (goal && bd > Math.hypot(this.me.x - gx, this.me.y - gy)) {
      this.onToast('No station closer to where you’re going', 'info');
      return;
    }
    const spots: Array<[number, number]> = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]];
    const s = spots.find(([dx, dy]) => w.free(to.x + dx, to.y + dy, 0.4)) ?? spots[0];
    this.me.x = to.x + s[0];
    this.me.y = to.y + s[1];
    this.me.vx = 0;
    this.me.vy = 0;
    this.frozen = 1.3;
    this.cam.x = this.me.x;
    this.cam.y = this.me.y;
    this.onRide(to.name ? `Subway to ${to.name}` : 'Subway');
  }

  /** Back onto the nearest road, on foot: for when you're stuck. */
  reset(): void {
    if (this.frozen > 0) return;
    this.toRoad(0, 60);
  }

  /** Where to stand next to a car parked at the kerb there: on the pavement, or in the road where a wall is in the way. */
  private standBeside(p: PathState): [number, number] {
    const w = this.world;
    const half = w.roads.lines[p.line].w / 2;
    const [x, y] = w.roads.lanePoint(p, half + 3.4);
    return w.free(x, y, 0.5) ? [x, y] : w.roads.lanePoint(p, half - 1.4);
  }

  private toRoad(minD: number, maxD: number): PathState | null {
    const w = this.world;
    const [x, y] = this.pos();
    if (this.car) {
      this.car.driver = 'none';
      this.car.controls.throttle = 0;
      this.car = null;
    }
    const p = (minD > 0 ? w.roads.randomPlace('drive', x, y, minD, maxD) : null) ?? this.attach(x, y, 0, 'drive') ?? w.roads.randomPlace('drive', x, y, 0, 3000);
    if (!p) return null;
    const [nx, ny] = w.roads.lanePoint(p, w.roads.lines[p.line].w / 2 + 1.5);
    this.me.x = nx;
    this.me.y = ny;
    this.me.vx = 0;
    this.me.vy = 0;
    return p;
  }

  private walk(input: Input, dt: number): void {
    const me = this.me;
    const w = this.world;
    const m = Math.hypot(input.moveX, input.moveY);
    const x0 = me.x;
    const y0 = me.y;
    me.x += (input.moveX * WALK_SPEED + me.vx) * dt;
    me.y += (input.moveY * WALK_SPEED + me.vy) * dt;
    if (w.inWater(me.x, me.y) && !w.inWater(x0, y0)) {
      me.x = x0;
      me.y = y0;
    }
    me.vx *= Math.exp(-5 * dt);
    me.vy *= Math.exp(-5 * dt);
    if (m > 0.05) me.th = Math.atan2(input.moveY, input.moveX);
    w.solids.push(me, 0.4);
    const edge = w.half - 4;
    me.x = clamp(me.x, -edge, edge);
    me.y = clamp(me.y, -edge, edge);
    me.hp = Math.min(100, me.hp + 1.5 * dt);
  }

  private steerMine(c: Car, input: Input, dt: number): void {
    const k = c.controls;
    k.handbrake = input.handbrake;
    if (input.stick) {
      const err = wrap(Math.atan2(input.moveY, input.moveX) - c.th);
      const m = Math.hypot(input.moveX, input.moveY);
      const vf = c.forward;
      if (Math.abs(err) > 2.2 && vf < 4) {
        // pointing behind you: back up
        k.throttle = -m;
        k.steer = clamp(-wrap(err + Math.PI) * 2.5, -1, 1);
      } else {
        k.steer = clamp(err * 2.4, -1, 1);
        k.throttle = m * (1 - Math.min(0.6, Math.abs(err) * 0.4));
      }
    } else {
      k.throttle = input.throttle;
      // keys are all or nothing: turn the wheel over a moment, not at once
      k.steer += clamp(input.steer - k.steer, -7 * dt, 7 * dt);
    }
    if (input.brake) k.throttle = -1;
  }

  // ------------------------------------------------------------------ the law

  private offence(points: number, text: string): void {
    // one crash is one offence, however many things it hit
    if (this.clock < this.offenceAt) return;
    this.offenceAt = this.clock + 1.2;
    const before = Math.ceil(this.heat);
    this.heat = Math.min(MAX_HEAT, this.heat + points);
    if (Math.ceil(this.heat) > before) this.onToast(text, 'bad');
  }

  private law(dt: number): void {
    const w = this.world;
    const [px, py] = this.pos();
    const cops = this.cars.filter((c) => c.driver === 'cop' && !c.gone);
    if (this.heat <= 0) {
      this.caughtT = 0;
      return;
    }
    let seen = false;
    let close = false;
    for (const c of cops) {
      const d = Math.hypot(c.x - px, c.y - py);
      // a police car that can't get to you gives way to one that can
      c.stale = d > 90 && c.speed < 2 ? c.stale + dt : 0;
      if (c.stale > 4) this.dropCar(c);
      if (d < 75 && !w.solids.blocked(c.x, c.y, px, py)) seen = true;
      if (d < 8.5) close = true;
    }
    if (!seen) {
      this.heat -= dt / 13;
      if (this.heat <= 0) {
        this.heat = 0;
        this.onToast('You lost them', 'good');
      }
    }
    // more heat, more police
    this.copT -= dt;
    if (cops.length < Math.ceil(this.heat) && this.copT <= 0) {
      this.copT = 1.5;
      this.spawnTraffic('police', this.viewR + 25, this.viewR + 150);
    }
    if (close && this.speed() < 2.2) {
      this.caughtT += dt;
      if (this.caughtT > 1.3) this.fine('Caught!', 0.25);
    } else this.caughtT = Math.max(0, this.caughtT - dt);
  }

  /** Stopped by the police or knocked out: pay up and start again a few streets away. */
  private fine(title: string, share: number): void {
    const cost = Math.min(this.cash, Math.max(50, Math.round((this.cash * share) / 10) * 10));
    this.cash -= cost;
    if (!this.run.over) this.run.score = Math.max(0, this.run.score - cost);
    this.heat = 0;
    this.caughtT = 0;
    this.me.hp = 100;
    this.frozen = 1.6;
    this.onFlash(cost > 0 ? `${title}  −$${cost}` : title);
    if (this.job) this.endJob(false);
    // start again as the game began: on foot, with a parked car to take right beside you
    const p = this.toRoad(120, 320);
    if (p) {
      const w = this.world;
      const half = w.roads.lines[p.line].w / 2;
      const [cx, cy] = w.roads.lanePoint(p, half + 1);
      const [hx, hy] = w.roads.heading(p);
      this.addCar('sedan', cx, cy, Math.atan2(hy, hx)).driver = 'none';
      [this.me.x, this.me.y] = this.standBeside(p);
    }
    this.onSave();
  }

  // ------------------------------------------------------------------ jobs

  private local(m: Marker): [number, number] {
    return this.world.proj.toLocal(m.at.lon, m.at.lat);
  }

  private newMarker(colour: string, p: PathState): Marker {
    const [x, y] = this.world.roads.point(p.line, p.s);
    const mesh = markerMesh(colour);
    this.scene.add(mesh);
    return { at: this.world.proj.toLngLat(x, y), mesh };
  }

  private jobs(dt: number): void {
    const w = this.world;
    const [px, py] = this.pos();
    if (this.job) {
      const j = this.job;
      const [x, y] = this.local(j.to);
      j.metres = Math.hypot(x - px, y - py);
      j.left -= dt;

      if (j.metres < 6.5) {
        const bonus = Math.round((j.left * 2) / 10) * 10;
        this.cash += j.pay + bonus;
        this.delivered++;
        const r = this.run;
        if (!r.over) {
          r.done++;
          r.score += j.pay + bonus;
          this.onToast(`Delivery ${r.done} of ${RUN_JOBS}  +$${j.pay + bonus}`, 'good');
        } else this.onToast(`Delivered  +$${j.pay + bonus}`, 'good');
        this.endJob(true);
        this.onSave();
        if (!r.over && r.done >= RUN_JOBS) {
          r.over = true;
          this.onRunEnd(r.score, r.seconds);
        }
      } else if (j.left <= 0) {
        this.onToast('Too late: the job is gone', 'bad');
        this.endJob(false);
      }
      return;
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const m = this.pickups[i];
      const [x, y] = this.local(m);
      const d = Math.hypot(x - px, y - py);
      if (d < 6.5) {
        // a drop-off on a real street that the roads actually lead to
        const [near, far, pace] = RUN_STEPS[this.run.over ? 2 : Math.min(this.run.done, RUN_STEPS.length - 1)];
        let marker: Marker | null = null;
        let metres = 0;
        for (let k = 0; k < 10 && !marker; k++) {
          const to = w.roads.randomPlace('traffic', px, py, k < 6 ? near : 150, k < 6 ? far : 3000);
          if (!to) continue;
          const cand = this.newMarker('#ffd400', to);
          const f = this.fieldOf(cand);
          const r = f && w.roads.route(f, px, py);
          if (r && r.metres < 2400) {
            marker = cand;
            metres = r.metres;
          } else this.scene.remove(cand.mesh);
        }
        if (!marker) continue;
        this.job = { to: marker, metres, left: 25 + metres / pace, pay: Math.max(50, Math.round((metres * (0.5 + this.delivered * 0.03)) / 10) * 10) };
        this.routeT = 0;
        for (const o of this.pickups.splice(0)) this.scene.remove(o.mesh);
        this.onToast('Package on board: get it to the yellow ring', 'info');
        return;
      }
      if (d > 900) {
        this.scene.remove(m.mesh);
        this.pickups.splice(i, 1);
      }
    }
    if (this.pickups.length < 3) {
      const p = w.roads.randomPlace('traffic', px, py, 90, 520);
      if (p) {
        const [x, y] = w.roads.point(p.line, p.s);
        if (!this.pickups.some((m) => Math.hypot(this.local(m)[0] - x, this.local(m)[1] - y) < 150)) this.pickups.push(this.newMarker('#2bd4e0', p));
      }
    }
  }

  /** Driving distances to a marker, in the square that is loaded now. */
  private fieldOf(m: Marker): RouteField | null {
    if (m.fieldIn !== this.world) {
      const edge = this.world.half - 10;
      const [x, y] = this.local(m);
      m.field = this.world.roads.field(clamp(x, -edge, edge), clamp(y, -edge, edge));
      m.fieldIn = this.world;
    }
    return m.field ?? null;
  }

  /** The way to the drop-off, as a yellow line on the road ahead of you. */
  /** Where you're headed: the drop-off, or else the nearest package. */
  private goal(): Marker | null {
    if (this.job) return this.job.to;
    const [px, py] = this.pos();
    let best: Marker | null = null;
    let bd = Infinity;
    for (const m of this.pickups) {
      const [x, y] = this.local(m);
      const d = Math.hypot(x - px, y - py);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  private drawRoute(to: Marker | null, colour: string): void {
    const f = to && this.fieldOf(to);
    const [px, py] = this.pos();
    const r = f ? this.world.roads.route(f, px, py, 600) : null;
    // the little map always shows the way; the line on the road is a choice
    this.routePts = r && r.pts.length > 1 ? r.pts : null;
    this.routeLine.visible = this.showRoute && !!this.routePts;
    if (!this.routeLine.visible || !r) return;
    this.routeLine.material.color.set(colour);
    const strip = new Strip();
    strip.add(r.pts, 1.7, 0.4, (x, y) => this.world.groundY(x, y));
    this.routeLine.geometry.dispose();
    this.routeLine.geometry = strip.geometry();
  }

  /** Drive yourself: to the drop-off, or to the nearest job. For filming and tests. */
  private autopilot(dt: number): void {
    const w = this.world;
    if (!this.car) {
      const near = this.carInReach();
      if (near && near.hp > 40) {
        this.action();
        return;
      }
      let best: Car | null = null;
      for (const c of this.cars) if (!c.gone && c.driver === 'none' && c.hp > 40 && (!best || Math.hypot(c.x - this.me.x, c.y - this.me.y) < Math.hypot(best.x - this.me.x, best.y - this.me.y))) best = c;
      if (!best) return;
      const d = Math.hypot(best.x - this.me.x, best.y - this.me.y) || 1;
      this.walk({ moveX: (best.x - this.me.x) / d, moveY: (best.y - this.me.y) / d, stick: true, throttle: 0, steer: 0, brake: false, handbrake: false }, dt);
      return;
    }
    const c = this.car;
    const goal = this.goal();
    const f = goal && this.fieldOf(goal);
    const r = f ? w.roads.route(f, c.x, c.y, 90) : null;
    if (!goal || !r) {
      c.controls.throttle = 0;
      return;
    }
    // aim at a point a little way down the route, on the right of the road
    let [tx, ty] = this.local(goal);
    if (r.metres > 14) {
      let left = 9 + Math.abs(c.forward) * 0.55;
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1];
        const b = r.pts[i];
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d < 1e-3) continue;
        const t = Math.min(1, left / d);
        const side = w.leftHand ? -1.7 : 1.7;
        tx = a[0] + (b[0] - a[0]) * t + ((b[1] - a[1]) / d) * side;
        ty = a[1] + (b[1] - a[1]) * t - ((b[0] - a[0]) / d) * side;
        left -= d;
        if (left <= 0) break;
      }
    }
    c.controls.handbrake = false;
    this.pilot(c, tx, ty, this.autoSpeed, this.autoAvoid, false, dt);
  }

  private endJob(_done: boolean): void {
    this.routeLine.visible = false;
    if (!this.job) return;
    this.scene.remove(this.job.to.mesh);
    this.job = null;
  }

  private placeMarkers(): void {
    const pulse = 1 + 0.08 * Math.sin(this.clock * 5);
    for (const m of [...this.pickups, ...(this.job ? [this.job.to] : [])]) {
      const [x, y] = this.local(m);
      const inside = Math.abs(x) < this.world.half && Math.abs(y) < this.world.half;
      m.mesh.visible = inside;
      if (!inside) continue;
      m.mesh.position.set(x, this.world.groundY(x, y), -y);
      m.mesh.scale.set(pulse, 1, pulse);
    }
  }

  // ------------------------------------------------------------------ the frame

  update(dtRaw: number, input: Input): void {
    const dt = Math.max(0, Math.min(dtRaw, 0.05));
    const w = this.world;
    this.clock += dt;
    if (this.frozen > 0) this.frozen -= dt;
    const live = this.frozen <= 0;

    if (this.auto && live) this.autopilot(dt);
    else if (this.car) this.steerMine(this.car, input, dt);
    else if (live) this.walk(input, dt);
    for (const c of this.cars) if (!c.gone && (c.driver === 'ai' || c.driver === 'cop')) this.drive(c, dt);

    let fastest = 0;
    for (const c of this.cars) {
      c.knock = 0;
      fastest = Math.max(fastest, c.speed);
    }
    const steps = Math.max(1, Math.ceil((fastest * dt) / 0.45));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const c of this.cars) if (!c.gone && !c.asleep) c.step(h, w);
      for (let i = 0; i < this.cars.length; i++) {
        const p = this.cars[i];
        if (p.gone) continue;
        for (let j = i + 1; j < this.cars.length; j++) {
          const q = this.cars[j];
          if (q.gone || (p.asleep && q.asleep)) continue;
          // whose fault a crash is: yours if you were driving into the other car
          const mine = p === this.car ? p : q === this.car ? q : null;
          let closing = 0;
          if (mine) {
            const other = mine === p ? q : p;
            const d = Math.hypot(other.x - mine.x, other.y - mine.y) || 1;
            closing = (mine.vx * (other.x - mine.x) + mine.vy * (other.y - mine.y)) / d;
          }
          const impact = collideCars(p, q);
          if (mine && impact > 5 && closing > 4) {
            const other = mine === p ? q : p;
            if (other.driver === 'cop') this.offence(1, 'You rammed the police');
            else if (other.driver === 'ai' && impact > 9) this.offence(1, 'That was a crash');
          }
        }
      }
    }
    this.stepPeople(dt);
    this.bumps();

    // water, wrecks and cars that have driven out of the picture
    const [px, py] = this.pos();
    for (const c of this.cars) {
      if (c.gone) continue;
      const far = Math.hypot(c.x - px, c.y - py);
      if (w.inWater(c.x, c.y)) {
        if (c === this.car) {
          this.onToast('Splash! That car is gone', 'bad');
          this.toRoad(0, 0);
        }
        this.dropCar(c);
      } else if (c.driver === 'ai' || c.driver === 'cop') {
        const limit = this.chasing(c) ? 420 : this.viewR + 190;
        if (far > limit || Math.abs(c.x) > w.half - 8 || Math.abs(c.y) > w.half - 8 || (c.hp <= 0 && far > this.viewR + 20)) this.dropCar(c);
        else if (c.hp <= 0) c.driver = 'none';
      }
    }
    this.sweep();
    if (!this.car && live && w.inWater(this.me.x, this.me.y)) {
      this.onToast('Splash!', 'bad');
      this.toRoad(0, 0);
    }
    if (this.me.hp <= 0) this.fine('Knocked out!', 0.15);

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.25;
      const traffic = this.cars.filter((c) => c.driver === 'ai' || c.driver === 'cop').length;
      if (traffic < TRAFFIC) {
        const r = Math.random();
        this.spawnTraffic(r < 0.07 ? 'police' : r < 0.2 ? 'bus' : r < 0.65 ? 'sedan' : r < 0.83 ? 'van' : 'sport', this.viewR + 20, this.viewR + 150);
      }
      // a few trams wherever the map has tracks
      if (w.roads.hasTrams && this.cars.filter((c) => c.kind === 'tram').length < 3) this.spawnTraffic('tram', this.viewR + 25, this.viewR + 220);
      if (this.people.length < PEOPLE) this.spawnPerson();
      this.maybeLoadNext();
    }
    if (live) {
      this.law(dt);
      if (!this.run.over) this.run.seconds += dt;
      this.jobs(dt);
      // a line on the road to the drop-off, or to the nearest package
      this.routeT -= dt;
      if (this.routeT <= 0) {
        this.routeT = 0.3;
        this.drawRoute(this.goal(), this.job ? '#ffd400' : '#2bd4e0');
      }
    }
    this.draw(dt);
  }

  private draw(dt: number): void {
    const w = this.world;
    const [px, py] = this.pos();
    const [vx, vy] = this.vel();
    const speed = Math.hypot(vx, vy);
    for (const c of this.cars) {
      c.place(w);
      if (c.lights.length) {
        const on = this.chasing(c) ? Math.floor(this.clock * 6) % 2 : -1;
        c.lights.forEach((l, i) => ((l.material as MeshStandardMaterial).emissiveIntensity = on < 0 ? 0.25 : on === i ? 3 : 0.1));
      }
    }
    this.me.mesh.visible = !this.car;
    const mine = this.mine;
    this.mineRing.visible = !this.car && !!mine && !mine.gone && mine.hp > 0;
    if (mine && this.mineRing.visible) this.mineRing.position.set(mine.x, w.groundY(mine.x, mine.y) + 0.6, -mine.y);
    this.me.mesh.position.set(this.me.x, w.groundY(this.me.x, this.me.y), -this.me.y);
    this.me.mesh.rotation.y = this.me.th;
    this.placeMarkers();
    this.puff(dt);

    // the camera: straight down, north up, higher the faster you go, and above the roofs
    const k = 1 - Math.exp(-4 * dt);
    const lead = this.car ? 0.5 : 0;
    this.cam.x += (px + vx * lead - this.cam.x) * k;
    this.cam.y += (py + vy * lead - this.cam.y) * k;
    const portrait = Math.max(1, 1 / this.camera.aspect) ** 0.8;
    let h = (this.car ? 60 + speed * 2.7 : 40) * portrait;
    h = Math.max(h, w.solids.tallestNear(px, py, 45) + 34);
    this.cam.h += (h - this.cam.h) * (1 - Math.exp(-1.8 * dt));
    const gy = w.groundY(this.cam.x, this.cam.y);
    this.camera.position.set(this.cam.x, gy + this.cam.h, -this.cam.y);
    this.camera.lookAt(this.cam.x, gy, -this.cam.y);
    const halfH = this.cam.h * Math.tan((FOV * Math.PI) / 360);
    this.viewR = Math.hypot(halfH, halfH * this.camera.aspect);

    const reach = Math.max(120, this.viewR * 1.15);
    this.sun.target.position.set(this.cam.x, gy, -this.cam.y);
    this.sun.position.set(this.cam.x - 0.55 * 500, gy + 0.78 * 500, -this.cam.y - 0.55 * 500);
    const sc = this.sun.shadow.camera;
    if (sc.right !== reach) {
      sc.left = -reach;
      sc.right = reach;
      sc.top = reach;
      sc.bottom = -reach;
      sc.near = 50;
      sc.far = 1200;
      sc.updateProjectionMatrix();
    }
    if (this.render) this.renderer.render(this.scene, this.camera);
  }

  /** Smoke from cars that have taken a beating. */
  private puff(dt: number): void {
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.09;
      const [px, py] = this.pos();
      for (const c of this.cars) {
        if (c.hp >= 35 || Math.hypot(c.x - px, c.y - py) > this.viewR) continue;
        const s = this.smoke.find((o) => o.life <= 0);
        if (!s) break;
        s.life = 1;
        s.mesh.visible = true;
        s.mesh.material.color.set(c.hp <= 0 ? '#1c1c1c' : '#6a6a6a');
        s.mesh.position.set(c.x + Math.cos(c.th) * c.a + (Math.random() - 0.5), this.world.groundY(c.x, c.y) + 1.4, -(c.y + Math.sin(c.th) * c.a) + (Math.random() - 0.5));
      }
    }
    for (const s of this.smoke) {
      if (s.life <= 0) continue;
      s.life -= dt / 1.4;
      s.mesh.position.y += 3 * dt;
      s.mesh.scale.setScalar(1 + (1 - s.life) * 2.2);
      s.mesh.material.opacity = Math.max(0, s.life) * 0.5;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  /** What the little map draws: you, the rings, the way there, and the police while they're after you. */
  mapView(): { x: number; y: number; th: number; pickups: Pt[]; drop: Pt | null; cops: Pt[]; route: Pt[] | null } {
    const [x, y] = this.pos();
    return {
      x,
      y,
      th: this.car ? this.car.th : this.me.th,
      pickups: this.job ? [] : this.pickups.map((m) => this.local(m)),
      drop: this.job ? this.local(this.job.to) : null,
      cops: this.heat > 0 ? this.cars.filter((c) => c.driver === 'cop' && !c.gone).map((c): Pt => [c.x, c.y]) : [],
      route: this.routePts,
    };
  }

  /** What the screen shows around the picture. */
  hud(): Hud {
    const [px, py] = this.pos();
    let target: Hud['target'] = null;
    let best: { x: number; y: number; d: number; kind: 'drop' | 'job' } | null = null;
    if (this.job) {
      const [x, y] = this.local(this.job.to);
      best = { x, y, d: Math.hypot(x - px, y - py), kind: 'drop' };
    } else {
      for (const m of this.pickups) {
        const [x, y] = this.local(m);
        const d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { x, y, d, kind: 'job' };
      }
    }
    if (best) {
      const v = new Vector3(best.x, this.world.groundY(clamp(best.x, -this.world.half, this.world.half), clamp(best.y, -this.world.half, this.world.half)), -best.y).project(this.camera);
      target = { ndcX: v.x, ndcY: v.y, metres: best.d, kind: best.kind };
    }
    let hint = '';
    if (!this.car) {
      const c = this.carInReach();
      if (c) hint = c.driver === 'none' ? 'get in' : c.kind === 'bus' ? 'take this bus' : 'take this car';
      else if (this.subwayHere() >= 0) hint = 'take the subway';
    } else if (this.car.hp <= 0) hint = 'wrecked: get out';
    return {
      cash: this.cash,
      heat: Math.ceil(this.heat),
      health: Math.max(0, this.me.hp),
      carHp: this.car ? this.car.hp : null,
      kmh: this.speed() * 3.6,
      job: this.job ? { left: this.job.left, metres: this.job.metres, pay: this.job.pay } : null,
      hint,
      target,
      delivered: this.delivered,
      run: this.run.over ? null : { n: this.run.done + 1, of: RUN_JOBS, score: this.run.score },
    };
  }
}
