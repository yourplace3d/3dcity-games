/**
 * A subway entrance as it looks from above: a stairwell going down into the ground, a low wall on
 * three sides, and a sign on a post at the open end.
 *
 * The stairwell is a picture, not a hole: steps that grow darker towards the far end read as going
 * down. The sign is the game's own: a white letter on a blue disc. The letter follows what such
 * signs carry in that part of the world, "U" in Germany and Austria and "M" elsewhere. No
 * operator's own symbol is drawn.
 */

import { BoxGeometry, CanvasTexture, CircleGeometry, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three';

/** the stairwell on the ground: width and length (m) */
const WELL_W = 3.4;
const WELL_L = 7;
const WALL_H = 1.1;
const SIGN_UP = 3.4;
const SIGN_R = 1.7;

/** "U" where the signs say U-Bahn, "M" elsewhere. Rough boxes: Germany and Austria, without Bohemia. */
export function subwayLetter(lat: number, lon: number): 'U' | 'M' {
  const germany = lat > 47.3 && lat < 55.1 && lon > 5.9 && lon < 15;
  const austria = lat > 46.4 && lat < 49 && lon > 9.5 && lon < 17.2;
  const bohemia = lon > 12.2 && lat > 48.6 && lat < 50.75;
  return (germany || austria) && !bohemia ? 'U' : 'M';
}

const icons = new Map<string, HTMLCanvasElement>();

/** The sign: a white letter on a blue disc with a dark rim. Also drawn on the maps. */
export function subwayIcon(letter: 'U' | 'M'): HTMLCanvasElement {
  const had = icons.get(letter);
  if (had) return had;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fillStyle = '#16181c';
  g.fill();
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fillStyle = '#1f6fd6';
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '900 78px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 69);
  icons.set(letter, c);
  return c;
}

let stairs: CanvasTexture | null = null;

/** Steps seen from above: light at the top of the stairs, dark at the bottom. */
function stairsTexture(): CanvasTexture {
  if (stairs) return stairs;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const v = Math.round(168 - t * 140);
    g.fillStyle = `rgb(${v},${v},${Math.round(v * 1.06)})`;
    g.fillRect(0, (i * c.height) / steps, c.width, c.height / steps + 1);
    // the edge of each step
    g.fillStyle = `rgba(0,0,0,${0.25 + t * 0.2})`;
    g.fillRect(0, (i * c.height) / steps, c.width, 2);
  }
  stairs = new CanvasTexture(c);
  stairs.colorSpace = SRGBColorSpace;
  return stairs;
}

const wallMat = new MeshStandardMaterial({ color: '#8d9198', roughness: 0.8 });
const postMat = new MeshStandardMaterial({ color: '#3a3e45', roughness: 0.7 });
const signMats = new Map<string, MeshBasicMaterial>();
let wellMat: MeshBasicMaterial | null = null;

export interface EntranceSpot {
  x: number;
  y: number;
  /** the ground to stand on (scene height) */
  ground: number;
  /** the direction of the street beside it (radians, east = 0, north = π/2): the stairs run along it */
  heading: number;
}

const UP = new Vector3(0, 1, 0);
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/**
 * All the entrances of a square, drawn as a few shapes repeated: one draw for all the stairwells,
 * one for all the walls, one for the posts and one for the signs, however many entrances there are.
 */
export function subwayEntrances(spots: EntranceSpot[], letter: 'U' | 'M'): Group {
  const g = new Group();
  const n = spots.length;
  if (!n) return g;
  wellMat ??= new MeshBasicMaterial({ map: stairsTexture() });
  let signMat = signMats.get(letter);
  if (!signMat) {
    const map = new CanvasTexture(subwayIcon(letter));
    map.colorSpace = SRGBColorSpace;
    signMats.set(letter, (signMat = new MeshBasicMaterial({ map, transparent: true, side: DoubleSide })));
  }
  const make = (geo: PlaneGeometry | BoxGeometry | CircleGeometry, mat: MeshBasicMaterial | MeshStandardMaterial, count: number, shadow: boolean) => {
    const mesh = new InstancedMesh(geo, mat, count);
    mesh.castShadow = shadow;
    // the entrances lie all over the square: never left out as "out of view" by the first one's place
    mesh.frustumCulled = false;
    g.add(mesh);
    return mesh;
  };
  const wells = make(new PlaneGeometry(1, 1), wellMat, n, false);
  const walls = make(new BoxGeometry(1, 1, 1), wallMat, n * 3, true);
  const posts = make(new BoxGeometry(1, 1, 1), postMat, n, true);
  const discs = make(new CircleGeometry(1, 28), signMat, n, false);
  const m = new Matrix4();
  const q = new Quaternion();
  const turn = new Quaternion();
  const p = new Vector3();
  const size = new Vector3();
  spots.forEach((s, i) => {
    // the stairwell's long side lies along scene z; a heading of 0 (east) is scene x
    const rot = s.heading - Math.PI / 2;
    turn.setFromAxisAngle(UP, rot);
    /** A spot of the entrance in the scene: `across` and `along` are metres in the stairwell's own frame. */
    const at = (across: number, up: number, along: number) => p.set(across, 0, along).applyQuaternion(turn).add(new Vector3(s.x, s.ground + up, -s.y));
    wells.setMatrixAt(i, m.compose(at(0, 0.12, 0), q.copy(turn).multiply(FLAT), size.set(WELL_W, WELL_L, 1)));
    // the two long sides and the deep end; the top of the stairs stays open
    walls.setMatrixAt(i * 3, m.compose(at(-WELL_W / 2 - 0.15, WALL_H / 2, 0), turn, size.set(0.3, WALL_H, WELL_L)));
    walls.setMatrixAt(i * 3 + 1, m.compose(at(WELL_W / 2 + 0.15, WALL_H / 2, 0), turn, size.set(0.3, WALL_H, WELL_L)));
    walls.setMatrixAt(i * 3 + 2, m.compose(at(0, WALL_H / 2, WELL_L / 2 + 0.15), turn, size.set(WELL_W + 0.6, WALL_H, 0.3)));
    // the sign: a post beside the open end, and the disc lying flat on top, its letter upright on the screen
    posts.setMatrixAt(i, m.compose(at(WELL_W / 2 + 1.2, SIGN_UP / 2, -WELL_L / 2 - 0.6), turn, size.set(0.22, SIGN_UP, 0.22)));
    discs.setMatrixAt(i, m.compose(at(WELL_W / 2 + 1.2, SIGN_UP + 0.05, -WELL_L / 2 - 0.6), FLAT, size.set(SIGN_R, SIGN_R, 1)));
  });
  return g;
}
