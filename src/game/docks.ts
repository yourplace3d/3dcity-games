/**
 * Piers and wharves as decks over the water. The map draws them as outlines that the game used to
 * leave out, so a marina was water crossed by footpaths that looked like little streets, and a pier
 * with a road on it was a road on the water.
 *
 * A narrow pier becomes a wooden deck with planks across it; a wide one (a wharf, often with
 * buildings and a road) a pale stone quay. Both lie on the ground under them with a dark rim, and
 * both can be walked and driven on: what stands on them (streets, cars, people) is drawn on that
 * ground, so a deck raised above it would hide them. The ground under a landing stage slopes down
 * the river bank, so a deck follows it in small pieces, as the streets do.
 *
 * All the decks of a square are one shape and one draw.
 */

import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial, ShapeUtils, Vector2 } from 'three';
import type { AreaFeature } from '../geo/osm';
import type { Polygon, Ring } from '../geo/polygon';
import { asRect, bounds } from './pitches';

/** wider than this (m) in both directions, it is a quay, not a wooden pier */
const WIDE_M = 22;
/** the dark rim round a deck (m) */
const RIM = 0.6;

export interface Deck {
  poly: Polygon;
  quay: boolean;
}

const ringArea = (r: Ring): number => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

/** Takes the piers out of the areas, so that they are not painted on the ground, and hands them back. */
export function takeDecks(areas: AreaFeature[]): Deck[] {
  const decks: Deck[] = [];
  for (const a of areas) {
    if (a.cls !== 'pier') continue;
    for (const poly of a.polys) {
      if (poly.outer.length < 3 || Math.abs(ringArea(poly.outer)) < 8) continue;
      const r = asRect(poly.outer);
      const [x0, y0, x1, y1] = bounds(poly.outer);
      const narrow = r ? r.hw * 2 : Math.min(x1 - x0, y1 - y0);
      decks.push({ poly, quay: narrow > WIDE_M });
    }
    a.polys = [];
  }
  return decks;
}

const WOOD = new Color('#b08a5e');
const WOOD_SEAM = new Color('#8f6d47');
const WOOD_SIDE = new Color('#5e4630');
const STONE = new Color('#d9d2c3');
const STONE_SIDE = new Color('#8f887a');

/**
 * The decks of a square as one shape. `ground` gives the height of the ground (or the water) at a spot.
 */
export function deckMesh(decks: Deck[], ground: (x: number, y: number) => number): Mesh | null {
  if (!decks.length) return null;
  const pos: number[] = [];
  const col: number[] = [];
  /**
   * A triangle on the ground, `up` above it. Where the ground under it bends, it is cut in four,
   * down to pieces 3 m a side; where the ground is flat (open water, a level quay) it stays whole.
   */
  const tri = (a: number[], b: number[], c: number[], k: Color, up: number) => {
    const long = Math.max(Math.hypot(a[0] - b[0], a[2] - b[2]), Math.hypot(b[0] - c[0], b[2] - c[2]), Math.hypot(c[0] - a[0], c[2] - a[2]));
    const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, 0, (p[2] + q[2]) / 2];
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    const ga = ground(a[0], a[2]);
    const gb = ground(b[0], b[2]);
    const gc = ground(c[0], c[2]);
    const bend = Math.max(
      Math.abs(ground(ab[0], ab[2]) - (ga + gb) / 2),
      Math.abs(ground(bc[0], bc[2]) - (gb + gc) / 2),
      Math.abs(ground(ca[0], ca[2]) - (gc + ga) / 2),
      Math.abs(ground((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3) - (ga + gb + gc) / 3),
    );
    if (long > 3 && bend > 0.04) {
      tri(a, ab, ca, k, up);
      tri(ab, b, bc, k, up);
      tri(ca, bc, c, k, up);
      tri(ab, bc, ca, k, up);
      return;
    }
    for (const [p, g] of [[a, ga], [b, gb], [c, gc]] as Array<[number[], number]>) {
      pos.push(p[0], g + up, -p[2]);
      col.push(k.r, k.g, k.b);
    }
  };
  for (const d of decks) {
    const { outer, holes } = d.poly;
    const top = 0.06;
    const ccw = ringArea(outer) > 0 ? outer : [...outer].reverse();
    const cw = holes.filter((h) => h.length >= 3).map((h) => (ringArea(h) < 0 ? h : [...h].reverse()));
    const all = [...ccw, ...cw.flat()];
    const face = d.quay ? STONE : WOOD;
    for (const f of ShapeUtils.triangulateShape(ccw.map((p) => new Vector2(p[0], p[1])), cw.map((h) => h.map((p) => new Vector2(p[0], p[1]))))) {
      const [p, q, r] = [all[f[0]], all[f[1]], all[f[2]]];
      tri([p[0], 0, p[1]], [q[0], 0, q[1]], [r[0], 0, r[1]], face, top);
    }
    // the rim: a dark band just inside the edge
    const side = d.quay ? STONE_SIDE : WOOD_SIDE;
    const rim = top + 0.02;
    for (let i = 0; i < ccw.length; i++) {
      const a = ccw[i];
      const b = ccw[(i + 1) % ccw.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.1) continue;
      // inward, for a ring that runs anticlockwise
      const nx = (-(b[1] - a[1]) / len) * RIM;
      const ny = ((b[0] - a[0]) / len) * RIM;
      tri([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0] + nx, 0, b[1] + ny], side, rim);
      tri([a[0], 0, a[1]], [b[0] + nx, 0, b[1] + ny], [a[0] + nx, 0, a[1] + ny], side, rim);
    }
    // planks across a wooden pier: a seam every metre
    const r = !d.quay && asRect(outer);
    if (r) {
      const seam = top + 0.02;
      for (let a = -r.hl + 1; a < r.hl; a += 1) {
        const p = (b: number, da: number): [number, number] => [r.cx + (a + da) * r.ux - b * r.uy, r.cy + (a + da) * r.uy + b * r.ux];
        const [p0, p1, p2, p3] = [p(-r.hw, 0), p(-r.hw, 0.08), p(r.hw, 0.08), p(r.hw, 0)];
        tri([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p2[0], 0, p2[1]], WOOD_SEAM, seam);
        tri([p0[0], 0, p0[1]], [p2[0], 0, p2[1]], [p3[0], 0, p3[1]], WOOD_SEAM, seam);
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.computeVertexNormals();
  const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: 2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  mesh.receiveShadow = true;
  return mesh;
}
