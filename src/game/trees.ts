/**
 * A trial: trees. Woods on the map were a flat green, parks the same, and the trees along streets
 * and in back yards were not there at all. Here trees stand in three kinds of place:
 *
 *  - in woods on the map, close together, a share of them firs;
 *  - in parks, gardens and cemeteries on the map, spread out;
 *  - (off for now) wherever ESA's WorldCover (10 m land cover from satellites, CC BY 4.0) sees tree
 *    cover and the map has no wood: street trees, back yards, the green between blocks. Those squares
 *    are baked beside the game (`tools/landcover-bake.mjs`).
 *
 * Never on a road or path (nor so close that the crown hangs over it), in a building, in water, on a
 * sports ground or a square. Each tree's spot and look come from where it stands on the earth, so a
 * tree is the same on every visit and in the next square. Its trunk is solid: a car bumps off it as
 * off a wall (a hard knock dents it, as a wall does), and people walk round it.
 *
 * The third kind (satellite tree cover) is off for now: see `SATELLITE_TREES`.
 *
 * `?try=notrees` leaves them out, to compare.
 */

import { CircleGeometry, Color, ConeGeometry, CylinderGeometry, MeshBasicMaterial, Group, DodecahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { AreaFeature } from '../geo/osm';
import type { LngLat, Projector } from '../geo/projection';
import { decodePng } from '../geo/png';
import { tilesForSquare } from '../geo/tiles';

export function treesWanted(): boolean {
  try {
    return !(new URLSearchParams(location.search).get('try') ?? '').split(',').includes('notrees');
  } catch {
    return true;
  }
}

/**
 * Trees from satellite land cover too, not only the map's woods and parks. Off: the whole world's
 * would need 40–100 GB hosted outside GitHub Pages (see docs/trees.md). With it on, squares baked
 * into public/landcover/ by tools/landcover-bake.mjs are used where they exist.
 */
export const SATELLITE_TREES = false;

/** WorldCover's class for tree cover */
const TREE_COVER = 10;
const LC_ZOOM = 14;

/** Land cover around a square, by class, from the baked squares beside the game; null where none is baked. */
export interface LandCover {
  at(lon: number, lat: number): number;
}

export async function loadLandCover(centre: LngLat, sizeM: number): Promise<LandCover | null> {
  const refs = tilesForSquare(centre, sizeM, LC_ZOOM);
  const tiles = await Promise.all(
    refs.map(async (r) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}landcover/${r.z}/${r.x}/${r.y}.png`);
        // a dev server answers a missing file with the page itself
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('png')) return null;
        const png = await decodePng(new Uint8Array(await res.arrayBuffer()));
        return png.channels === 1 ? { ...r, png } : null;
      } catch {
        return null;
      }
    }),
  );
  if (!tiles.some(Boolean)) return null;
  const byKey = new Map(tiles.filter((t) => t !== null).map((t) => [`${t.x}/${t.y}`, t]));
  const n = 2 ** LC_ZOOM;
  return {
    at(lon, lat) {
      const fx = ((lon + 180) / 360) * n;
      const s = Math.sin((lat * Math.PI) / 180);
      const fy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
      const t = byKey.get(`${Math.floor(fx)}/${Math.floor(fy)}`);
      if (!t) return 0;
      const px = Math.min(t.png.width - 1, Math.floor((fx - Math.floor(fx)) * t.png.width));
      const py = Math.min(t.png.height - 1, Math.floor((fy - Math.floor(fy)) * t.png.height));
      return t.png.data[py * t.png.width + px];
    },
  };
}

/** What the trees need to know about the square. */
export interface TreeSite {
  proj: Projector;
  half: number;
  areas: AreaFeature[];
  cover: LandCover | null;
  ground(x: number, y: number): number;
  onRoad(x: number, y: number): boolean;
  blocked(x: number, y: number): boolean;
}

/** a spot is tried on a grid this fine (m), fixed to the earth so neighbouring squares agree */
const STEP = 4;
/** chance a spot gets a tree: in a wood, in a park, where the satellites see trees */
const IN_WOOD = 0.2;
const IN_PARK = 0.07;
const IN_COVER = 0.3;
/** at most this many trees in a square, for slow phones */
const MAX_TREES = 9000;

function hash(a: number, b: number, salt: number): number {
  let h = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const PLACE_NONE = 0;
const PLACE_WOOD = 1;
const PLACE_PARK = 2;
const PLACE_OPEN = 3;
const PLACE_NEVER = 4;

/** The map's areas painted on a raster of the square: wood, park, never (squares, pitches, fields, sand). */
function placeRaster(areas: AreaFeature[], half: number, px: number): Uint8Array {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const s = px / (half * 2);
  ctx.setTransform(s, 0, 0, -s, half * s, half * s);
  ctx.imageSmoothingEnabled = false;
  const paint = (list: AreaFeature[], colour: string) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (const a of list)
      for (const p of a.polys)
        for (const ring of [p.outer, ...p.holes]) {
          if (ring.length < 3) continue;
          ctx.moveTo(ring[0][0], ring[0][1]);
          for (let k = 1; k < ring.length; k++) ctx.lineTo(ring[k][0], ring[k][1]);
          ctx.closePath();
        }
    ctx.fill('evenodd');
  };
  const PARKS = new Set<string | undefined>(['park', 'garden', 'cemetery', 'village_green', 'recreation_ground', undefined, '']);
  const OPEN = new Set<string | undefined>(['grass', 'meadow', 'heath', 'scrub', 'wetland', 'marsh', 'bog', 'fell']);
  // later paint wins: open grass, then parks, then woods, and last where no tree may stand
  paint(areas.filter((a) => a.kind === 'green' && OPEN.has(a.cls)), `rgb(${PLACE_OPEN},0,0)`);
  paint(areas.filter((a) => a.kind === 'green' && PARKS.has(a.cls)), `rgb(${PLACE_PARK},0,0)`);
  paint(areas.filter((a) => a.kind === 'forest'), `rgb(${PLACE_WOOD},0,0)`);
  paint(
    areas.filter((a) => a.kind === 'plaza' || a.kind === 'sand' || a.kind === 'farmland' || a.kind === 'water' || (a.kind === 'green' && (a.cls === 'pitch' || a.cls === 'stadium' || a.cls === 'playground' || a.cls === 'lawn'))),
    `rgb(${PLACE_NEVER},0,0)`,
  );
  const img = ctx.getImageData(0, 0, px, px).data;
  const out = new Uint8Array(px * px);
  for (let i = 0; i < out.length; i++) out[i] = img[i * 4];
  return out;
}

interface Tree {
  x: number;
  y: number;
  /** 0..1, from where it stands: size, colour and kind come from it */
  r1: number;
  r2: number;
  fir: boolean;
  /** how far its shadow patch may run from the foot of the trunk (m): it stops short of water, roads and walls */
  shade: number;
}

/** Where the trees of a square stand. */
export function placeTrees(site: TreeSite): Tree[] {
  const { proj, half } = site;
  const PX = 512;
  const places = placeRaster(site.areas, half, PX);
  const placeAt = (x: number, y: number) => {
    const i = Math.floor(((x + half) / (2 * half)) * PX);
    const j = Math.floor(((half - y) / (2 * half)) * PX);
    if (i < 0 || j < 0 || i >= PX || j >= PX) return PLACE_NONE;
    return places[j * PX + i];
  };
  // a grid in degrees, the same for every square in a band of latitude
  const c = proj.center;
  const dLat = STEP / 111320;
  const dLon = STEP / (111320 * Math.cos(((Math.floor(c.lat) + 0.5) * Math.PI) / 180));
  const sw = proj.toLngLat(-half, -half);
  const ne = proj.toLngLat(half, half);
  const i0 = Math.floor(sw.lon / dLon);
  const i1 = Math.ceil(ne.lon / dLon);
  const j0 = Math.floor(sw.lat / dLat);
  const j1 = Math.ceil(ne.lat / dLat);
  const out: Tree[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const roll = hash(i, j, 1);
      if (roll >= IN_WOOD) continue; // the highest chance there is: most spots end here
      const lon = (i + 0.15 + 0.7 * hash(i, j, 2)) * dLon;
      const lat = (j + 0.15 + 0.7 * hash(i, j, 3)) * dLat;
      const [x, y] = proj.toLocal(lon, lat);
      if (Math.abs(x) > half - 2 || Math.abs(y) > half - 2) continue;
      const place = placeAt(x, y);
      if (place === PLACE_NEVER) continue;
      let chance = 0;
      if (place === PLACE_WOOD) chance = IN_WOOD;
      else if (site.cover && site.cover.at(lon, lat) === TREE_COVER) chance = place === PLACE_OPEN ? IN_COVER / 2 : IN_COVER;
      else if (place === PLACE_PARK) chance = IN_PARK;
      if (roll >= chance) continue;
      out.push({ x, y, r1: hash(i, j, 4), r2: hash(i, j, 5), fir: place === PLACE_WOOD && hash(i, j, 6) < 0.3, shade: 0 });
    }
  }
  // the costly tests last, on the few spots left
  const kept = out.filter((t) => {
    const r = crownRadius(t) - 0.8;
    if (site.blocked(t.x, t.y)) return false;
    if (site.onRoad(t.x, t.y)) return false;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + t.r1;
      if (site.onRoad(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r)) return false;
      if (site.blocked(t.x + Math.cos(a) * r * 0.7, t.y + Math.sin(a) * r * 0.7)) return false;
    }
    return true;
  });
  // too many: keep a fair share everywhere, not the first ones
  const share = MAX_TREES / kept.length;
  const trees = kept.length <= MAX_TREES ? kept : kept.filter((t) => t.r2 < share);
  // The shadow patch lies flat at the height of the ground. Over a river the ground is cut away and the
  // water lies lower, so a patch reaching out over it hung in the air beside the bank (seen by the
  // Thames at Westminster). It ends before water, a road or a wall.
  for (const t of trees) {
    const full = shadeLength(t);
    let len = 0;
    while (len < full) {
      const d = Math.min(full, len + 1) / Math.SQRT2;
      if (site.blocked(t.x + d, t.y - d) || site.onRoad(t.x + d, t.y - d)) break;
      len = Math.min(full, len + 1);
    }
    t.shade = len;
  }
  return trees;
}

const crownRadius = (t: Tree) => (t.fir ? 2 + 1.3 * t.r1 : 2.6 + 2 * t.r1);
/** a round crown's height against its width */
const FLAT = 0.6;
/** a trunk, to bump into (m): wide enough that a car never slips through a tree */
export const TRUNK_R = 0.5;
/** the shadow patch's full length from the foot of the trunk along the sun (m) */
function shadeLength(t: Tree): number {
  const r = crownRadius(t) * (t.fir ? 0.8 : 1);
  const lift = t.fir ? treeHeight(t) * 0.4 : treeHeight(t) - crownRadius(t) * FLAT;
  return lift * SUN_RUN * Math.SQRT2 + r;
}
const treeHeight = (t: Tree) => (t.fir ? 8 + 5 * t.r2 : 5.5 + 3.5 * t.r2);

const LEAVES = ['#5f8f4a', '#6b9a50', '#55844a', '#7aa45a', '#4f7d43', '#668f3f'].map((c) => new Color(c));
const NEEDLES = ['#3f6b45', '#46744a', '#365f3e'].map((c) => new Color(c));

/** trees are drawn in patches this wide (m), so only the patches on screen (and in the sun's shadow box) are drawn */
const PATCH = 125;

/**
 * The trees of a square, as round crowns, firs, trunks and the shade beside them, in patches: one patch
 * is four draws, and those off screen are skipped. A tree throws no real shadow (that doubled the cost of
 * drawing it): a soft dark patch lies where its shadow would fall.
 */
export function treeMesh(trees: Tree[], ground: (x: number, y: number) => number): Group | null {
  if (!trees.length) return null;
  const group = new Group();
  group.name = 'trees';
  const patches = new Map<string, Tree[]>();
  for (const t of trees) {
    const k = `${Math.floor(t.x / PATCH)},${Math.floor(t.y / PATCH)}`;
    const list = patches.get(k);
    if (list) list.push(t);
    else patches.set(k, [t]);
  }
  for (const list of patches.values()) patchMesh(group, list, ground);
  return group;
}

const leafMat = new MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true });
const crownGeo = new DodecahedronGeometry(1, 0);
const firGeo = new ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
/** a soft dark patch on the ground where the tree's shadow falls: far cheaper than a real one */
const shadeGeo = new CircleGeometry(1, 10).rotateX(-Math.PI / 2);
/** a trunk: five sides, no ends, 10 triangles; it throws no shadow */
const trunkGeo = new CylinderGeometry(0.7, 1, 1, 5, 1, true).translate(0, 0.5, 0);
const trunkMat = new MeshStandardMaterial({ color: '#6b5440', roughness: 1, metalness: 0 });
const shadeMat = new MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
/** where the sun puts a shadow, per metre of height (the game's sun stands at -0.55, 0.78, -0.55) */
const SUN_RUN = 0.55 / 0.78;
/** shared by every square: a square's dispose must leave them be */
for (const g of [crownGeo, firGeo, shadeGeo, trunkGeo]) g.dispose = () => {};

function patchMesh(group: Group, trees: Tree[], ground: (x: number, y: number) => number): void {
  const round = trees.filter((t) => !t.fir);
  const firs = trees.filter((t) => t.fir);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const colour = new Color();
  if (round.length) {
    const crowns = new InstancedMesh(crownGeo, leafMat, round.length);
    round.forEach((t, k) => {
      const g = ground(t.x, t.y);
      const r = crownRadius(t);
      const h = treeHeight(t);
      q.setFromAxisAngle(up, t.r2 * Math.PI * 2);
      // a flat crown, much wider than high, as the map's style keeps things low
      m.compose(new Vector3(t.x, g + h - r * FLAT, -t.y), q, new Vector3(r, r * FLAT, r));
      crowns.setMatrixAt(k, m);
      colour.copy(LEAVES[Math.floor(t.r1 * 977) % LEAVES.length]).offsetHSL(0, 0, (t.r2 - 0.5) * 0.06);
      crowns.setColorAt(k, colour);
    });
    group.add(crowns);
  }
  if (firs.length) {
    const cones = new InstancedMesh(firGeo, leafMat, firs.length);
    firs.forEach((t, k) => {
      const g = ground(t.x, t.y);
      const r = crownRadius(t);
      const h = treeHeight(t);
      q.setFromAxisAngle(up, t.r2 * Math.PI * 2);
      m.compose(new Vector3(t.x, g + h * 0.15, -t.y), q, new Vector3(r, h * 0.62, r));
      cones.setMatrixAt(k, m);
      colour.copy(NEEDLES[Math.floor(t.r1 * 977) % NEEDLES.length]);
      cones.setColorAt(k, colour);
    });
    group.add(cones);
  }
  const trunks = new InstancedMesh(trunkGeo, trunkMat, trees.length);
  trees.forEach((t, k) => {
    const g = ground(t.x, t.y);
    // up into the middle of the crown, so no gap shows between them from any side
    const top = t.fir ? treeHeight(t) * 0.3 : treeHeight(t) - crownRadius(t) * FLAT;
    const w = t.fir ? 0.3 : 0.28 + 0.12 * t.r1;
    m.compose(new Vector3(t.x, g - 0.2, -t.y), q.identity(), new Vector3(w, top + 0.2, w));
    trunks.setMatrixAt(k, m);
  });
  group.add(trunks);
  const shades = new InstancedMesh(shadeGeo, shadeMat, trees.length);
  // The shadow runs from the foot of the trunk to where the crown's shadow falls, as one long patch:
  // a patch only where the crown's shadow falls lay apart from the tree, and the tree seemed to float.
  const along = new Quaternion().setFromAxisAngle(up, -Math.PI / 4);
  trees.forEach((t, k) => {
    const r = crownRadius(t) * (t.fir ? 0.8 : 1);
    // from just behind the trunk to as far as the shadow may run; never wider than it is long
    const half = (t.shade + 0.6) / 2;
    const mid = half - 0.6;
    const sx = t.x + mid / Math.SQRT2;
    const sy = t.y - mid / Math.SQRT2;
    m.compose(new Vector3(sx, ground(sx, sy) + 0.12, -sy), along, new Vector3(half, 1, Math.min(r, half)));
    shades.setMatrixAt(k, m);
  });
  shades.renderOrder = 1;
  group.add(shades);
  for (const mesh of group.children as InstancedMesh[]) {
    mesh.computeBoundingSphere();
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
