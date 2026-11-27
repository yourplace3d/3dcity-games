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
  PlaneGeometry,
  PCFShadowMap,
  BasicShadowMap,
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
import { closeIn, FIND_FAR, FIND_NEAR, CLOSE_IN_S, HAND_M, HAND_SPEED, seen, zoneAround, ZONE_MIN } from './find';
import type { Input } from './input';
import { Strip, drawnOverGround } from './roadMesh';
import { laneOffset, mayGo, RAIL_ON, SPEED_LIMIT, type PathState, type Pick, type RouteField } from './roads';
import { areaCentre, riseUnder, SUBWAY_RIDES, World } from './world';
import type { Ears, Sfx } from '../sound';
import { DROP, JOB_OF, RING, ringAlong, type JobKind } from './services';
import { partyClock } from './party';

const FOV = 42;
/** A place opens seen from this high (m): about a kilometre of it, to show where you are. */
const ARRIVE_M = 1100;
/** It holds there a moment, then comes down to you in this many seconds. */
const ARRIVE_HOLD_S = 0.9;
const DESCENT_S = 3.4;
const TRAFFIC = 13;
const PEOPLE = 26;
const PARKED = 70;
const WALK_SPEED = 6.2;
const MAX_HEAT = 4;

/** What a vehicle keeps to: its rails, or the streets. */
const railsOf = (kind: CarKind): 'tram' | 'train' | null => (kind === 'tram' || kind === 'train' ? kind : null);
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
  /** for a package: the kind of job it is */
  kind?: JobKind;
  /** the colour of its ring (`RING`), and the one it shows this moment (green while a home waits) */
  colour?: string;
  shown?: string;
  /** driving distances to it, in the square they were worked out for */
  field?: RouteField | null;
  fieldIn?: World;
}

/** The places of a run: where it began, and each delivery's package and drop-off. */
export interface Course {
  start: LngLat;
  legs: Array<{ from: LngLat; to: LngLat; kind?: JobKind }>;
}

export interface Job {
  to: Marker;
  left: number;
  pay: number;
  metres: number;
  kind: JobKind;
  /** how whole the car was when the load came on board */
  hp0: number;
  /** a mission's package, going to `Game.special` */
  special?: boolean;
  /** a supply run's load is lighter: this share of a heavy load's slowing */
  light?: number;
  /** the car the package came on board in, if any: whether the load took a dent is judged on it */
  car0?: Car | null;
  /** a party's food (`Game.party`): no pay, and the time from pickup to door is what counts */
  party?: boolean;
  /** the clock it started with (s) */
  clock0?: number;
}

/**
 * A party run (`game/party.ts`): the food is picked up at `pick` and goes to the door at `door`, on a
 * clock that starts at the pickup. While it is on there are no other jobs and no run.
 */
export interface PartyRun {
  pick: LngLat;
  door: LngLat;
  /** said as the food comes on board */
  say: string;
  /** the last metres to the door on foot, up a lane too narrow for a car: they get time on the clock */
  walk?: number;
}

/**
 * A car to find (`find.ts`): parked at `car`, somewhere in the circle around `zone`; once seen and taken, it
 * goes to the ring at `to`. Kept as places on the earth, so a new square doesn't lose it.
 */
export interface FindRun {
  car: LngLat;
  th: number;
  kind: CarKind;
  colour: string;
  zone: LngLat;
  /** the circle's radius (m) */
  r: number;
  to: LngLat;
}

/** What happens while a car is looked for: seen, got in, out again, the circle closed in, back at the ring, wrecked, or put off. */
export type FindEvent = 'spotted' | 'in' | 'out' | 'closer' | 'done' | 'wrecked' | 'dropped';

export interface Hud {
  cash: number;
  heat: number;
  health: number;
  carHp: number | null;
  kmh: number;
  job: { left: number; metres: number; pay: number; kind: JobKind; party: boolean } | null;
  hint: string;
  /** where the arrow points: the drop-off, or the nearest job; `colour` is the colour of the ring it points to */
  target: { ndcX: number; ndcY: number; metres: number; kind: 'drop' | 'job' | 'guide'; colour: string } | null;
  delivered: number;
  /** well-known sights in the picture, to write their names over them */
  sights: Array<{ name: string; ndcX: number; ndcY: number; metres: number | null }>;
  /** the run of deliveries being scored: which one is next, and the score so far */
  run: { n: number; of: number; score: number } | null;
}

/** What happened in play, for whoever listens (the trophies). */
export type GameEvent =
  | { kind: 'delivered'; job: JobKind; left: number; special: boolean; /** the car the load came on board in took harm on the way */ dented?: boolean }
  | { kind: 'fined' }
  | { kind: 'lost' }
  | { kind: 'run'; fined: boolean };

/** A run is this many deliveries; each asks a little more than the one before. A run someone sent keeps its own number. */
export const RUN_JOBS = 3;
/** how near a station's package the card offering its job comes (m), and how slow the player has to be: stopped (m/s) */
const OFFER_M = 14;
const OFFER_SPEED = 1.5;
/** how near a station, or the spot on the road beside it, counts as being at it (m) */
const STATION_M = 35;
/** how far from a mission's door a station's package still goes to it, once the next square has left its building behind (m, as the crow flies) */
const DOOR_REACH_M = 2000;
/** the autopilot leaves a wedged car and walks when the drop-off is this much further by road than the party's walk (m) */
const WALK_AUTO_M = 80;
/** The most cash a player can hold, for now: above it, pay and rent are not added. */
export const MAX_CASH = 1_000_000;
/** open jobs pay more with each delivery made, up to this many */
const OPEN_JOBS_GROW = 50;
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

/** the colours of a car blowing up */
const BLAST = ['#ff8a2a', '#ffd400', '#ff5a4d', '#2a2a2a', '#1c1c1c'];

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

/** Colour a ring made by `markerMesh` anew. */
function tintMarker(g: Group, colour: string): void {
  for (const c of g.children) ((c as Mesh).material as MeshBasicMaterial).color.set(colour);
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
  private money = 0;
  /** Cash, never more than `MAX_CASH`: whatever adds to it (pay, rent, an add-on, a loaded save) stops there. */
  get cash(): number {
    return this.money;
  }
  set cash(v: number) {
    const was = this.money;
    this.money = Math.min(MAX_CASH, Math.max(0, Number.isFinite(v) ? v : 0));
    if (this.money === MAX_CASH && was < MAX_CASH && was > 0) this.onToast('$1,000,000: the most cash you can hold for now. Spend some on homes.', 'good');
  }
  delivered = 0;
  heat = 0;
  job: Job | null = null;
  private pickups: Marker[] = [];
  private cam = { x: 0, y: 0, h: 90 };
  /** seconds left of the look from above that a place opens with */
  private descent = 0;
  /** the height it comes down from; 0 for the full look from above */
  private descentFrom = 0;
  /** the camera is on its way up over the town, after a run */
  private rising = false;
  private viewR = 100;
  private clock = 0;
  private spawnT = 0;
  private copT = 0;
  private caughtT = 0;
  /** how many places for a package in a row had no road leading to them */
  private noWay = 0;
  /** where tracks and a street cross at different heights, by the metre, worked out once a frame (`apart`) */
  private bridged = new Map<string, boolean>();
  /** seconds left of the car you sat in blowing up, and that car */
  private blowT = 0;
  private blown: Car | null = null;
  private routeT = 0;
  private routePts: Pt[] | null = null;
  /** the ring the way leads to (null: the drop-off), for its colour */
  private routeTo: Marker | null = null;
  private readonly routeLine = new Mesh<BufferGeometry, MeshBasicMaterial>(new BufferGeometry(), new MeshBasicMaterial({ color: DROP, transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  /** drive yourself (for filming and tests), how fast, and whether to brake for what's ahead */
  auto = false;
  /** draw the way to the next ring as a line on the road; off: the arrow alone shows the direction */
  showRoute = false;
  /** the car you last drove, ringed while you're on foot so you can find it again */
  private mine: Car | null = null;
  /** you, drawn over a roof you are beneath (a passage through a building): the camera looks straight down */
  private readonly ghost = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));
  private readonly mineRing = new Mesh(new RingGeometry(3.3, 3.8, 40), new MeshBasicMaterial({ color: '#ffffff', side: DoubleSide, transparent: true, opacity: 0.85, depthWrite: false }));
  autoSpeed = 16;
  autoAvoid = true;
  /** the autopilot's car has come no nearer its drop-off for so long (s), and it walks the rest of the way */
  private autoStuck = 0;
  private autoBest = Infinity;
  private autoGoal: Marker | null = null;
  private autoWalk = false;
  /** seconds left of backing up, where there was no room to get out */
  private autoBack = 0;
  private offenceAt = 0;
  private loading = false;
  /** A city change makes any pending neighbouring square obsolete. */
  private loadVersion = 0;
  private retryAt = 0;
  private frozen = 0;
  private readonly smoke: Array<{ mesh: Mesh<SphereGeometry, MeshBasicMaterial>; life: number }> = [];
  private smokeT = 0;
  private sprayT = 0;
  /** the player's car is going down in water: where the shore was, and for how long it has sunk */
  private sinking: { car: Car; t: number; shore: [number, number] } | null = null;
  /** where the player's car last stood on dry ground */
  private dry: [number, number] = [0, 0];
  private noSmoke = false;
  /** off in tests that only step the game */
  render = true;
  /**
   * Draw at a lower resolution when frames come slowly, and at full again when there is room. Off
   * when a script drives the page: filming steps the game at its own pace, which says nothing
   * about the device.
   */
  adaptive = !navigator.webdriver;
  private fullRatio = 1;
  private ratio = 1;
  private readonly pace = { t: 0, n: 0, hold: 0, calm: 0, wait: 9, sinceRaise: 1e9, before: 0, useless: 0 };
  onToast: (text: string, kind?: 'good' | 'bad' | 'info') => void = () => undefined;
  onFlash: (text: string) => void = () => undefined;
  onRide: (text: string) => void = () => undefined;
  onSquare: (state: 'loading' | 'ready') => void = () => undefined;
  onSave: () => void = () => undefined;
  /**
   * Openings for add-ons (see `src/addon.ts`). `actions`: asked in turn when the in/out key or
   * button is pressed; the first to return true has used the press. `hints`: asked in turn for the
   * line beside that key; the first to give one is shown.
   */
  readonly actions: Array<() => boolean> = [];
  readonly hints: Array<() => string | null> = [];
  /** asked every step of the game, with the seconds it covers */
  readonly ticks: Array<(dt: number) => void> = [];
  /** while true the game stands still (an add-on has a menu open); the picture is still drawn */
  held = false;
  /** A spot an add-on sends the player to (a mission's): the arrow points there, unless a package is on board. */
  guide: { x: number; y: number } | null = null;
  /**
   * A mission's drop-off, such as the player's own building. While it is set, the packages at the
   * stations flash green in open play, and whichever is taken goes there, with the line for its kind.
   * `kinds`: only the packages of these stations (a dispute's part comes from a fire station); `clock`:
   * the clock is this much longer; `light`: a supply run's load slows the car this share of a heavy one's.
   */
  special: { at: LngLat; say: Record<JobKind, string>; kinds?: JobKind[]; clock?: number; light?: number } | null = null;
  /**
   * The spot on the street at the mission's place (`for`) where its packages are put down, as last found:
   * kept as a place on the earth, so a package can still be taken for it once the next square has left the
   * building behind. A square is 1.5 km across and the next one loads 450 m from its middle: without this,
   * a station across that line handed out an ordinary job though its ring had just flashed green.
   */
  private door: { for: LngLat; at: LngLat } | null = null;
  /** A package for `special` has been picked up (its kind). */
  onSpecialTaken: (kind: JobKind) => void = () => undefined;
  /** A package for `special` has been delivered; `dented`: the car took harm on the way. */
  onSpecialDone: (dented: boolean) => void = () => undefined;
  /**
   * A package for `special` did not get there: too late, the police caught the player or they were knocked
   * out, a clean run was broken, or it was put down (a new run, or another place loaded).
   */
  onSpecialLost: (why: 'late' | 'caught' | 'offence' | 'dropped') => void = () => undefined;
  /** Something that makes a noise has happened; `strength` from 0 to 1 where it varies. */
  onSound: (what: Sfx, strength?: number) => void = () => undefined;
  /** The last delivery of a run is in: what it scored and how long it took (s). */
  onRunEnd: (score: number, seconds: number) => void = () => undefined;
  /** The party run being played, if any. */
  party: PartyRun | null = null;
  /** The car being looked for (`FindRun`): while it is on, no other jobs and no run. */
  find: FindRun | null = null;
  /** What happened with the car looked for; `metres`: for 'done', how far it was driven back. */
  onFind: (e: FindEvent, metres: number) => void = () => undefined;
  private findStage: 'search' | 'seen' | 'back' = 'search';
  private findCar: Car | null = null;
  /** seconds of searching since the circle last closed in */
  private findT = 0;
  /** the ring around the car once seen, and the one it goes back to */
  private findRing: Marker | null = null;
  private findDrop: Marker | null = null;
  /** "stop at the ring" has been said */
  private findSlow = false;
  /** where the car was when it was taken, on the earth: how far it was driven back */
  private findFrom: LngLat | null = null;
  /**
   * A party run is over: the food got to the door (and how long it took from the pickup, s), it got cold
   * (the clock ran out), or it was lost (the player was caught or knocked out with it on board).
   */
  onPartyEnd: (end: 'done' | 'cold' | 'lost', seconds: number) => void = () => undefined;
  /**
   * A station's job is offered on a card before it is taken (the owner, 23 November): `special` is the
   * line of a mission's package, when it goes to one. Without it, a package is taken by driving onto it.
   */
  onOffer: ((kind: JobKind, special: string | null, answer: (yes: boolean) => void) => void) | null = null;
  /** the stations' packages the player said no to, each until they drive off */
  private declined = new Set<Marker>();
  /** the station spot where moving a package there found no way, so it is not tried again while there */
  private triedAt: string | null = null;
  /** the stations' rings are green this moment: a home waits for one of their packages */
  private flash = false;
  /** "slow down at the ring" has been said */
  private slowSaid = false;
  /** the player has got going since the start: no job's card at the very start, standing where the game put them */
  private moved = false;
  /** Listeners to what happens in play: deliveries, fines, the police shaken off, runs finished. */
  readonly events: Array<(e: GameEvent) => void> = [];
  private emit(e: GameEvent): void {
    for (const f of this.events) f(e);
  }
  /** the run in which the last fine came */
  private finedIn: unknown = null;
  /** The run being scored: deliveries done, what they earned less fines, and the time played. */
  run = { done: 0, score: 0, seconds: 0, over: false, of: RUN_JOBS };
  /** Where the run being scored has led so far, so that someone else can be sent the same run. */
  course: Course = { start: { lon: 0, lat: 0 }, legs: [] };
  /** A run someone sent: its packages and drop-offs are used instead of new ones. */
  private set: Course | null = null;
  /** where the package on board was picked up */
  private from: LngLat | null = null;
  /** where the last job was taken, so that the next comes from somewhere else */
  private lastFrom: LngLat | null = null;
  private offerT = 0;

  /** No run: the open jobs from the start, as many as one likes. */
  openPlay(): void {
    this.party = null;
    this.comeDown();
    this.declined.clear();
    this.slowSaid = false;
    this.moved = false;
    this.run = { done: 0, score: 0, seconds: 0, over: true, of: RUN_JOBS };
    this.set = null;
    this.from = null;
    this.lastFrom = null;
    this.offerT = 0;
    if (this.job) this.endJob(false, 'dropped');
    for (const m of this.pickups.splice(0)) this.scene.remove(m.mesh);
    this.stopFind('dropped');
  }

  /** Start counting a new run of deliveries; with a course, the run goes to its places. */
  newRun(course: Course | null = null): void {
    this.party = null;
    this.comeDown();
    this.declined.clear();
    this.slowSaid = false;
    this.moved = false;
    this.lastFrom = null;
    this.set = course && course.legs.length >= 1 && course.legs.length <= RUN_STEPS.length ? course : null;
    this.run = { done: 0, score: 0, seconds: 0, over: false, of: this.set?.legs.length ?? RUN_JOBS };
    const [x, y] = this.pos();
    this.course = { start: this.set?.start ?? this.world.proj.toLngLat(x, y), legs: [] };
    this.from = null;
    if (this.job) this.endJob(false, 'dropped');
    for (const m of this.pickups.splice(0)) this.scene.remove(m.mesh);
    this.stopFind('dropped');
  }

  /** A party run from here: no run and no other jobs, only the food from its place to the door. */
  startParty(p: PartyRun): void {
    this.openPlay();
    this.party = p;
  }

  /** The party is called off: its food and its drop-off go, and the open jobs come back. */
  endParty(): void {
    if (!this.party) return;
    this.party = null;
    if (this.job?.party) this.endJob(false);
    for (const m of this.pickups.splice(0)) this.scene.remove(m.mesh);
  }

  constructor(readonly canvas: HTMLCanvasElement, private readonly small: boolean) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.fullRatio = this.ratio = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    // for tracking down a fault in the picture on one device: `?try=noshadow`, `hard`, `nosmoke`
    // or `fullres` in the link (several with commas) each turn one thing off
    const tries = (new URLSearchParams(location.search).get('try') ?? '').split(',');
    this.noSmoke = tries.includes('nosmoke');
    if (tries.includes('fullres')) this.adaptive = false;
    this.renderer.shadowMap.enabled = !tries.includes('noshadow');
    this.renderer.shadowMap.type = tries.includes('hard') ? BasicShadowMap : PCFShadowMap;
    this.scene.background = new Color('#d8d2c2');
    drawnOverGround(this.routeLine.material);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 2;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.25;
    this.scene.add(new HemisphereLight('#ffffff', '#c9c0b0', 1.3), this.sun, this.sun.target, this.me.mesh, this.routeLine, this.mineRing, this.ghost);
    this.ghost.renderOrder = 20;
    this.ghost.visible = false;
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

  /**
   * Keep the game smooth on a device that can't draw every pixel in time. Called once per frame
   * with the real time since the last one. Below 48 frames a second the picture gets coarser a
   * step at a time; when frames come easily for a while it gets finer again, and each raise
   * that doesn't hold doubles the wait before the next. If coarser pictures don't come any
   * faster, resolution isn't what is slow here (a screen held at 30 a second, say) and it goes
   * back to full for good.
   */
  tune(dt: number): void {
    const p = this.pace;
    if (!this.adaptive || !this.render || p.useless >= 2 || dt <= 0) return;
    // a pause, another tab or the next square arriving says nothing about the device
    if (dt > 0.25 || this.loading) {
      p.t = p.n = 0;
      return;
    }
    p.sinceRaise += dt;
    if (p.hold > 0) {
      p.hold -= dt;
      return;
    }
    p.t += dt;
    p.n++;
    if (p.t < 1.5) return;
    const fps = p.n / p.t;
    p.t = p.n = 0;
    const floor = Math.max(0.75, this.fullRatio * 0.5);
    if (p.before) {
      // the step down just taken: did it help?
      if (fps < p.before * 1.08) p.useless++;
      else p.useless = 0;
      p.before = 0;
      if (p.useless >= 2) {
        this.setRatio(this.fullRatio);
        return;
      }
    }
    if (fps < 48 && this.ratio > floor + 1e-3) {
      if (p.sinceRaise < 8) p.wait = Math.min(240, p.wait * 2);
      p.before = fps;
      p.calm = 0;
      this.setRatio(Math.max(floor, this.ratio * 0.85));
    } else if (fps >= 57 && this.ratio < this.fullRatio - 1e-3) {
      p.calm += 1.5;
      if (p.calm >= p.wait) {
        p.calm = 0;
        p.sinceRaise = 0;
        this.setRatio(Math.min(this.fullRatio, this.ratio / 0.85));
      }
    } else p.calm = 0;
  }

  private setRatio(r: number): void {
    this.ratio = r;
    this.renderer.setPixelRatio(r);
    this.pace.hold = 0.5;
  }

  /** What is being drawn, for the frame-rate readout. */
  drawn(): { width: number; height: number; ratio: number; fullRatio: number; triangles: number; calls: number } {
    const { triangles, calls } = this.renderer.info.render;
    return { width: this.canvas.width, height: this.canvas.height, ratio: this.ratio, fullRatio: this.fullRatio, triangles, calls };
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
    this.loadVersion++;
    this.loading = false;
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
    this.me.vx = this.me.vy = 0;
    this.car = null;
    this.sinking = null;
    this.heat = 0;
    this.cam = { x: px, y: py, h: ARRIVE_M };
    this.descent = ARRIVE_HOLD_S + DESCENT_S;
    this.descentFrom = 0;
    this.rising = false;
    this.parkCars(null);
    // the look from above draws far more than play does: it says nothing about how the device copes
    this.pace.hold = ARRIVE_HOLD_S + DESCENT_S + 1.5;
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
    this.party = null;
    this.stopFind('dropped');
    this.routeLine.visible = false;
    this.routePts = null;
    this.routeT = 0;
    this.mine = null;
    this.blowT = 0;
    this.blown = null;
    this.frozen = 0;
    this.caughtT = 0;
    this.copT = 0;
    this.spawnT = 0;
    this.noWay = 0;
    this.retryAt = 0;
    this.offenceAt = 0;
    this.dry = [0, 0];
    for (const s of this.smoke) {
      s.life = 0;
      s.mesh.visible = false;
    }
  }

  /** The next square is ready: move everything near you over to it. */
  private swap(next: World): void {
    // a home that waits for a package stays within reach across the edge of its square
    this.keepDoor();
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
    const moveShore = ([x, y]: [number, number]): [number, number] => {
      const ll = old.proj.toLngLat(x, y);
      return next.proj.toLocal(ll.lon, ll.lat);
    };
    this.dry = moveShore(this.dry);
    if (this.sinking) this.sinking.shore = moveShore(this.sinking.shore);
    // puffs in the air belong to the old square: put them away, or they hang where they were
    for (const s of this.smoke) {
      s.life = 0;
      s.mesh.visible = false;
    }
    this.scene.remove(old.model.group);
    this.scene.add(next.model.group);
    this.world = next;
    old.dispose();
    for (const c of this.cars) {
      c.lastStop = -1;
      c.rail = null;
      if (c.path) c.path = this.attach(c.x, c.y, c.th, railsOf(c.kind) ?? 'drive');
      c.ahead = c.path ? [c.path.line] : [];
    }
    for (const p of this.people) p.path = this.attach(p.x, p.y, p.th, 'walk');
    this.parkCars(this.pos());
    this.routeT = 0;
    this.routePts = null;
    // the new square's first frames are slow for reasons of their own
    this.pace.hold = 2;
  }

  private maybeLoadNext(): void {
    if (this.loading || this.clock < this.retryAt) return;
    const [x, y] = this.pos();
    const next = this.world.needsRecentre(x, y);
    if (!next) return;
    this.loading = true;
    const version = this.loadVersion;
    this.onSquare('loading');
    World.load(next, this.texturePx)
      .then((w) => {
        if (version !== this.loadVersion) {
          w.dispose();
          return;
        }
        this.swap(w);
        this.onSquare('ready');
      })
      .catch((err) => {
        if (version !== this.loadVersion) return;
        console.warn('next square failed', err);
        this.retryAt = this.clock + 6;
        this.onSquare('ready');
      })
      .finally(() => {
        if (version === this.loadVersion) this.loading = false;
      });
  }

  /**
   * The place on the network nearest to a point, facing the way `th` points, one-way or not (a car put
   * on a one-way street the wrong way leaves at the next street: `drive`).
   */
  private attach(x: number, y: number, th: number, want: 'drive' | 'walk' | 'tram' | 'train'): PathState | null {
    // a tram or train: its own track, the way it faces, and none too short to run on
    const n = want === 'tram' || want === 'train' ? this.world.roads.nearestAlong(x, y, 60, want, Math.cos(th), Math.sin(th)) : this.world.roads.nearest(x, y, 60, want);
    if (!n) return null;
    const p: PathState = { line: n.line, s: n.s, dir: 1 };
    const [hx, hy] = this.world.roads.heading(p);
    if (hx * Math.cos(th) + hy * Math.sin(th) < 0) p.dir = -1;
    return p;
  }

  // ------------------------------------------------------------------ cars

  /**
   * For add-ons: stand a car in the world, with nobody in it. `make` gives it a colour, a top
   * speed (m/s), a pull (m/s²) and how much of a knock becomes damage.
   */
  place(kind: 'sedan' | 'sport' | 'van', x: number, y: number, th: number, make: { colour?: string; top?: number; acc?: number; dent?: number } = {}): Car {
    const c = new Car(kind, make.colour, make.top || make.acc ? { ...(make.top ? { top: make.top } : {}), ...(make.acc ? { acc: make.acc } : {}) } : undefined);
    if (make.dent) c.dent = make.dent;
    c.x = x;
    c.y = y;
    c.th = th;
    this.cars.push(c);
    this.scene.add(c.mesh);
    return c;
  }

  /** For add-ons: take a car out of the world. If you sit in it, you stand where it stood. */
  remove(c: Car): void {
    if (this.car === c) {
      this.me.x = c.x;
      this.me.y = c.y;
      this.me.vx = 0;
      this.me.vy = 0;
      this.car = null;
    }
    c.driver = 'none';
    this.dropCar(c);
  }

  /** For add-ons: sit in a car that stands in the world. */
  seat(c: Car): void {
    if (this.car && this.car !== c) this.car.driver = 'none';
    c.driver = 'player';
    this.car = c;
  }

  /** For add-ons: a ring on the ground of the loaded square, like the ring of a package. It goes when the square goes. */
  ring(colour: string, x: number, y: number): { remove: () => void } {
    const group = this.world.model.group;
    const mesh = markerMesh(colour);
    mesh.position.set(x, this.world.groundY(x, y) + riseUnder((gx, gy) => this.world.groundY(gx, gy), x, y, 5), -y);
    group.add(mesh);
    return { remove: () => void group.remove(mesh) };
  }

  private addCar(kind: CarKind, x: number, y: number, th: number, colour?: string): Car {
    const c = colour ? new Car(kind, colour) : new Car(kind);
    c.x = x;
    c.y = y;
    c.th = th;
    this.cars.push(c);
    this.scene.add(c.mesh);
    return c;
  }

  /** Fording a stream: the water holds the car back and sprays. */
  private ford(c: Car, dt: number): void {
    if (c.speed > 4) {
      const k = Math.exp(-3.2 * dt);
      c.vx *= k;
      c.vy *= k;
    }
    this.sprayT -= dt;
    if (this.sprayT <= 0) {
      this.sprayT = 0.07;
      this.cloud(c.x + (Math.random() - 0.5) * 2, c.y + (Math.random() - 0.5) * 2, 0.5, '#bfe0f2');
    }
  }

  /** The player's car going down. After a moment it is gone, and the player stands where it left the shore. */
  private sink(dt: number): void {
    const s = this.sinking!;
    const c = s.car;
    s.t += dt;
    const k = Math.exp(-2.5 * dt);
    c.vx *= k;
    c.vy *= k;
    c.sink = Math.min(2.6, s.t * s.t * 1.8);
    this.sprayT -= dt;
    if (s.t < 0.8 && this.sprayT <= 0) {
      this.sprayT = 0.05;
      this.cloud(c.x + (Math.random() - 0.5) * 4, c.y + (Math.random() - 0.5) * 4, 0.4 + Math.random(), pickOne(['#bfe0f2', '#e6f3fa', '#9ccbe6']));
    }
    if (s.t < 1.3 && this.car === c) return;
    this.sinking = null;
    c.sink = 0;
    if (this.car === c) {
      c.driver = 'none';
      c.controls.throttle = 0;
      this.car = null;
      // out a step further on dry ground, away from the water
      const [sx, sy] = s.shore;
      const dx = sx - c.x;
      const dy = sy - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const out: [number, number] = [sx + (dx / d) * 1.5, sy + (dy / d) * 1.5];
      const [x, y] = this.world.inWater(out[0], out[1]) ? [sx, sy] : out;
      this.me.x = x;
      this.me.y = y;
      this.me.vx = 0;
      this.me.vy = 0;
      this.frozen = 0.5;
      this.onToast('The car sank. You swam back to the shore', 'bad');
    }
    this.dropCar(c);
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
    const p = w.roads.randomPlace(railsOf(kind) ?? 'traffic', px, py, minD, maxD);
    if (!p) return null;
    const line = w.roads.lines[p.line];
    // on a one-way street, the way it goes
    if (line.oneway) p.dir = line.oneway;
    // buses keep to the bigger streets
    if (kind === 'bus' && (line.kind === 'minor' || line.kind === 'motorway')) return null;
    const [x, y] = w.roads.lanePoint(p, this.lane(p, kind));
    if (this.carNear(x, y, kind === 'bus' || railsOf(kind) ? 30 : 12) || !w.free(x, y, 1.2)) return null;
    const [hx, hy] = w.roads.heading(p);
    const c = this.addCar(kind, x, y, Math.atan2(hy, hx));
    c.driver = kind === 'police' ? 'cop' : 'ai';
    c.path = p;
    const v = kind === 'train' ? 14 : kind === 'tram' || kind === 'bus' ? 6 : SPEED_LIMIT[line.kind] * 0.7;
    c.vx = hx * v;
    c.vy = hy * v;
    return c;
  }

  /** How far to the side of a line a vehicle keeps: its lane, on the side this country drives on. */
  private lane(p: PathState, kind: CarKind): number {
    if (railsOf(kind)) return 0;
    return laneOffset(this.world.roads.lines[p.line], p.dir) * (this.world.leftHand ? -1 : 1);
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
    const want = railsOf(c.kind) ?? 'drive';
    const transit = want !== 'drive' || c.kind === 'bus';
    if (chase && toMe < 110 && !w.solids.blocked(c.x, c.y, px, py)) {
      // in sight: straight at where you'll be
      const [vx, vy] = this.vel();
      const lead = Math.min(1, toMe / 30);
      tx = px + vx * lead;
      ty = py + vy * lead;
      limit = toMe < 14 ? 12 + this.speed() : 33;
      c.path = this.attach(c.x, c.y, c.th, 'drive') ?? c.path;
    } else {
      if (!c.path) {
        c.path = this.attach(c.x, c.y, c.th, want);
        c.ahead = c.path ? [c.path.line] : [];
      }
      if (!c.path) {
        // a tram or train with no track it can run on (a new square left it on a bit too short): out of
        // sight it goes; in sight it stands till it is
        if (want !== 'drive' && toMe > this.viewR) {
          this.dropCar(c);
          return;
        }
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
            if (want !== 'drive') {
              // trams and trains mostly carry straight on
              if (from && Math.random() > 0.08) return null;
              // by the look ahead's own direction there, which on a bend is not the body's
              const [lx, ly] = net.heading(p);
              const dot = (o: PathState) => net.heading(o)[0] * lx + net.heading(o)[1] * ly;
              const best = options.reduce((a, b) => (dot(b) > dot(a) ? b : a));
              // points lead off at a slant; where two lines only cross, there is no turning (45° at most);
              // at the end of a line, on unless the only way on leads back
              return dot(best) > (from ? 0.7 : RAIL_ON) ? best : null;
            }
            const ahead = options.filter((o) => {
              const [hx, hy] = net.heading(o);
              return hx * fx + hy * fy > -0.7;
            });
            const may = (o: PathState) => mayGo(net.lines[o.line], o.dir);
            // going against a one-way street (turned at a dead end the map left): off it at the first street
            // ahead, never into a driveway or car park, nor by turning round on the spot
            if (from && !may(from)) {
              const out = ahead.filter((o) => may(o) && net.lines[o.line].traffic);
              if (out.length) return pickOne(out);
            }
            // buses mostly carry straight on; cars turn off more often
            if (from && Math.random() > (transit ? 0.08 : 0.25)) return null;
            // never into a one-way street the wrong way, while there is another way on, a sharp turn
            // included; where the map leaves none (a one-way street that ends at the edge of the
            // square, say), on as before
            const legal = ahead.filter(may);
            const real = legal.filter((o) => net.lines[o.line].traffic);
            const anyLegal = options.filter(may);
            const pool = real.length ? real : from ? [] : legal.length ? legal : anyLegal.length ? anyLegal : ahead.length ? ahead : options;
            return pool.length ? pickOne(pool) : null;
          };
      // a tram or train aims beyond its own front, which is half its length ahead
      const look = (want === 'drive' ? 0 : c.spec.len * 0.5) + 7 + Math.abs(vf) * 0.55;
      [tx, ty] = net.lanePoint(p, this.lane(p, c.kind));
      for (let k = 0; k < 30 && Math.hypot(tx - c.x, ty - c.y) < look; k++) {
        net.advance(p, 2, want, pick);
        [tx, ty] = net.lanePoint(p, this.lane(p, c.kind));
        // a tram's front takes the branches its look ahead took
        if (want !== 'drive' && c.ahead[c.ahead.length - 1] !== p.line) {
          c.ahead.push(p.line);
          // track split into many short pieces: enough lines for all of the look ahead and more
          if (c.ahead.length > 32) c.ahead.shift();
        }
      }
      // turned round against a one-way street where the map leaves no way on: out of sight, the car goes
      // (cars that drive off go too); in sight, it turns as before
      if (want === 'drive' && c.driver === 'ai' && !mayGo(net.lines[p.line], p.dir) && toMe > this.viewR) {
        this.dropCar(c);
        return;
      }
      // at the end of a track a tram or train stops, waits a moment and sets off the other way
      if (want !== 'drive' && (tx - c.x) * fx + (ty - c.y) * fy < -2) {
        c.th = wrap(c.th + Math.PI);
        c.vx = 0;
        c.vy = 0;
        c.dwell = 2.5;
        c.ahead = [p.line];
      }
      const base = SPEED_LIMIT[net.lines[p.line].kind] ?? 8;
      limit = chase ? Math.min(31, base * 2.3) : c.kind === 'train' ? 19 : transit ? Math.min(base, 11) : base;
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

  /**
   * A tram or train on its rails: the front bogie runs along the track, taking the branch the driver is
   * headed for; the back bogie follows where the front has been; the body lies between the two. Steered
   * like a car, a 19 m tram aimed at a point inside its own length and stood across the rails on bends
   * and after points: in Dresden one tram in ten was 15° or more off its rails, at worst 70° (24 November).
   * Speed and braking stay the car's own, and a knock slows it, but nothing pushes it off its rails: the
   * car that hits it takes all of the push (`collideCars`).
   */
  private onRails(c: Car, dt: number): void {
    const net = this.world.roads;
    const want = c.kind as 'tram' | 'train';
    const bogie = c.spec.len * 0.35;
    const fx = Math.cos(c.th);
    const fy = Math.sin(c.th);
    const vf = c.vx * fx + c.vy * fy;
    let r = c.rail;
    if (r) {
      // turned round at the end of the track, carried into the next square, or knocked off: on again
      const [ex, ey] = r.trail[r.trail.length - 1];
      if (r.world !== this.world || (ex - c.x) * fx + (ey - c.y) * fy < 0 || Math.hypot(ex - c.x, ey - c.y) > bogie + 6) r = null;
    }
    if (!r) {
      const n = net.nearestAlong(c.x, c.y, 8, want, fx, fy);
      if (!n) {
        // no rails of its own near (knocked far off them, or a new square): out of sight it goes rather than
        // jump to others; in sight it is let go
        const [px, py] = this.pos();
        if (Math.hypot(c.x - px, c.y - py) > this.viewR) this.dropCar(c);
        c.rail = null;
        return;
      }
      const [hx, hy] = net.heading({ line: n.line, s: n.s, dir: 1 });
      const mid: PathState = { line: n.line, s: n.s, dir: hx * fx + hy * fy >= 0 ? 1 : -1 };
      // the front on the branch its driver's look ahead took, if it is just before points
      const front = this.alongRails(mid, bogie, want, c.path ? net.point(c.path.line, c.path.s) : null, c.ahead);
      // where the front has been: the rails behind it, a metre at a time, past where the back bogie is
      let q: PathState = { ...front, dir: front.dir > 0 ? -1 : 1 };
      const trail: Array<[number, number]> = [];
      for (let k = 0; k < bogie * 3 + 2; k++) {
        trail.unshift(net.point(q.line, q.s));
        q = this.alongRails(q, 1, want, null);
      }
      r = { p: front, world: this.world, trail };
    }
    c.rail = r;
    // the front on by as far as the car went, along the lines the driver's look ahead took from the front
    // on (a line it took on an earlier lap is not a turn to take now)
    const at = c.ahead.lastIndexOf(r.p.line);
    if (at > 0) c.ahead.splice(0, at);
    const target = c.path ? net.point(c.path.line, c.path.s) : null;
    if (vf > 0) r.p = this.alongRails(r.p, vf * dt, want, target, c.ahead);
    const front = net.point(r.p.line, r.p.s);
    const last = r.trail[r.trail.length - 1];
    if (Math.hypot(front[0] - last[0], front[1] - last[1]) > 0.3) r.trail.push(front);
    // the back bogie: on the trail, twice the bogie's reach behind the front
    let left = bogie * 2;
    // (put on near the end of its track the trail is short, and the back bogie stays at its start: the body
    // stays on the rails all the same; left to the steering, it drifted off them and lost them)
    let back: [number, number] = r.trail[0];
    for (let i = r.trail.length - 1; i > 0; i--) {
      const [ax, ay] = r.trail[i];
      const [bx, by] = r.trail[i - 1];
      const seg = Math.hypot(ax - bx, ay - by);
      if (seg >= left) {
        back = [ax + ((bx - ax) * left) / seg, ay + ((by - ay) * left) / seg];
        // what is further back is not needed again
        if (i > 2) r.trail.splice(0, i - 2);
        break;
      }
      left -= seg;
    }
    const th = Math.atan2(front[1] - back[1], front[0] - back[0]);
    if (Math.hypot(front[0] - back[0], front[1] - back[1]) < 1) return;
    c.th = th;
    c.x = (front[0] + back[0]) / 2;
    c.y = (front[1] + back[1]) / 2;
    const v = Math.max(0, vf);
    c.vx = Math.cos(th) * v;
    c.vy = Math.sin(th) * v;
  }

  /**
   * A place on the rails `d` metres on from `from`. At points it takes a line of `follow` (the lines the
   * driver's look ahead went along) where one leads off, else carries on; with no `follow`, the way that
   * leads most towards `toward`, or the straightest. At the end of the track, or where the only way on
   * leads back, it stops there.
   */
  private alongRails(from: PathState, d: number, want: 'tram' | 'train', toward: Pt | null, follow: number[] = []): PathState {
    const net = this.world.roads;
    const p = { ...from };
    let left = d;
    for (let k = 0; k < 400 && left > 1e-3; k++) {
      const [x0, y0] = net.point(p.line, p.s);
      const [hx, hy] = net.heading(p);
      const line0 = p.line;
      const dir0 = p.dir;
      const score = (o: PathState): number => {
        const [ox, oy] = net.heading(o);
        if (!toward) return ox * hx + oy * hy;
        const dx = toward[0] - x0;
        const dy = toward[1] - y0;
        return (ox * dx + oy * dy) / (Math.hypot(dx, dy) || 1);
      };
      net.advance(p, Math.min(1, left), want, (options, at) => {
        // a followed line, where a tram can take it: at a slant at points, forwards at the end of a line
        const onward = (o: PathState) => net.heading(o)[0] * hx + net.heading(o)[1] * hy > (at ? 0.7 : RAIL_ON);
        const known = options.filter((o) => follow.includes(o.line) && o.line !== p.line && onward(o));
        if (known.length) return known.reduce((a, b) => (score(b) > score(a) ? b : a));
        // points: carry on, unless there is no look ahead to follow and a way a tram can take leads better
        if (at) {
          const can = options.filter(onward);
          if (follow.length || !can.length) return null;
          const best = can.reduce((a, b) => (score(b) > score(a) ? b : a));
          return score(best) > score(at) ? best : null;
        }
        // the end of a line: the best of the ways a tram can go on along
        const can = options.filter(onward);
        return can.length ? can.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
      });
      if (p.line === line0 && p.dir !== dir0) {
        p.dir = dir0;
        break;
      }
      const [x1, y1] = net.point(p.line, p.s);
      left -= Math.max(0.01, Math.hypot(x1 - x0, y1 - y0));
    }
    return p;
  }

  /**
   * Whether a vehicle on rails and one on the road pass each other at different heights, one on a
   * bridge over the other: then they neither meet nor wait for each other. The game has no heights for
   * them, and a train under North Bridge in Edinburgh carried a car stopped on it 273 m along the
   * tracks; every railway under a road bridge did the same. It is told where they meet (`at`, the road
   * vehicle by default) from the tracks and streets there (`RoadNet.crossesApart`); two on rails, or
   * two on the road, meet as before. Where a road bridge crosses a street with tram tracks in it, the
   * place alone can't tell the bridge from the street, and they meet as before; and whoever walks along
   * the tracks right under a bridge is taken to be on it.
   */
  private apart(p: Car, q: Car, at?: [number, number]): boolean {
    // a wreck of a train lies on its tracks too
    const rail = railsOf(p.kind) ? p : railsOf(q.kind) ? q : null;
    const road = rail === p ? q : p;
    if (!rail || railsOf(road.kind)) return false;
    const [x, y] = at ?? [road.x, road.y];
    return this.passesAt(x, y, 'drive');
  }

  /** `RoadNet.crossesApart` for a car (`drive`) or someone on foot (`walk`), by the metre, once a frame. */
  private passesAt(x: number, y: number, on: 'drive' | 'walk'): boolean {
    const key = `${on}${Math.round(x)},${Math.round(y)}`;
    let apart = this.bridged.get(key);
    if (apart === undefined) {
      apart = this.world.roads.crossesApart(x, y, on);
      this.bridged.set(key, apart);
    }
    return apart;
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
      // a train needs longer to stop, and the one coming the other way is closing too
      const look = c.kind === 'train' ? 30 + Math.max(0, vf) * 4 : 9 + Math.max(0, vf) * 1.3;
      const gapTo = (ox: number, oy: number, r: number, wide: number) => {
        const dx = ox - c.x;
        const dy = oy - c.y;
        const ahead = dx * fx + dy * fy;
        if (ahead <= 0 || ahead > look + r || Math.abs(dx * fy - dy * fx) > wide) return;
        const gap = ahead - r - c.a - c.r;
        const cap = c.kind === 'train' ? Math.max(0, gap - 8) * 0.3 : Math.max(0, gap - 2.5) * 1.1;
        if (cap < want) {
          want = cap;
          blocked = cap < 1;
        }
      };
      // a train brakes for another train and for nothing else: keeping off the track is up to you
      const train = c.kind === 'train';
      // a tram, held on its rails and never giving way, also slows for a car close beside its track
      const wide = c.kind === 'tram' ? c.spec.wid / 2 + 1 : 1.5;
      for (const o of this.cars) {
        if (o === c || o.gone || (train && o.kind !== 'train') || Math.abs(o.x - c.x) >= 110 || Math.abs(o.y - c.y) >= 110) continue;
        // a car looking at a train ahead asks where its own way meets the train; a tram, where the car is
        const ahead = Math.max(0, (o.x - c.x) * fx + (o.y - c.y) * fy);
        if ((railsOf(c.kind) || railsOf(o.kind)) && this.apart(c, o, railsOf(o.kind) ? [c.x + fx * ahead, c.y + fy * ahead] : [o.x, o.y])) continue;
        gapTo(o.x, o.y, o.a + o.r, wide);
      }
      if (!train) {
        const apart = (o: { x: number; y: number }) => !!railsOf(c.kind) && Math.abs(o.x - c.x) < 60 && Math.abs(o.y - c.y) < 60 && this.passesAt(o.x, o.y, 'walk');
        for (const o of this.people) if (o.state !== 'down' && !apart(o)) gapTo(o.x, o.y, 0.4, 1.4);
        if (!this.car && c !== this.car && !apart(this.me)) gapTo(this.me.x, this.me.y, 0.4, 1.4);
      }
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
      // a train that can't get on (another one coming the other way, something it can't
      // shove aside) goes back the way it came; so does a tram that meets another head on, on one track
      const headOn = () =>
        this.cars.some((o) => {
          if (o === c || o.gone || !railsOf(o.kind) || Math.cos(o.th - c.th) > -0.5) return false;
          // ahead of it, on its own track (the line its front is on, or one its look ahead went along), not
          // one passing on the track beside it, on a bend too
          const line = o.rail?.p.line;
          if (line === undefined || !c.rail || (line !== c.rail.p.line && !c.ahead.includes(line))) return false;
          const ahead = (o.x - c.x) * Math.cos(c.th) + (o.y - c.y) * Math.sin(c.th);
          return ahead > 0 && ahead < (c.spec.len + o.spec.len) * 0.7;
        });
      // from where it stands, not from the point ahead it was steering for; only where there is track to go back on
      const turn = !!c.path && c.stuck > 2.5 && (c.kind === 'train' || (c.kind === 'tram' && headOn()));
      const back = turn ? this.attach(c.x, c.y, wrap(c.th + Math.PI), railsOf(c.kind) ?? 'train') : null;
      // a train turns round even where no track is found behind it, as it always did; a tram only onto track
      if (back || (turn && c.kind === 'train')) {
        c.th = wrap(c.th + Math.PI);
        if (back) c.path = back;
        c.ahead = c.path ? [c.path.line] : [];
        c.dwell = 1;
        c.stuck = 0;
        return;
      }
      if (blocked && c.stuck > 5) {
        c.pushy = 3;
        c.stuck = 0;
      } else if (!blocked && !railsOf(c.kind) && c.stuck > (chase ? 0.8 : 2.2)) {
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
      // a train or tram doesn't touch whoever is on a bridge over its track, or under its bridge
      const apart = (o: { x: number; y: number }) => !!railsOf(c.kind) && Math.abs(o.x - c.x) <= reach && Math.abs(o.y - c.y) <= reach && this.passesAt(o.x, o.y, 'walk');
      for (const p of this.people) {
        if (apart(p)) continue;
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
      if (!this.car && this.frozen <= 0 && !apart(this.me)) {
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

  speed(): number {
    const [vx, vy] = this.vel();
    return Math.hypot(vx, vy);
  }

  /** The car you could get into from where you stand. */
  private carInReach(): Car | null {
    let best: Car | null = null;
    let bd = Infinity;
    for (const c of this.cars) {
      // trams and trains stay on their rails: you can't take one
      if (c.gone || railsOf(c.kind)) continue;
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
    // an add-on may take the press for something of its own
    for (const take of this.actions) if (take()) return;
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
      const s = spots.find(([dx, dy]) => w.free(c.x + dx, c.y + dy, 0.4));
      if (!s) {
        this.onToast('No room to get out here', 'info');
        return;
      }
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
    if (!SUBWAY_RIDES) return -1;
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
    this.onSound('subway');
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
    if (this.job?.kind === 'clean') {
      this.onToast('That was a clean run: the job is gone', 'bad');
      this.onSound('late');
      this.endJob(false, 'offence');
    }
  }

  /**
   * Driving the wrong way down a one-way street costs nothing by itself; a police car that sees it
   * follows you. Seen means as near and as clear a view as keeps a chase going (`law`).
   */
  private wrongWay(cops: Car[]): void {
    const c = this.car;
    if (!c || this.heat > 0 || c.speed < 3) return;
    const w = this.world;
    const n = w.roads.nearest(c.x, c.y, 12, 'drive');
    if (!n) return;
    const l = w.roads.lines[n.line];
    if (!l.oneway || n.d > l.w / 2 + 1.5) return;
    // along the street, not across it: crossing a one-way street at a junction is no offence
    const [hx, hy] = w.roads.heading({ line: n.line, s: n.s, dir: l.oneway });
    if ((c.vx * hx + c.vy * hy) / c.speed > -0.7) return;
    if (!cops.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 75 && !w.solids.blocked(o.x, o.y, c.x, c.y))) return;
    this.offence(1, 'Wrong way down a one-way street: the police saw you');
  }

  private law(dt: number): void {
    const w = this.world;
    const [px, py] = this.pos();
    const cops = this.cars.filter((c) => c.driver === 'cop' && !c.gone);
    this.wrongWay(cops);
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
        this.emit({ kind: 'lost' });
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
    this.finedIn = this.run;
    this.emit({ kind: 'fined' });
    this.heat = 0;
    this.caughtT = 0;
    this.me.hp = 100;
    this.frozen = 1.6;
    this.onFlash(cost > 0 ? `${title}  −$${cost}` : title);
    this.onSound('fine');
    // a party's food on board is lost with it: the party says so, and offers to fetch it again
    const food = !!this.job?.party;
    if (this.job) this.endJob(false, 'caught');
    if (food) {
      this.party = null;
      this.onPartyEnd('lost', 0);
    }
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

  /**
   * A package to pick up at a place on a street, or null if no road leads there from where you
   * are: a street cut off from the rest (by the edge of the loaded square, a river, a gap in the
   * map) would be a ring you can see and never reach. If place after place fails, you yourself
   * stand on such a cut-off street, and a ring is laid anyway, so the game never runs dry.
   */
  private pickupAt(at: PathState, kind?: JobKind): Marker | null {
    // never where a car can't stand: a street the map has running into a building (North Bridge in
    // Edinburgh ran into the roof of the station below it); a step along it, where that is near. None
    // within 24 m either way is rare enough that another place, or another station, gives the package
    const p = this.standOn(at);
    if (!p) return null;
    const m = this.newMarker(RING[kind ?? 'plain'], p);
    if (kind) m.kind = kind;
    const [px, py] = this.pos();
    const f = this.fieldOf(m);
    if ((f && this.world.roads.route(f, px, py)) || this.noWay >= 40) {
      this.noWay = 0;
      return m;
    }
    this.noWay++;
    this.scene.remove(m.mesh);
    return null;
  }

  /** The place along its street nearest `p` where a ring can go (`ringAlong`), or null. */
  private standOn(p: PathState): PathState | null {
    const s = ringAlong(this.world.roads, (x, y, r) => this.world.free(x, y, r), p.line, p.s);
    return s === null ? null : { ...p, s };
  }

  private newMarker(colour: string, p: PathState): Marker {
    const [x, y] = this.world.roads.point(p.line, p.s);
    const mesh = markerMesh(colour);
    this.scene.add(mesh);
    return { at: this.world.proj.toLngLat(x, y), mesh, colour };
  }

  private markerAt(colour: string, at: LngLat): Marker {
    const mesh = markerMesh(colour);
    this.scene.add(mesh);
    return { at, mesh, colour };
  }

  private jobs(dt: number): void {
    const w = this.world;
    const [px, py] = this.pos();
    if (this.job) {
      const j = this.job;
      const [x, y] = this.local(j.to);
      j.metres = Math.hypot(x - px, y - py);
      j.left -= dt;

      if (j.metres < 6.5 && j.party) {
        // the food is at the door: no pay, and the time from the pickup is what counts
        const seconds = Math.max(0, (j.clock0 ?? 0) - j.left);
        this.endJob(true);
        this.party = null;
        this.onSound('run');
        this.onPartyEnd('done', seconds);
        this.onSave();
        return;
      }
      if (j.metres < 6.5) {
        // what comes on top: time left over, three times as much on a rush job; on a supply run a
        // fifth more for a car that took no harm
        let bonus = Math.round((j.left * (j.kind === 'rush' ? 6 : 2)) / 10) * 10;
        if (j.kind === 'supply' && this.car && this.car.hp >= j.hp0 - 1) bonus += Math.round((j.pay * 0.2) / 10) * 10;
        this.cash += j.pay + bonus;
        this.delivered++;
        // a new dent on the car the load came on board in; a load moved to another car counts as dented
        const harmed = !!j.car0 && j.car0.hp < j.hp0 - 1;
        const dented = harmed || (!!j.car0 && !!this.car && this.car !== j.car0);
        const r = this.run;
        if (!r.over) {
          r.done++;
          r.score += j.pay + bonus;
          if (this.from) this.course.legs.push({ from: this.from, to: j.to.at, kind: j.kind });
          this.onToast(`Delivery ${r.done} of ${r.of}  +$${j.pay + bonus}`, 'good');
        } else this.onToast(`Delivered  +$${j.pay + bonus}`, 'good');
        this.onSound(!r.over && r.done >= r.of ? 'run' : 'deliver');
        this.endJob(true);
        if (j.special) this.onSpecialDone(dented);
        this.emit({ kind: 'delivered', job: j.kind, left: j.left, special: !!j.special, dented: harmed });
        this.onSave();
        if (!r.over && r.done >= r.of) {
          r.over = true;
          this.emit({ kind: 'run', fined: this.finedIn === r });
          this.onRunEnd(r.score, r.seconds);
        }
      } else if (j.left <= 0) {
        this.onSound('late');
        this.endJob(false, 'late');
        if (j.party) {
          this.party = null;
          this.onPartyEnd('cold', 0);
        } else this.onToast('Too late: the job is gone', 'bad');
      }
      return;
    }
    if (!this.moved && this.speed() > 3) this.moved = true;
    // a car to find: nothing else
    if (this.find) {
      this.findTick(dt);
      return;
    }
    // a party: one ring, at its food place, and nothing else
    if (this.party) {
      if (!this.pickups.length) this.pickups.push(this.markerAt(RING.party, this.party.pick));
      const m = this.pickups[0];
      const [x, y] = this.local(m);
      if (Math.hypot(x - px, y - py) < 6.5) this.takeParty(m);
      return;
    }
    // in a run someone sent there is one package at a time, where theirs was
    const sent = this.run.over ? null : this.set?.legs[this.run.done] ?? null;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const m = this.pickups[i];
      const [x, y] = this.local(m);
      const d = Math.hypot(x - px, y - py);
      // a station's job (the open jobs): a card first, once the player has stopped at the ring
      if (this.asks(m)) {
        if (!this.moved) continue;
        const atIt = d < OFFER_M || (d < 160 && this.atStationOf(m));
        if (this.declined.has(m)) {
          // asked once: again only after driving off, away from the ring and from the station
          if (d > 40 && !atIt) this.declined.delete(m);
        } else if (atIt && this.speed() < OFFER_SPEED && !this.held) {
          this.offerJob(m);
          return;
        } else if (d < 6.5 && !this.slowSaid) {
          this.slowSaid = true;
          this.onToast('Stop at the ring to see the job', 'info');
        }
      } else if (d < 6.5) {
        if (this.take(m)) return;
        continue;
      }
      if (d > 1100 && !sent) {
        this.scene.remove(m.mesh);
        this.pickups.splice(i, 1);
      }
    }
    if (sent) {
      // a run's package is taken by driving through it, whatever kind of job it was for the sender: turquoise
      if (!this.pickups.length) this.pickups.push(this.markerAt(RING.plain, sent.from));
      return;
    }
    // a run is three plain packages from street corners near you, the same game for everyone, so
    // that runs compare
    if (!this.run.over) {
      if (this.pickups.length < 3) {
        const p = w.roads.randomPlace('traffic', px, py, 90, 520);
        if (p) {
          const [x, y] = w.roads.point(p.line, p.s);
          if (!this.pickups.some((m) => Math.hypot(this.local(m)[0] - x, this.local(m)[1] - y) < 150)) {
            const m = this.pickupAt(p);
            if (m) this.pickups.push(m);
          }
        }
      }
      return;
    }
    // after it, the open jobs: a package waits at the nearest fuel, fire and police station, one of
    // each kind, as often as you go there
    this.offerT -= dt;
    if (this.offerT > 0) return;
    this.offerT = 0.6;
    const last = this.lastFrom ? this.local({ at: this.lastFrom } as Marker) : null;
    for (const kind of ['fuel', 'fire', 'police'] as const) {
      const job = JOB_OF[kind];
      // driven to a station of this kind: its package waits right there, wherever it waited before.
      // Players drove to the symbol they saw and found no package there (23 November).
      const at = this.speed() < OFFER_SPEED ? this.stationHere(kind) : null;
      const atLast = at && last && ((([ax, ay]) => Math.hypot(ax - last[0], ay - last[1]) < 30)(w.roads.point(at.line, at.s)));
      const spot = at && `${at.line}:${Math.round(at.s)}`;
      if (at && !atLast && spot !== this.triedAt) {
        const [ax, ay] = w.roads.point(at.line, at.s);
        const i = this.pickups.findIndex((m) => m.kind === job);
        const there = i >= 0 && Math.hypot(this.local(this.pickups[i])[0] - ax, this.local(this.pickups[i])[1] - ay) < 30;
        if (there) continue;
        const m = this.pickupAt(at, job);
        if (m) {
          if (i >= 0) this.scene.remove(this.pickups.splice(i, 1)[0].mesh);
          this.pickups.push(m);
          continue;
        }
        // no way from this station: its package stays where it was, and this spot is not tried again while here
        this.triedAt = spot;
      } else if (!at) this.triedAt = null;
      if (this.pickups.some((m) => m.kind === job)) continue;
      // the nearest station of the kind that a road leads to
      const near: Array<{ d: number; p: PathState }> = [];
      for (const s of w.services) {
        if (s.kind !== kind) continue;
        const n = w.roads.nearest(s.x, s.y, 150, 'traffic');
        if (!n) continue;
        const [x, y] = w.roads.point(n.line, n.s);
        const d = Math.hypot(x - px, y - py);
        // not the one a job was just taken from, and not one you are standing on
        if (d < 40 || d >= 1000 || (last && Math.hypot(x - last[0], y - last[1]) < 30)) continue;
        near.push({ d, p: { line: n.line, s: n.s, dir: 1 } });
      }
      near.sort((a, b) => a.d - b.d);
      let m: Marker | null = null;
      for (const c of near.slice(0, 4)) if ((m = this.pickupAt(c.p, job))) break;
      if (m) this.pickups.push(m);
    }
    // no station in reach at all: a package from a street corner, as it always was
    if (!this.pickups.length) {
      const p = w.roads.randomPlace('traffic', px, py, 90, 520);
      const m = p && this.pickupAt(p);
      if (m) this.pickups.push(m);
    }
  }

  /** The party's food on board: to the door, on its clock. */
  private takeParty(m: Marker): void {
    const p = this.party!;
    const w = this.world;
    const [px, py] = this.pos();
    const to = this.markerAt(DROP, p.door);
    const f = this.fieldOf(to);
    const [tx, ty] = this.local(to);
    const inside = Math.abs(tx) < w.half - 10 && Math.abs(ty) < w.half - 10;
    const r = inside && f ? w.roads.route(f, px, py) : null;
    const metres = r ? r.metres : Math.hypot(tx - px, ty - py) * 1.35;
    const clock = partyClock(metres, p.walk ?? 0);
    this.job = { to, metres, left: clock, clock0: clock, pay: 0, kind: 'plain', hp0: this.car ? this.car.hp : 100, party: true };
    this.from = m.at;
    this.lastFrom = m.at;
    this.routeT = 0;
    this.routePts = null;
    for (const o of this.pickups.splice(0)) this.scene.remove(o.mesh);
    this.onToast(p.say, 'info');
    this.onSound('pickup');
  }

  /** The colour of the way drawn: of the ring it leads to, flashing with it; yellow to the drop-off. */
  private routeColour(): string {
    if (this.job || !this.routeTo) return DROP;
    return this.pickups.includes(this.routeTo) ? this.ringNow(this.routeTo) : this.routeTo.colour ?? RING.plain;
  }

  /** A package's colour this moment: its own, or green while a home waits for a station's package. */
  private ringNow(m: Marker): string {
    return this.flash && this.wanted(m) ? RING.home : m.colour ?? RING[m.kind ?? 'plain'];
  }

  /** Whether a package is a station's job, which is offered on a card before it is taken. */
  private asks(m: Marker): boolean {
    return !!m.kind && this.run.over && !!this.onOffer && !this.auto;
  }

  /** Whether the player is at the station whose package this is: parked by its symbol, set back from the road. */
  private atStationOf(m: Marker): boolean {
    const station = (Object.keys(JOB_OF) as Array<keyof typeof JOB_OF>).find((k) => JOB_OF[k] === m.kind);
    const at = station && this.stationHere(station);
    if (!at) return false;
    const [ax, ay] = this.world.roads.point(at.line, at.s);
    const [mx, my] = this.local(m);
    return Math.hypot(ax - mx, ay - my) < 30;
  }

  /** A station's job on a card: taken only if the player says yes. Asked once until they drive off. */
  private offerJob(m: Marker): void {
    this.declined.add(m);
    const kind = m.kind!;
    // the mission's package goes to its place only when that is in the part of town loaded now (`take`)
    const sp = this.special && (!this.special.kinds || this.special.kinds.includes(kind)) ? this.special : null;
    const there = sp && (this.inSquare(sp.at) || !!this.doorOf(sp));
    this.onOffer!(kind, there ? sp!.say[kind] : null, (yes) => {
      if (!yes) {
        // no to one is no to every station's package here, until the player drives off
        const [px, py] = this.pos();
        for (const o of this.pickups) if (o.kind && Math.hypot(this.local(o)[0] - px, this.local(o)[1] - py) < 160) this.declined.add(o);
        return;
      }
      if (this.job || !this.pickups.includes(m)) return;
      if (!this.take(m)) {
        this.onToast('No drop-off for this job from here: try another station', 'bad');
        return;
      }
      this.declined.delete(m);
      // `take` has set the job
      if (there && !(this.job as Job | null)?.special) this.onToast('No road from here to your building: this one is an ordinary job', 'info');
    });
  }

  /** A package taken: the job it brings, to a drop-off the roads lead to. False when none was found. */
  private take(m: Marker): boolean {
    const w = this.world;
    const [px, py] = this.pos();
    const leg = this.run.over ? null : this.set?.legs[this.run.done];
    const [near, far, pace] = RUN_STEPS[this.run.over ? 2 : Math.min(this.run.done, RUN_STEPS.length - 1)];
    let marker: Marker | null = null;
    let metres = 0;
    if (leg) {
      // a run someone sent: the drop-off is where theirs was, so that runs compare (not moved off a
      // street that runs into a building, as one laid here is)
      marker = this.markerAt(DROP, leg.to);
      const f = this.fieldOf(marker);
      const [tx, ty] = this.local(marker);
      const inside = Math.abs(tx) < w.half - 10 && Math.abs(ty) < w.half - 10;
      const r = inside && f ? w.roads.route(f, px, py) : null;
      metres = r ? r.metres : Math.hypot(tx - px, ty - py) * 1.35;
    }
    const kind: JobKind = leg ? leg.kind ?? 'plain' : m.kind ?? 'plain';
    // a mission's package from a station: it goes to the mission's place, where a road leads there
    const special = !leg && this.run.over && m.kind && (!this.special?.kinds || this.special.kinds.includes(m.kind)) ? this.special : null;
    if (special) {
      const d = this.dropFor(special);
      if (d) {
        marker = d.marker;
        metres = d.metres;
      }
    }
    const isSpecial = !!(special && marker);
    // a sight or public place at a fitting distance makes the drop-off, where there is one
    const sights = leg || marker ? [] : w.sights.filter((s) => {
      const d2 = Math.hypot(s.x - px, s.y - py);
      return d2 > near * 0.8 && d2 < far * 1.5;
    });
    // otherwise a drop-off on a real street that the roads actually lead to
    for (let k = 0; k < 10 && !marker; k++) {
      const sight = k < 2 && sights.length ? pickOne(sights) : null;
      const at = sight && w.roads.nearest(sight.x, sight.y, 160, 'traffic');
      const place: PathState | null = at ? { line: at.line, s: at.s, dir: 1 } : w.roads.randomPlace('traffic', px, py, k < 6 ? near : 150, k < 6 ? far : 3000);
      const to = place && this.standOn(place);
      if (!to) continue;
      const cand = this.newMarker(DROP, to);
      const f = this.fieldOf(cand);
      const r = f && w.roads.route(f, px, py);
      if (r && r.metres < 2400) {
        marker = cand;
        metres = r.metres;
      } else this.scene.remove(cand.mesh);
    }
    if (!marker) return false;
    // open jobs pay more the more one has delivered, up to the 50th delivery: after that it no longer grows
    const base = Math.max(50, Math.round((metres * (0.5 + (this.run.over ? Math.min(this.delivered, OPEN_JOBS_GROW) : this.run.done) * 0.03)) / 10) * 10);
    // each kind of job has its own clock and its own pay
    const [clock, pay, say] = {
      plain: [25 + metres / pace, base, 'Package on board: get it to the yellow ring'],
      supply: [32 + metres / (pace * 0.8), Math.round((base * 1.25) / 10) * 10, 'Supply run: a heavy load, slow uphill and slow to stop. More pay for a car without a new dent'],
      rush: [10 + metres / (pace * 1.3), Math.round((base * 0.9) / 10) * 10, 'Rush job: a short clock, and every second left over pays three times'],
      clean: [28 + metres / (pace * 0.9), Math.round((base * 1.7) / 10) * 10, 'Clean run: pays well, but break the law on the way and the job is gone'],
    }[kind] as [number, number, string];
    // a mission's package: a little more time, for a drop-off that was not chosen to suit the clock
    const light = isSpecial && kind === 'supply' && special!.light !== undefined ? { light: special!.light } : {};
    this.job = { to: marker, metres, left: isSpecial ? clock * (special!.clock ?? 1) + 20 : clock, pay, kind, hp0: this.car ? this.car.hp : 100, car0: this.car, ...(isSpecial ? { special: true } : {}), ...light };
    this.from = m.at;
    this.lastFrom = m.at;
    this.routeT = 0;
    this.routePts = null;
    for (const o of this.pickups.splice(0)) this.scene.remove(o.mesh);
    this.onToast(isSpecial ? special!.say[kind] : say, 'info');
    this.onSound('pickup');
    if (isSpecial) this.onSpecialTaken(kind);
    return true;
  }

  /**
   * The spot on the road beside a station of a kind, when the player is at it: within `STATION_M` of that
   * spot or of the symbol itself. Null when not at one.
   */
  private stationHere(kind: 'fuel' | 'fire' | 'police'): PathState | null {
    const w = this.world;
    const [px, py] = this.pos();
    for (const s of w.services) {
      if (s.kind !== kind || Math.hypot(s.x - px, s.y - py) > 200) continue;
      const n = w.roads.nearest(s.x, s.y, 150, 'traffic');
      if (!n) continue;
      const [x, y] = w.roads.point(n.line, n.s);
      if (Math.hypot(x - px, y - py) < STATION_M || Math.hypot(s.x - px, s.y - py) < STATION_M) return { line: n.line, s: n.s, dir: 1 };
    }
    return null;
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
    if (this.find) return this.findStage === 'back' ? this.findDrop : this.findRing;
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
    // a drop-off up a lane too narrow for the car: on foot the rest of the way, along the road
    if (!this.car && this.autoWalk && this.job) {
      const f = this.fieldOf(this.job.to);
      const r = f ? w.roads.route(f, this.me.x, this.me.y, 40) : null;
      const [gx, gy] = this.local(this.job.to);
      let [tx, ty] = [gx, gy];
      if (r && r.metres > 8) {
        let left = 4;
        for (let i = 1; i < r.pts.length; i++) {
          const d = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
          [tx, ty] = r.pts[i];
          if ((left -= d) <= 0) break;
        }
      }
      const d = Math.hypot(tx - this.me.x, ty - this.me.y) || 1;
      this.walk({ moveX: (tx - this.me.x) / d, moveY: (ty - this.me.y) / d, stick: true, throttle: 0, steer: 0, brake: false, handbrake: false }, dt);
      return;
    }
    if (!this.job) {
      // a new goal starts afresh: no walking, backing up or waiting left over from the last
      this.autoWalk = false;
      this.autoBack = 0;
      this.autoStuck = 0;
      this.autoGoal = null;
    }
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
    // a party's food for a door up a lane too narrow for a car, and the car wedged near it (no nearer by road
    // for a few seconds, however it bumps about, and hardly moving): out of the car, and on foot (`autoWalk`).
    // Other jobs are driven as they always were.
    const gd = r ? r.metres : Infinity;
    if (!this.job?.party || !this.party?.walk || goal !== this.autoGoal || gd < this.autoBest - 1) {
      this.autoGoal = goal;
      this.autoBest = gd;
      this.autoStuck = 0;
    } else this.autoStuck += dt;
    if (this.autoBack > 0) {
      // no room to get out between the walls: back up a little first
      this.autoBack -= dt;
      c.controls.throttle = -0.6;
      c.controls.steer = 0;
      c.controls.handbrake = false;
      return;
    }
    if (this.autoStuck > 4 && gd < (this.party?.walk ?? 0) + WALK_AUTO_M && Math.abs(c.forward) < 2) {
      this.autoStuck = 0;
      this.action();
      if (!this.car) this.autoWalk = true;
      else this.autoBack = 1.5;
      return;
    }
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

  // ------------------------------------------------------------------ a car to find (`find.ts`)

  /**
   * A car to find near you: parked on a smaller street `FIND_NEAR` to `FIND_FAR` metres away, well inside
   * the square, with the circle around it. It goes back to the road beside the fuel station nearest `back`
   * (the story's pump), or the one nearest you. Null where there is no such place.
   */
  planFind(look: { kind: CarKind; colour: string }, back: LngLat | null): FindRun | null {
    const w = this.world;
    if (!w) return null;
    const [px, py] = this.pos();
    const [bx, by] = back ? w.proj.toLocal(back.lon, back.lat) : [px, py];
    let pump: { x: number; y: number } | null = null;
    let best = Infinity;
    for (const s of w.services) {
      const d = s.kind === 'fuel' ? Math.hypot(s.x - bx, s.y - by) : Infinity;
      if (d < best) {
        best = d;
        pump = s;
      }
    }
    const inside = (x: number, y: number, m: number) => Math.abs(x) < w.half - m && Math.abs(y) < w.half - m;
    const n = pump && w.roads.nearest(pump.x, pump.y, 150, 'traffic');
    if (!n) return null;
    const [tx, ty] = w.roads.point(n.line, n.s);
    if (!inside(tx, ty, 30)) return null;
    for (let k = 0; k < 80; k++) {
      const p = w.roads.randomPlace('drive', px, py, FIND_NEAR, FIND_FAR);
      if (!p) return null;
      const line = w.roads.lines[p.line];
      // parked on a street, not on a main road nor in a yard
      if (!line.traffic || line.kind === 'motorway' || line.kind === 'primary') continue;
      const [x, y] = w.roads.lanePoint(p, line.w / 2 + 1);
      if (!inside(x, y, 170) || Math.hypot(x - tx, y - ty) < 120) continue;
      const [hx, hy] = w.roads.heading(p);
      if (!w.free(x, y, 1.3) || !w.free(x + hx * 1.6, y + hy * 1.6, 1.2) || !w.free(x - hx * 1.6, y - hy * 1.6, 1.2) || this.carNear(x, y, 7)) continue;
      const z = zoneAround([x, y]);
      return { car: w.proj.toLngLat(x, y), th: Math.atan2(hy, hx), kind: look.kind, colour: look.colour, zone: w.proj.toLngLat(z.x, z.y), r: z.r, to: w.proj.toLngLat(tx, ty) };
    }
    return null;
  }

  /** Look for a car: whatever run or job was on ends, and nothing else is offered until it is back or put off. */
  startFind(f: FindRun): void {
    this.openPlay();
    this.find = f;
    this.findStage = 'search';
    this.findT = 0;
    this.findSlow = false;
    this.findFrom = null;
  }

  /** The search is over: its rings go, and the car stays where it is. `why`: said to whoever listens. */
  stopFind(why?: FindEvent): void {
    if (!this.find) return;
    this.find = null;
    for (const m of [this.findRing, this.findDrop]) if (m) this.scene.remove(m.mesh);
    this.findRing = null;
    this.findDrop = null;
    this.findCar = null;
    if (why) this.onFind(why, 0);
  }

  /** Where the arrow points while a car is looked for: the circle until you are in it, the car once seen, then the ring. */
  private findTarget(): { x: number; y: number; drop: boolean } | null {
    const f = this.find;
    if (!f) return null;
    const c = this.findCar;
    if (this.findStage === 'back' && this.findDrop) {
      const [x, y] = this.local(this.findDrop);
      return { x, y, drop: true };
    }
    if (this.findStage === 'seen' && c && !c.gone) return { x: c.x, y: c.y, drop: false };
    const [zx, zy] = this.world.proj.toLocal(f.zone.lon, f.zone.lat);
    const [px, py] = this.pos();
    // inside the circle, no arrow: look around
    return Math.hypot(zx - px, zy - py) > f.r * 0.85 ? { x: zx, y: zy, drop: false } : null;
  }

  private findTick(dt: number): void {
    const f = this.find!;
    const w = this.world;
    const [px, py] = this.pos();
    const [cx, cy] = w.proj.toLocal(f.car.lon, f.car.lat);
    // the car where it was parked: put back when a new square left it behind
    if ((!this.findCar || this.findCar.gone) && this.findStage !== 'back' && Math.abs(cx) < w.half - 8 && Math.abs(cy) < w.half - 8) {
      this.findCar = this.addCar(f.kind, cx, cy, f.th, f.colour);
    }
    const c = this.findCar;
    if (this.findStage === 'back' && (!c || c.gone)) {
      // gone while it was being driven back: sunk in the water, say
      this.endFind('wrecked');
      return;
    }
    if (!c || c.gone) return;
    if (c.hp <= 0) {
      if (this.findStage === 'search') {
        // knocked about by traffic before anyone saw it: it is found as it was parked
        this.dropCar(c);
        this.findCar = null;
        return;
      }
      this.endFind('wrecked');
      return;
    }
    if (this.car === c) {
      if (this.findStage !== 'back') {
        this.findStage = 'back';
        if (this.findRing) this.scene.remove(this.findRing.mesh);
        this.findRing = null;
        this.findDrop ??= this.markerAt(DROP, f.to);
        this.findFrom ??= w.proj.toLngLat(c.x, c.y);
        this.onFind('in', 0);
      }
      const [dx, dy] = this.local(this.findDrop!);
      const d = Math.hypot(dx - c.x, dy - c.y);
      if (d < HAND_M && c.speed < HAND_SPEED) this.endFind('done');
      else if (d < HAND_M && !this.findSlow) {
        this.findSlow = true;
        this.onToast('Stop at the ring to hand it over', 'info');
      }
      return;
    }
    if (this.findStage === 'back') {
      // out of it again: the ring at the car, until you are back in; parked where it was left
      this.findStage = 'seen';
      f.car = w.proj.toLngLat(c.x, c.y);
      f.th = c.th;
      this.onFind('out', 0);
    }
    if (this.findStage === 'seen') {
      this.findRing ??= this.markerAt(RING.supply, w.proj.toLngLat(c.x, c.y));
      this.findRing.at = w.proj.toLngLat(c.x, c.y);
      return;
    }
    // looking: seen once near enough with a clear view; after a while the circle closes in on it
    const d = Math.hypot(c.x - px, c.y - py);
    if (seen(d, d < 45 && !w.solids.blocked(px, py, c.x, c.y))) {
      this.findStage = 'seen';
      this.onSound('pickup');
      this.onFind('spotted', 0);
      return;
    }
    this.findT += dt;
    if (this.findT > CLOSE_IN_S && f.r > ZONE_MIN) {
      this.findT = 0;
      const [zx, zy] = w.proj.toLocal(f.zone.lon, f.zone.lat);
      const z = closeIn({ x: zx, y: zy, r: f.r }, [cx, cy]);
      f.zone = w.proj.toLngLat(z.x, z.y);
      f.r = z.r;
      this.onFind('closer', 0);
    }
  }

  /** Back at the ring, or wrecked on the way: the search is over, and how far it was driven back is said. */
  private endFind(e: 'done' | 'wrecked'): void {
    const c = this.findCar;
    const from = this.findFrom && this.world.proj.toLocal(this.findFrom.lon, this.findFrom.lat);
    const [ex, ey] = c && !c.gone ? [c.x, c.y] : this.pos();
    const metres = from ? Math.hypot(ex - from[0], ey - from[1]) * 1.3 : 0;
    this.stopFind();
    this.onFind(e, metres);
    this.onSave();
  }

  private endJob(done: boolean, why?: 'late' | 'caught' | 'offence' | 'dropped'): void {
    this.routeLine.visible = false;
    // the way to the drop-off goes with it; the next is worked out at once
    this.routePts = null;
    this.routeT = 0;
    if (!this.job) return;
    const special = !!this.job.special;
    this.scene.remove(this.job.to.mesh);
    this.job = null;
    if (special && !done) this.onSpecialLost(why ?? 'dropped');
  }

  /** Whether a station's package is one the mission's drop-off waits for: its ring flashes green. */
  private wanted(m: Marker): boolean {
    return !!m.kind && (!this.special?.kinds || this.special.kinds.includes(m.kind));
  }

  /**
   * Whether a package can be taken to the mission's drop-off from here: it is in the square being played,
   * or the next square has left it behind and its door is known and near (`door`).
   */
  specialHere(): boolean {
    return !!this.special && (this.inSquare(this.special.at) || !!this.doorOf(this.special));
  }

  /** Whether a place lies in the square being played. */
  private inSquare(at: LngLat): boolean {
    const [x, y] = this.world.proj.toLocal(at.lon, at.lat);
    return Math.abs(x) < this.world.half - 10 && Math.abs(y) < this.world.half - 10;
  }

  /** The door kept for a mission's place, when the player is within `DOOR_REACH_M` of it; else null. */
  private doorOf(sp: { at: LngLat }): LngLat | null {
    const d = this.door;
    if (!d || d.for.lat !== sp.at.lat || d.for.lon !== sp.at.lon) return null;
    const [x, y] = this.world.proj.toLocal(d.at.lon, d.at.lat);
    const [px, py] = this.pos();
    return Math.hypot(x - px, y - py) < DOOR_REACH_M ? d.at : null;
  }

  /**
   * The drop-off for a mission's package: a yellow ring where a road leads to it from the player, and how
   * far that is. In the square of its place, the street at the door where a car may go (an old town's
   * lanes too), else the nearest main road: the lane at the door can be a yard's driveway that no road
   * leads to. Once the next square has left the place behind, the door as it was last found. Null where
   * neither gives one: the package is then an ordinary job's.
   */
  private dropFor(sp: { at: LngLat }): { marker: Marker; metres: number } | null {
    const w = this.world;
    const [px, py] = this.pos();
    if (this.inSquare(sp.at)) {
      const [sx, sy] = w.proj.toLocal(sp.at.lon, sp.at.lat);
      for (const n of [w.roads.nearest(sx, sy, 60, 'drive'), w.roads.nearest(sx, sy, 200, 'traffic')]) {
        const at = n ? this.standOn({ line: n.line, s: n.s, dir: 1 }) : null;
        if (!at) continue;
        const cand = this.newMarker(DROP, at);
        const f = this.fieldOf(cand);
        const r = f && w.roads.route(f, px, py);
        if (r) {
          this.door = { for: sp.at, at: cand.at };
          return { marker: cand, metres: r.metres };
        }
        this.scene.remove(cand.mesh);
      }
      return null;
    }
    const door = this.doorOf(sp);
    if (!door) return null;
    // beyond the square, the way by road is not known: as for a run's drop-off out there, a guess from the straight line
    const marker = this.markerAt(DROP, door);
    const [tx, ty] = this.local(marker);
    return { marker, metres: Math.hypot(tx - px, ty - py) * 1.35 };
  }

  /** Before the square goes: the door of a mission's place in it is found and kept, if it is not known yet. */
  private keepDoor(): void {
    const sp = this.special;
    if (!sp || !this.inSquare(sp.at) || (this.door && this.door.for.lat === sp.at.lat && this.door.for.lon === sp.at.lon)) return;
    const d = this.dropFor(sp);
    // only the place is wanted: the ring is laid when a package is taken
    if (d) this.scene.remove(d.marker.mesh);
  }

  private placeMarkers(): void {
    const pulse = 1 + 0.08 * Math.sin(this.clock * 5);
    // a home waits for a package from a station: those rings flash green, the colour of homes
    const blink = (this.flash = this.specialHere() && this.run.over && !this.job && Math.sin(this.clock * 7) < -0.35);
    for (const m of [...this.pickups, ...(this.job ? [this.job.to] : []), ...(this.findRing ? [this.findRing] : []), ...(this.findDrop ? [this.findDrop] : [])]) {
      const [x, y] = this.local(m);
      const inside = Math.abs(x) < this.world.half && Math.abs(y) < this.world.half;
      m.mesh.visible = inside;
      if (m.kind) {
        const want = blink && this.wanted(m) ? RING.home : m.colour ?? RING[m.kind];
        if (m.shown !== want) {
          tintMarker(m.mesh, want);
          m.shown = want;
        }
      }
      if (m === this.routeTo && this.routeLine.visible) this.routeLine.material.color.set(this.routeColour());
      if (!inside) continue;
      // the ring lies flat: on a slope it is lifted over the highest ground under it, or the slope hides part of it
      m.mesh.position.set(x, this.world.groundY(x, y) + riseUnder((gx, gy) => this.world.groundY(gx, gy), x, y, 5 * pulse), -y);
      // flashing for a home it is a quarter bigger too, so it shows to those who can't tell red from green
      const grow = blink && this.wanted(m) ? 1.25 : 1;
      m.mesh.scale.set(pulse * grow, 1, pulse * grow);
    }
  }

  // ------------------------------------------------------------------ the frame

  update(dtRaw: number, input: Input): void {
    const dt = Math.max(0, Math.min(dtRaw, 0.05));
    if (this.held) {
      if (this.render) this.renderer.render(this.scene, this.camera);
      return;
    }
    for (const tick of this.ticks) tick(dt);
    const w = this.world;
    this.bridged.clear();
    this.clock += dt;
    if (this.frozen > 0) this.frozen -= dt;
    const live = this.frozen <= 0;

    if (this.auto && live) this.autopilot(dt);
    else if (this.car && !this.sinking) this.steerMine(this.car, input, dt);
    else if (this.car) Object.assign(this.car.controls, { throttle: 0, steer: 0, handbrake: false });
    else if (live) this.walk(input, dt);
    for (const c of this.cars) if (!c.gone && (c.driver === 'ai' || c.driver === 'cop')) this.drive(c, dt);

    let fastest = 0;
    for (const c of this.cars) {
      c.heavy = c === this.car && this.job?.kind === 'supply' ? (this.job.light ?? 1) : 0;
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
          if ((railsOf(p.kind) || railsOf(q.kind)) && Math.abs(p.x - q.x) < 80 && Math.abs(p.y - q.y) < 80 && this.apart(p, q)) continue;
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
    // trams and trains lie on their rails, whatever the steering did
    for (const c of this.cars) if (!c.gone && !c.asleep && c.driver === 'ai' && c.hp > 0 && railsOf(c.kind)) this.onRails(c, dt);
    if (this.car && this.car.knock > 2.5) this.onSound('crash', Math.min(1, this.car.knock / 16));
    this.stepPeople(dt);
    this.bumps();

    // water, wrecks and cars that have driven out of the picture
    const [px, py] = this.pos();
    for (const c of this.cars) {
      if (c.gone) continue;
      const far = Math.hypot(c.x - px, c.y - py);
      if (w.inWater(c.x, c.y)) {
        // your own car goes down slowly, with you in it, and you come up on the shore
        if (c === this.car) {
          if (!this.sinking) {
            this.sinking = { car: c, t: 0, shore: this.dry };
            this.onToast('Splash!', 'bad');
            this.onSound('splash');
          }
          continue;
        }
        this.dropCar(c);
      } else if (c === this.car) {
        this.dry = [c.x, c.y];
        if (c.speed > 1 && w.inStream(c.x, c.y)) this.ford(c, dt);
      } else if (c.driver === 'ai' || c.driver === 'cop') {
        const limit = this.chasing(c) ? 420 : this.viewR + 190;
        if (far > limit || Math.abs(c.x) > w.half - 8 || Math.abs(c.y) > w.half - 8 || (c.hp <= 0 && far > this.viewR + 20)) this.dropCar(c);
        else if (c.hp <= 0) {
          c.driver = 'none';
          c.rail = null;
        }
      }
    }
    if (this.sinking) this.sink(dt);
    this.sweep();
    if (!this.car && live && w.inWater(this.me.x, this.me.y)) {
      this.onToast('Splash!', 'bad');
      this.onSound('splash');
      this.toRoad(0, 0);
    }
    if (this.me.hp <= 0) this.fine('Knocked out!', 0.15);
    // the car you sit in is wrecked: it blows up, and a moment later you start again as when caught
    if (this.blowT > 0) {
      this.blowT -= dt;
      const c = this.blown;
      if (c) for (let i = 0; i < 2; i++) this.cloud(c.x + (Math.random() - 0.5) * 5, c.y + (Math.random() - 0.5) * 5, 0.8 + Math.random() * 2.5, pickOne(BLAST));
      if (this.blowT <= 0) {
        this.blown = null;
        this.fine('Wrecked!', 0.15);
      }
    } else if (this.car && this.car.hp <= 0 && live) {
      this.blown = this.car;
      this.blowT = 0.9;
      this.frozen = 1;
      this.car.controls.throttle = 0;
      this.car.vx *= 0.3;
      this.car.vy *= 0.3;
      this.onSound('crash', 1);
    }

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
      // and a train or two on the railway
      if (w.roads.hasTrains && this.cars.filter((c) => c.kind === 'train').length < 2) this.spawnTraffic('train', this.viewR + 30, this.viewR + 170);
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
        const goal = this.goal();
        this.routeTo = this.job ? null : goal;
        this.drawRoute(goal, this.routeColour());
      }
    }
    this.draw(dt);
  }

  private draw(dt: number): void {
    const w = this.world;
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
    this.view(dt);
  }

  /** What can be heard around the player, for the sounds. */
  ears(): Ears {
    const c = this.car;
    const [px, py] = this.pos();
    let siren = 0;
    let train = 0;
    for (const o of this.cars) {
      if (o.gone) continue;
      const d = Math.hypot(o.x - px, o.y - py);
      if (o.driver === 'cop' && this.heat > 0 && o.hp > 0) siren = Math.max(siren, 1 - d / 190);
      else if (o.kind === 'train' && o.speed > 3) train = Math.max(train, 1 - d / 150);
    }
    return {
      driving: !!c && c.hp > 0,
      speed: c ? Math.abs(c.forward) : 0,
      throttle: c ? Math.min(1, Math.abs(c.controls.throttle)) : 0,
      skid: !!c && c.controls.handbrake && c.speed > 7,
      siren: Math.max(0, siren),
      train: Math.max(0, train),
    };
  }

  /** Only the camera moves and the picture is drawn: for behind the result of a run, while the game waits. */
  watch(dt: number): void {
    this.view(Math.max(0, Math.min(dt, 0.05)));
  }

  /** Rise over the part of town, as a run ends. */
  overview(): void {
    this.rising = true;
    this.descent = 0;
  }

  /** Back down to the player from wherever the camera is. */
  comeDown(): void {
    if (!this.rising) return;
    this.rising = false;
    this.descentFrom = this.cam.h;
    this.descent = DESCENT_S;
    this.pace.hold = DESCENT_S + 1.5;
  }

  private view(dt: number): void {
    const w = this.world;
    const [px, py] = this.pos();
    const [vx, vy] = this.vel();
    const speed = Math.hypot(vx, vy);
    // the camera: straight down, north up, higher the faster you go, and above the roofs
    const k = 1 - Math.exp(-4 * dt);
    const lead = this.car ? 0.5 : 0;
    this.cam.x += (px + vx * lead - this.cam.x) * k;
    this.cam.y += (py + vy * lead - this.cam.y) * k;
    const portrait = Math.max(1, 1 / this.camera.aspect) ** 0.8;
    let h = (this.car ? 60 + speed * 2.7 : 40) * portrait;
    h = Math.max(h, w.solids.tallestNear(px, py, 45) + 34);
    if (this.rising) {
      // a run has ended: up and away, to see where it led
      this.cam.h += (ARRIVE_M * portrait - this.cam.h) * (1 - Math.exp(-0.8 * dt));
    } else if (this.descent > 0) {
      // arriving: a look at the part of town from high up, then down to you
      this.descent -= dt;
      const p = clamp(1 - this.descent / DESCENT_S, 0, 1);
      const eased = p * p * p * (p * (p * 6 - 15) + 10);
      const from = this.descentFrom || ARRIVE_M * portrait;
      this.cam.h = Math.exp(Math.log(from) + (Math.log(h) - Math.log(from)) * eased);
    } else this.cam.h += (h - this.cam.h) * (1 - Math.exp(-1.8 * dt));
    // under a roof, you are drawn over it
    this.ghost.visible = !this.rising && w.roofs.over(px, py);
    if (this.ghost.visible) {
      const c = this.car;
      this.ghost.scale.set(c ? c.spec.len : 0.9, 1, c ? c.spec.wid : 0.9);
      this.ghost.position.set(px, w.groundY(px, py) + 0.3, -py);
      this.ghost.rotation.y = c ? c.th : this.me.th;
    }
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
      // only as deep as what is in view, so the depths are told apart more finely
      const sunAt = 500 * Math.hypot(0.55, 0.78, 0.55);
      sc.near = Math.max(10, sunAt - reach - 160);
      sc.far = sunAt + reach + 120;
      // the same slack in metres whatever the depth
      this.sun.shadow.bias = -0.46 / (sc.far - sc.near);
      sc.updateProjectionMatrix();
    }
    if (this.render) this.renderer.render(this.scene, this.camera);
  }

  /** One puff of smoke or spray that rises and fades; false when all of them are in the air. */
  private cloud(x: number, y: number, up: number, colour: string): boolean {
    const s = this.noSmoke ? undefined : this.smoke.find((o) => o.life <= 0);
    if (!s) return false;
    s.life = 1;
    s.mesh.visible = true;
    s.mesh.material.color.set(colour);
    s.mesh.position.set(x, this.world.groundY(x, y) + up, -y);
    return true;
  }

  /** Smoke from cars that have taken a beating. */
  private puff(dt: number): void {
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.09;
      const [px, py] = this.pos();
      for (const c of this.cars) {
        if (c.hp >= 35 || Math.hypot(c.x - px, c.y - py) > this.viewR) continue;
        if (!this.cloud(c.x + Math.cos(c.th) * c.a + (Math.random() - 0.5), c.y + Math.sin(c.th) * c.a + (Math.random() - 0.5), 1.4, c.hp <= 0 ? '#1c1c1c' : '#6a6a6a')) break;
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
  mapView(): {
    x: number;
    y: number;
    th: number;
    pickups: Array<{ at: Pt; colour: string }>;
    drop: Pt | null;
    cops: Pt[];
    route: Pt[] | null;
    routeColour: string;
    /** the circle to search for a car, and the car once seen */
    zone: { x: number; y: number; r: number } | null;
    sought: { at: Pt; colour: string } | null;
  } {
    const [x, y] = this.pos();
    const f = this.find;
    const zone = f && this.findStage === 'search' ? (([zx, zy]) => ({ x: zx, y: zy, r: f.r }))(this.world.proj.toLocal(f.zone.lon, f.zone.lat)) : null;
    const car = this.findCar;
    const sought = f && car && !car.gone && this.findStage !== 'search' && this.car !== car ? { at: [car.x, car.y] as Pt, colour: f.colour } : null;
    return {
      x,
      y,
      // backing up, the arrowhead shows the way you are going, not the way the bonnet points
      th: this.car ? (this.car.forward < -0.5 ? this.car.th + Math.PI : this.car.th) : this.me.th,
      pickups: this.job ? [] : this.pickups.map((m) => ({ at: this.local(m), colour: this.ringNow(m) })),
      drop: this.job ? this.local(this.job.to) : this.findDrop ? this.local(this.findDrop) : null,
      zone,
      sought,
      cops: this.heat > 0 ? this.cars.filter((c) => c.driver === 'cop' && !c.gone).map((c): Pt => [c.x, c.y]) : [],
      route: this.routePts,
      routeColour: this.routeColour(),
    };
  }

  /** What the screen shows around the picture. */
  hud(): Hud {
    const [px, py] = this.pos();
    let target: Hud['target'] = null;
    let best: { x: number; y: number; d: number; kind: 'drop' | 'job' | 'guide'; colour: string } | null = null;
    if (this.job) {
      const [x, y] = this.local(this.job.to);
      best = { x, y, d: Math.hypot(x - px, y - py), kind: 'drop', colour: DROP };
    } else if (this.find) {
      const t = this.findTarget();
      if (t) best = { x: t.x, y: t.y, d: Math.hypot(t.x - px, t.y - py), kind: t.drop ? 'drop' : 'guide', colour: t.drop ? DROP : RING.supply };
    } else if (this.guide && !this.party) {
      best = { ...this.guide, d: Math.hypot(this.guide.x - px, this.guide.y - py), kind: 'guide', colour: RING.home };
    } else {
      for (const m of this.pickups) {
        const [x, y] = this.local(m);
        const d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { x, y, d, kind: 'job', colour: this.ringNow(m) };
      }
    }
    if (best) {
      const v = new Vector3(best.x, this.world.groundY(clamp(best.x, -this.world.half, this.world.half), clamp(best.y, -this.world.half, this.world.half)), -best.y).project(this.camera);
      target = { ndcX: v.x, ndcY: v.y, metres: best.d, kind: best.kind, colour: best.colour };
    }
    let hint = '';
    if (!this.car) {
      const c = this.carInReach();
      if (c) hint = c.driver === 'none' ? 'get in' : c.kind === 'bus' ? 'take this bus' : 'take this car';
      else if (this.subwayHere() >= 0) hint = 'take the subway';
    } else if (this.car.hp <= 0) hint = 'wrecked';
    // an add-on's hint for what the press would do here comes before the game's own
    for (const say of this.hints) {
      const t = say();
      if (t) {
        hint = t;
        break;
      }
    }
    return {
      cash: this.cash,
      heat: Math.ceil(this.heat),
      health: Math.max(0, this.me.hp),
      carHp: this.car ? this.car.hp : null,
      kmh: this.speed() * 3.6,
      job: this.job ? { left: this.job.left, metres: this.job.metres, pay: this.job.pay, kind: this.job.kind, party: !!this.job.party } : null,
      hint,
      target,
      delivered: this.delivered,
      sights: this.world.sights.flatMap((s): Hud['sights'] => {
        const v = new Vector3(s.x, this.world.groundY(s.x, s.y) + 12, -s.y).project(this.camera);
        if (Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.82) return [{ name: s.name, ndcX: v.x, ndcY: v.y, metres: null }];
        // close by but out of the picture: its name at the edge, on the side it lies
        const [mx, my] = this.pos();
        const d = Math.hypot(s.x - mx, s.y - my);
        if (d > 320) return [];
        const over = Math.max(Math.abs(v.x) / 0.8, Math.abs(v.y) / 0.72);
        return [{ name: s.name, ndcX: v.x / over, ndcY: v.y / over, metres: d }];
      }),
      run: this.run.over ? null : { n: this.run.done + 1, of: this.run.of, score: this.run.score },
    };
  }
}
