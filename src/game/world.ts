/**
 * One square of the city, loaded and ready to play in: the 3D model, the road network, the
 * walls and the water. Squares sit on a fixed grid; the next one loads as you near the edge.
 */

import { CanvasTexture, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { pointInRing, ringBounds, type Polygon } from '../geo/polygon';
import { makeProjector, type LngLat, type Projector } from '../geo/projection';
import { loadHeightGrid } from '../geo/terrain';
import { DATA_ZOOM, fetchTiles, parseTiles, tilesForSquare, type LoadedTile } from '../geo/tiles';
import { CityModel } from '../scene/cityModel';
import { PALETTE } from '../scene/overlay';
import { buildRoadMeshes, disposeRoadMeshes, showRelief } from './roadMesh';
import { RoadNet } from './roads';
import { Solids, Streams, WaterMask } from './solids';
import { sightsIn, type Sight } from '../landmarks';
import { localColours } from './localColours';
import { inventServices, readServices, serviceIcon, type Service } from './services';

export const AREA_SIZE_M = 1500;
const GRID_STEP_M = 750;
/** This far from the square's centre, the next square loads (m). */
const RECENTRE_M = 450;
const GRID_N = 193;

const M_PER_DEG_LAT = 111320;
const LAT_STEP = GRID_STEP_M / M_PER_DEG_LAT;
const lonStep = (lat: number) => GRID_STEP_M / (M_PER_DEG_LAT * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
const fix7 = (x: number) => Math.round(x * 1e7) / 1e7;

/** The grid point nearest to a position: the centre of the square to load there. */
export function areaCentre(p: LngLat): LngLat {
  const row = Math.round(p.lat / LAT_STEP);
  const lat = row * LAT_STEP;
  return { lat: fix7(lat), lon: fix7(Math.round(p.lon / lonStep(lat)) * lonStep(lat)) };
}

/** The square at a place and the eight around it. */
export function squaresAround(p: LngLat): LngLat[] {
  const c = areaCentre(p);
  const proj = makeProjector(c);
  const out: LngLat[] = [];
  for (const n of [0, 1, -1]) for (const e of [0, 1, -1]) out.push(areaCentre(proj.toLngLat(e * GRID_STEP_M, n * GRID_STEP_M)));
  return out;
}

export function areaKey(c: LngLat): string {
  return `${c.lat.toFixed(5)},${c.lon.toFixed(5)}`;
}

// a street map to drive on: dark roads with pale pavements, stronger greens and water
Object.assign(PALETTE, {
  ground: '#d8d2c2',
  farmland: '#d6d3b4',
  green: '#a8c98a',
  forest: '#8fb878',
  sand: '#e6d6a8',
  plaza: '#cfc9bb',
  water: '#6aa6cc',
  roadFill: '#565b63',
  roadCasing: '#bdb7a8',
  path: '#c4bba6',
  rail: '#7d766a',
});


/** Towers are squashed so the camera can stay close above the streets. */
export function gameHeight(h: number): number {
  return h <= 18 ? h : 18 + (h - 18) * 0.3;
}

/**
 * Buildings a street runs through: gateways, passages, town walls, stations over the road. The map draws
 * them as whole blocks, which would wall the street off, so they don't count as walls.
 */
function buildingsOverRoads(buildings: Array<{ poly: Polygon }>, roads: RoadNet): Set<number> {
  const CELL = 32;
  const key = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);
  const cells = new Map<number, number[]>();
  buildings.forEach((b, i) => {
    const [x0, y0, x1, y1] = ringBounds(b.poly.outer);
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
        const k = key(cx, cy);
        const list = cells.get(k);
        if (list) list.push(i);
        else cells.set(k, [i]);
      }
  });
  const hits = new Map<number, number>();
  for (let li = 0; li < roads.lines.length; li++) {
    const l = roads.lines[li];
    if (!l.traffic) continue;
    for (let sv = 0.5; sv < l.len; sv += 1.5) {
      const p = roads.point(li, sv);
      for (const i of cells.get(key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL))) ?? []) {
        const poly = buildings[i].poly;
        if (pointInRing(p, poly.outer) && !poly.holes.some((h) => pointInRing(p, h))) hits.set(i, (hits.get(i) ?? 0) + 1);
      }
    }
  }
  // even a thin one counts: a town wall is two metres thick where the street goes through its gate
  return new Set(hits.keys());
}

export interface Stop {
  kind: 'bus' | 'tram' | 'subway';
  x: number;
  y: number;
  name: string;
}

/** Rough boxes (south, west, north, east) of the places that drive on the left. */
const LEFT_HAND: Array<[number, number, number, number]> = [
  [49.8, -10.8, 60.9, 1.9], // Britain and Ireland
  [24, 122.9, 45.6, 146], // Japan
  [-47.5, 112, -10, 179], // Australia and New Zealand
  [5.5, 60.8, 37, 97.4], // India, Pakistan, Bangladesh, Sri Lanka, Nepal
  [-11, 95, 20.5, 119.3], // Thailand, Malaysia, Singapore, Indonesia
  [22.1, 113.8, 22.6, 114.5], // Hong Kong
  [-35, 11.7, -17, 41], // South Africa, Namibia, Botswana, Zimbabwe, southern Mozambique
  [-17, 22, -8, 41], // Zambia, Malawi, northern Mozambique
  [-11.8, 30.9, 4.7, 41.9], // Tanzania, Kenya, Uganda
];

/** Stops and stations from the map tiles' points of interest. */
function readStops(tiles: LoadedTile[], proj: Projector, half: number): Stop[] {
  const out: Stop[] = [];
  for (const t of tiles) {
    const layer = t.tile.layers.poi;
    if (!layer) continue;
    const n = 2 ** t.z;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      if (f.type !== 1) continue;
      const sub = String(f.properties.subclass ?? '');
      const kind = sub === 'bus_stop' ? 'bus' : sub === 'tram_stop' ? 'tram' : sub === 'subway_entrance' ? 'subway' : null;
      if (!kind) continue;
      const pt = f.loadGeometry()[0]?.[0];
      // points near a tile's edge are repeated in its neighbours
      if (!pt || pt.x < 0 || pt.y < 0 || pt.x >= layer.extent || pt.y >= layer.extent) continue;
      const lon = ((t.x + pt.x / layer.extent) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
      const [x, y] = proj.toLocal(lon, lat);
      if (Math.abs(x) > half || Math.abs(y) > half) continue;
      out.push({ kind, x, y, name: String(f.properties.name ?? '') });
    }
  }
  return out;
}

/**
 * Where no well-known sight lies in a square: the public places any town has and its people know,
 * from the map's points of interest. One of each kind at most, and no more than six, the most
 * telling kinds first. Only public places: no shops, no schools, no hospitals, no churches.
 */
function townSights(tiles: LoadedTile[], proj: Projector, half: number): Sight[] {
  // by the map's own sub-kind: it files community centres under "town hall" too, which are not meant.
  // Post offices are left out: the map files parcel shops and other businesses under them. Courts too:
  // the one that turns up is as likely a juvenile or labour court.
  const ORDER = ['townhall', 'station', 'museum', 'theatre', 'library', 'stadium', 'bus_station', 'ferry_terminal', 'cinema', 'marketplace', 'swimming_pool', 'sports_centre'];
  const KINDS: Array<[string, (cls: string, sub: string, name: string) => boolean]> = ORDER.map((k) => [k, (cls: string, sub: string) => sub === k && (k !== 'station' || cls === 'railway')]);
  const best = new Map<string, Sight & { rank: number }>();
  for (const t of tiles) {
    const layer = t.tile.layers.poi;
    if (!layer) continue;
    const n = 2 ** t.z;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const name = String(f.properties.name ?? '').trim();
      if (f.type !== 1 || !name || name.length > 40) continue;
      const cls = String(f.properties.class ?? '');
      const sub = String(f.properties.subclass ?? '');
      const kind = KINDS.find(([, is]) => is(cls, sub, name))?.[0];
      if (!kind) continue;
      const pt = f.loadGeometry()[0]?.[0];
      if (!pt || pt.x < 0 || pt.y < 0 || pt.x >= layer.extent || pt.y >= layer.extent) continue;
      const lon = ((t.x + pt.x / layer.extent) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (t.y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
      const [x, y] = proj.toLocal(lon, lat);
      if (Math.abs(x) > half || Math.abs(y) > half) continue;
      // the map ranks what it shows first; among equals, the one nearer the middle of the square
      const rank = Number(f.properties.rank ?? 99) + Math.hypot(x, y) / 1e5;
      const was = best.get(kind);
      if (!was || rank < was.rank) best.set(kind, { name, x, y, rank });
    }
  }
  // one building mapped as two things is named once
  const seen = new Set<string>();
  return ORDER.flatMap((k) => best.get(k) ?? [])
    .filter((b) => !seen.has(b.name) && !!seen.add(b.name))
    .slice(0, 6)
    .map(({ name, x, y }) => ({ name, x, y }));
}

const SIGN = { bus: ['#3fae5a', 1.1], tram: ['#d8362e', 1.3], subway: ['#1f6fd6', 2.6] } as const;
const signMats = new Map<string, MeshBasicMaterial>();

/** A coloured disc on the ground at every stop, and a bigger one at subway entrances. */
function stopSigns(stops: Stop[], groundY: (x: number, y: number) => number): Group {
  const g = new Group();
  for (const s of stops) {
    const [colour, r] = SIGN[s.kind];
    for (const [rad, col, lift] of [[r, '#16181c', 0.5], [r * 0.72, colour, 0.56]] as Array<[number, string, number]>) {
      let mat = signMats.get(col);
      if (!mat) signMats.set(col, (mat = new MeshBasicMaterial({ color: col, side: DoubleSide })));
      const m = new Mesh(new CircleGeometry(rad, 20), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(s.x, groundY(s.x, s.y) + lift, -s.y);
      g.add(m);
    }
  }
  return g;
}

const serviceMats = new Map<string, MeshBasicMaterial>();
const serviceDisc = new CircleGeometry(4.6, 28);

/** The symbol of a fuel, fire or police station, flat on the ground where the map has it. */
function serviceSign(s: Service, groundY: (x: number, y: number) => number): Mesh {
  const key = s.kind + !!s.invented;
  let mat = serviceMats.get(key);
  if (!mat) {
    const map = new CanvasTexture(serviceIcon(s.kind, !!s.invented));
    map.colorSpace = SRGBColorSpace;
    serviceMats.set(key, (mat = new MeshBasicMaterial({ map, transparent: true, side: DoubleSide })));
  }
  // its own copy of the disc, so that taking a square away can dispose of every sign alike
  const m = new Mesh(serviceDisc.clone(), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(s.x, groundY(s.x, s.y) + 0.6, -s.y);
  return m;
}

/**
 * Scene height of the ground exactly as it is drawn. The ground is a grid of squares, each drawn
 * as two flat triangles; the engine's own `groundY` blends a square's four corners smoothly
 * instead, which on a slope sits up to a few decimetres off the triangles. Streets laid with it
 * dipped under the ground there, and the ground showed through them in triangular patches.
 */
function surfaceY(model: CityModel, e: number, nm: number): number {
  const g = model.grid;
  const n = g.n;
  const step = g.sizeM / (n - 1);
  const fx = Math.max(0, Math.min(n - 1.000001, (e + g.sizeM / 2) / step));
  const fy = Math.max(0, Math.min(n - 1.000001, (nm + g.sizeM / 2) / step));
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const a = g.elev[j * n + i];
  const b = g.elev[j * n + i + 1];
  const c = g.elev[(j + 1) * n + i];
  const d = g.elev[(j + 1) * n + i + 1];
  // the same two triangles as the terrain mesh: split along the b–c diagonal
  const elev = tx + ty <= 1 ? a + (b - a) * tx + (c - a) * ty : d + (c - d) * (1 - tx) + (b - d) * (1 - ty);
  return model.terrain.y(elev);
}

/** Let the page draw a frame and take input before the next piece of work. */
const breathe = () => new Promise<void>((r) => setTimeout(r, 0));

export class World {
  /** the squares there is map for, when the map ships with the page; null: anywhere */
  static allowed: Set<string> | null = null;
  readonly proj: Projector;
  readonly half = AREA_SIZE_M / 2;

  private constructor(
    readonly centre: LngLat,
    readonly model: CityModel,
    readonly roads: RoadNet,
    readonly solids: Solids,
    readonly water: WaterMask,
    private readonly streams: Streams,
    private readonly ribbons: Group,
    /** bus stops, tram stops and subway entrances, from the map */
    readonly stops: Stop[],
    private readonly signs: Group,
    readonly buildingCount: number,
  ) {
    this.proj = makeProjector(centre);
    this.sights = sightsIn(this.proj, AREA_SIZE_M / 2);
  }

  /** fuel, fire and police stations, marked with a symbol and not named */
  readonly services: Service[] = [];

  /** well-known sights in this square, to be named for the player */
  readonly sights: Sight[];

  static async load(centre: LngLat, texturePx: number): Promise<World> {
    const [grid, tiles] = await Promise.all([loadHeightGrid(centre, AREA_SIZE_M, GRID_N), fetchTiles(tilesForSquare(centre, AREA_SIZE_M, DATA_ZOOM))]);
    // Building a square takes a few hundred milliseconds of work. Done in one go it froze the game
    // mid-drive each time the next square arrived, so it is done in steps with a frame in between.
    const data = parseTiles(tiles, centre, AREA_SIZE_M);
    const stops = readStops(tiles, makeProjector(centre), AREA_SIZE_M / 2 - 8);
    await breathe();
    const buildings = data.buildings.map((b) => ({ poly: b.poly, height: gameHeight(b.height), minHeight: gameHeight(b.minHeight), estimated: false, heightKnown: true }));
    const model = new CityModel(grid, texturePx, '#ffcc00');
    model.setExaggeration(1);
    model.showPin(false);
    model.terrain.walls.visible = false;
    // the ground takes shadows but throws none: seen from above its own shadow adds nothing, and
    // on some graphics chips it drew dark streaks that stayed put on the screen
    model.terrain.surface.castShadow = false;
    model.terrain.base.visible = false;
    await breathe();
    model.setBuildingSpecs(buildings);
    await breathe();
    model.setFeatures(data.features);
    const colours = localColours(data.colours, makeProjector(centre));
    model.setBuildingTint((e, n) => colours.at(e, n));
    (model as unknown as { roofCounts: unknown }).roofCounts = colours.counts;
    await breathe();
    const roads = new RoadNet(data.features.lines, AREA_SIZE_M / 2);
    await breathe();
    const over = buildingsOverRoads(buildings, roads);
    const ribbons = await buildRoadMeshes(roads, (x, y) => surfaceY(model, x, y), breathe);
    model.group.add(ribbons);
    await breathe();
    const solids = new Solids(buildings.filter((_, i) => !over.has(i)));
    const water = new WaterMask(data.features.areas, data.features.lines, data.features.sea ?? [], AREA_SIZE_M);
    // last, when nothing works the ground's surface over again
    showRelief(model.terrain.surface.geometry);
    const signs = stopSigns(stops, (x, y) => surfaceY(model, x, y));
    model.group.add(signs);
    const world = new World(centre, model, roads, solids, water, new Streams(data.features.lines), ribbons, stops, signs, buildings.length);
    // every real one the loaded map holds, to judge by; those in the square and the made-up ones are kept
    const real = readServices(tiles, world.proj, 1e9);
    const reach = AREA_SIZE_M / 2 - 8;
    world.services.push(...real.filter((r) => Math.abs(r.x) < reach && Math.abs(r.y) < reach), ...inventServices(real, world.proj, reach, roads));
    // the map puts such a place on its building: the symbol lies on the roof, where it can be seen
    for (const sv of world.services) signs.add(serviceSign(sv, (x, y) => surfaceY(model, x, y) + solids.tallestNear(x, y, 5) + 0.2));
    if (!world.sights.length) world.sights.push(...townSights(tiles, world.proj, AREA_SIZE_M / 2 - 8));
    return world;
  }

  /** Whether cars keep left here (Britain, Japan, Australia, India, southern Africa and so on). */
  get leftHand(): boolean {
    const { lat, lon } = this.centre;
    return LEFT_HAND.some(([s, w, n, e]) => lat >= s && lat <= n && lon >= w && lon <= e);
  }

  /**
   * Whether the map has little to show here: few buildings or few streets. The game runs, but
   * it is an empty place to play in.
   */
  get thin(): boolean {
    // streets with hardly a building along them are a place that is only half on the map
    return this.buildingCount < 150 || this.roads.streetKm < 8 || this.buildingCount / this.roads.streetKm < 4;
  }

  /** Scene height of the ground at a point. */
  groundY(x: number, y: number): number {
    return surfaceY(this.model, x, y);
  }

  /** Whether a point is in water with no road or bridge under it. */
  inWater(x: number, y: number): boolean {
    return this.water.at(x, y) && !this.roads.onRoad(x, y);
  }

  /** Whether a point is in a stream or ditch, with no road or bridge over it. A car gets through, slowly. */
  inStream(x: number, y: number): boolean {
    return this.streams.at(x, y) && !this.roads.onRoad(x, y);
  }

  /** Whether a circle is clear of buildings and water. */
  free(x: number, y: number, r: number): boolean {
    if (Math.abs(x) > this.half - 6 || Math.abs(y) > this.half - 6) return false;
    if (this.solids.inside(x, y) || this.water.at(x, y)) return false;
    const c = { x, y };
    return !this.solids.push(c, r);
  }

  /** Whether a position is far enough from the centre that the next square should load. */
  needsRecentre(x: number, y: number): LngLat | null {
    if (Math.hypot(x, y) <= RECENTRE_M) return null;
    const next = areaCentre(this.proj.toLngLat(x, y));
    if (World.allowed && !World.allowed.has(areaKey(next))) return null;
    return areaKey(next) === areaKey(this.centre) ? null : next;
  }

  dispose(): void {
    disposeRoadMeshes(this.ribbons);
    for (const m of this.signs.children as Mesh[]) m.geometry.dispose();
    this.model.dispose();
  }
}
