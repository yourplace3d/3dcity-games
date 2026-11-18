/**
 * Bus and tram stops as things you can recognise from above: a bus stop is a small shelter with a
 * sign on a post, a tram stop a platform beside the track with the same kind of sign.
 *
 * For now the sign is the same everywhere: a white bus on a blue disc, a white tram on a red one,
 * the game's own drawings. A sign by country is prepared (`stopSign`, the green H on yellow of
 * Germany, Austria and Switzerland) and not switched on: only a country's public road sign for a
 * stop would be used, never an operator's own symbol.
 *
 * All the stops of a square are drawn as a handful of shapes repeated (one draw for all the
 * roofs, one for all the posts, and so on), so a town with two hundred stops costs no more to
 * draw than one with ten.
 */

import { BoxGeometry, CanvasTexture, CircleGeometry, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3 } from 'three';

export type StopSign = 'H' | 'picture';

/** Which sign a stop carries at a place on the earth. Rough boxes. */
export function stopSign(lat: number, lon: number): StopSign {
  const germany = lat > 47.3 && lat < 55.1 && lon > 5.9 && lon < 15;
  const austria = lat > 46.4 && lat < 49 && lon > 9.5 && lon < 17.2;
  const switzerland = lat > 45.8 && lat < 47.8 && lon > 5.9 && lon < 10.5;
  const bohemia = lon > 12.2 && lat > 48.6 && lat < 50.75;
  return (germany || austria || switzerland) && !bohemia ? 'H' : 'picture';
}

const icons = new Map<string, HTMLCanvasElement>();

/** The sign of a bus or tram stop, as a picture: also what the maps could show. */
export function stopIcon(kind: 'bus' | 'tram', sign: StopSign): HTMLCanvasElement {
  const key = kind + sign;
  const had = icons.get(key);
  if (had) return had;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const disc = (r: number, fill: string) => {
    g.beginPath();
    g.arc(64, 64, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  };
  disc(62, '#16181c');
  if (sign === 'H') {
    disc(54, '#1f7a3a');
    disc(42, '#ffd400');
    g.fillStyle = '#1f7a3a';
    g.font = '900 64px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('H', 64, 68);
  } else {
    disc(54, kind === 'bus' ? '#2563b8' : '#b8323a');
    g.fillStyle = '#ffffff';
    if (kind === 'bus') {
      // a bus from the side: a body, windows, two wheels
      g.fillRect(30, 44, 68, 36);
      g.fillStyle = '#2563b8';
      for (let i = 0; i < 4; i++) g.fillRect(35 + i * 15, 50, 11, 12);
      g.fillStyle = '#ffffff';
      for (const x of [46, 82]) {
        g.beginPath();
        g.arc(x, 84, 8, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // a tram from the front: a body, a window, the bow to the wire
      g.fillRect(42, 46, 44, 44);
      g.fillStyle = '#b8323a';
      g.fillRect(49, 53, 30, 16);
      g.fillStyle = '#ffffff';
      g.fillRect(62, 30, 4, 16);
      g.fillRect(48, 28, 32, 4);
    }
  }
  icons.set(key, c);
  return c;
}

export interface StopSpot {
  kind: 'bus' | 'tram';
  x: number;
  y: number;
  /** the ground to stand on (scene height) */
  ground: number;
  /** the direction of the street or track beside it (radians, east = 0) */
  heading: number;
  /** which side of the street it is on: 1 to the left of the heading, -1 to the right */
  side: 1 | -1;
}

const roofMat = new MeshStandardMaterial({ color: '#a9bcc6', roughness: 0.5, metalness: 0.1 });
const wallMat = new MeshStandardMaterial({ color: '#4a4f57', roughness: 0.8 });
const slabMat = new MeshStandardMaterial({ color: '#aab3bd', roughness: 0.9 });
const postMat = new MeshStandardMaterial({ color: '#3a3e45', roughness: 0.7 });
const discMats = new Map<string, MeshBasicMaterial>();

function discMat(kind: 'bus' | 'tram', sign: StopSign): MeshBasicMaterial {
  const key = kind + sign;
  let m = discMats.get(key);
  if (!m) {
    const map = new CanvasTexture(stopIcon(kind, sign));
    map.colorSpace = SRGBColorSpace;
    discMats.set(key, (m = new MeshBasicMaterial({ map, transparent: true, side: DoubleSide })));
  }
  return m;
}

const UP = new Vector3(0, 1, 0);
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/** All the bus and tram stops of a square. */
export function stopShapes(spots: StopSpot[], sign: StopSign): Group {
  const g = new Group();
  const bus = spots.filter((s) => s.kind === 'bus');
  const tram = spots.filter((s) => s.kind === 'tram');
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const size = new Vector3();
  /** Put one box or disc of a stop in its place: `along`, `out` and `up` are metres from the stop's own spot. */
  const place = (mesh: InstancedMesh, i: number, s: StopSpot, along: number, out: number, up: number, sx: number, sy: number, sz: number, flat = false) => {
    const hx = Math.cos(s.heading);
    const hy = Math.sin(s.heading);
    // to the left of the heading is (-hy, hx)
    const x = s.x + hx * along - hy * out * s.side;
    const y = s.y + hy * along + hx * out * s.side;
    p.set(x, s.ground + up, -y);
    if (flat) q.copy(FLAT);
    else q.setFromAxisAngle(UP, s.heading);
    size.set(sx, sy, sz);
    mesh.setMatrixAt(i, m.compose(p, q, size));
  };
  const make = (geo: BoxGeometry | CircleGeometry, mat: MeshStandardMaterial | MeshBasicMaterial, n: number, shadow: boolean) => {
    const mesh = new InstancedMesh(geo, mat, n);
    mesh.castShadow = shadow;
    // the stops lie all over the square: never left out as "out of view" by the first one's place
    mesh.frustumCulled = false;
    g.add(mesh);
    return mesh;
  };

  if (bus.length) {
    const roofs = make(new BoxGeometry(1, 1, 1), roofMat, bus.length, true);
    const walls = make(new BoxGeometry(1, 1, 1), wallMat, bus.length, true);
    const posts = make(new BoxGeometry(1, 1, 1), postMat, bus.length, true);
    const discs = make(new CircleGeometry(1, 24), discMat('bus', sign), bus.length, false);
    bus.forEach((s, i) => {
      // the shelter stands back from the kerb, its open side to the street
      place(roofs, i, s, 0, 1.3, 2.5, 4.2, 0.14, 1.7);
      place(walls, i, s, 0, 2.05, 1.2, 4.2, 2.4, 0.12);
      place(posts, i, s, 3, 0.5, 1.6, 0.18, 3.2, 0.18);
      place(discs, i, s, 3, 0.5, 3.25, 1.05, 1.05, 1, true);
    });
  }
  if (tram.length) {
    const slabs = make(new BoxGeometry(1, 1, 1), slabMat, tram.length, false);
    const posts = make(new BoxGeometry(1, 1, 1), postMat, tram.length, true);
    const discs = make(new CircleGeometry(1, 24), discMat('tram', sign), tram.length, false);
    tram.forEach((s, i) => {
      // a platform along the track, a step up from the street
      place(slabs, i, s, 0, 2.6, 0.14, 13, 0.28, 2.4);
      place(posts, i, s, 5.5, 3.2, 1.6, 0.18, 3.2, 0.18);
      place(discs, i, s, 5.5, 3.2, 3.25, 1.05, 1.05, 1, true);
    });
  }
  return g;
}
