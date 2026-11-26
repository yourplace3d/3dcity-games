/**
 * Roads, water and green areas are painted into one canvas texture draped over
 * the terrain. Rasterising keeps them perfectly glued to the ground at any
 * exaggeration, costs no extra triangles, and makes toggling a layer a redraw.
 */

import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import type { AreaFeature, AreaKind, FeatureSet, LineFeature, LineKind } from '../geo/osm';
import type { SeaMask } from '../geo/sea';
import type { Polygon } from '../geo/polygon';
import type { Layers } from '../state';
import type { GroundPainter } from '../data/types';

export const PALETTE = {
  ground: '#ebe6dc',
  farmland: '#e5e0cd',
  green: '#cbd7b6',
  forest: '#b4c69c',
  sand: '#ede0c0',
  plaza: '#f5f2eb',
  water: '#a9c5d6',
  roadFill: '#fbfaf6',
  // a clear edge: white roads on the beige ground were hard to see from a distance
  roadCasing: '#998c76',
  path: '#f6f2ea',
  rail: '#8e877b',
  // land the map knows but that used to be plain ground or plain green (`landCoverOn`)
  rock: '#d9d4cb',
  ice: '#f5f8f9',
  wetland: '#c4d6c9',
  heath: '#dcd8c0',
  scrub: '#c0cea8',
  orchard: '#d9dfc2',
  vineyard: '#e2dec6',
  /** the rows of an orchard or a vineyard */
  rows: '#bccaa4',
  town: '#ede6db',
  shops: '#efe2dc',
  industry: '#e3e1de',
  civic: '#f0e9d4',
  quarry: '#ddd4c4',
  // the ground's own lie (`relief.ts`): steep slopes are bare, cliffs darker, high tops under snow
  slope: '#bdbdb8',
  cliff: '#8a8884',
  snow: '#fbfcfd',
};

/**
 * 'lawn' is green that is grass itself (a lawn, a meadow), as against a park or garden around it.
 * Mappers often draw a square (Berlin's Rathausforum) over the lawns in it without cutting them out:
 * painted under the square, only the bits of lawn sticking out of it showed, as odd triangles.
 * A park is still painted under the square, so a square in a park stays a square.
 *
 * The rest past 'sand' are the finer kinds of land (`landCoverOn`): what a part of town is used for,
 * under everything else, and wetland, heath, scrub, orchards, vineyards, rock and glaciers.
 */
type PaintKind =
  | AreaKind
  | 'lawn'
  | 'town'
  | 'shops'
  | 'industry'
  | 'civic'
  | 'quarry'
  | 'orchard'
  | 'vineyard'
  | 'heath'
  | 'scrub'
  | 'wetland';
const AREA_ORDER: PaintKind[] = ['town', 'shops', 'industry', 'civic', 'quarry', 'farmland', 'orchard', 'vineyard', 'heath', 'green', 'scrub', 'wetland', 'rock', 'ice', 'forest', 'sand', 'plaza', 'lawn', 'water'];
/**
 * The kinds painted before the ground's own lie (slopes, cliffs, snow); those after it lie on top.
 * A wood stays a wood on a steep slope: trees grow there, grass and fields give way to bare ground.
 * Beaches are flat, and were always painted over woods.
 */
const UNDER_RELIEF = new Set<PaintKind>(['town', 'shops', 'industry', 'civic', 'quarry', 'farmland', 'orchard', 'vineyard', 'heath', 'green', 'scrub', 'wetland', 'rock', 'ice']);
const LAWNS = new Set(['grass', 'meadow', 'grassland', 'flowerbed', 'village_green']);
const WET = new Set(['wetland', 'marsh', 'swamp', 'bog', 'reedbed', 'wet_meadow', 'saltmarsh', 'tidalflat', 'mangrove', 'saltern']);
const HEATH = new Set(['heath', 'fell', 'tundra']);
const TOWN: Record<string, PaintKind> = {
  residential: 'town',
  commercial: 'shops',
  retail: 'shops',
  industrial: 'industry',
  railway: 'industry',
  quarry: 'quarry',
  school: 'civic',
  university: 'civic',
  college: 'civic',
  kindergarten: 'civic',
  hospital: 'civic',
};

/**
 * The finer kinds of land: on unless the link has `?try=plainland` (the ground as it was, to compare).
 * Off, rock, ice and the parts of town are not painted and the rest is painted as before.
 */
export function landCoverOn(): boolean {
  try {
    return !(new URLSearchParams(location.search).get('try') ?? '').split(',').includes('plainland');
  } catch {
    return true;
  }
}

export const paintKind = (a: AreaFeature, fine = true): PaintKind | null => {
  if (a.kind === 'built') return fine ? (TOWN[a.cls ?? ''] ?? null) : null;
  if ((a.kind === 'rock' || a.kind === 'ice') && !fine) return null;
  if (a.kind === 'green' && a.cls && LAWNS.has(a.cls)) return 'lawn';
  if (!fine) return a.kind;
  if (a.kind === 'green') {
    if (a.cover === 'wetland' || (a.cls && WET.has(a.cls))) return 'wetland';
    if (a.cls === 'scrub') return 'scrub';
    if (a.cls && HEATH.has(a.cls)) return 'heath';
  }
  if (a.kind === 'farmland' && a.cls === 'orchard') return 'orchard';
  if (a.kind === 'farmland' && a.cls === 'vineyard') return 'vineyard';
  return a.kind;
};
const AREA_LAYER: Record<PaintKind, keyof Layers> = {
  farmland: 'green',
  green: 'green',
  lawn: 'green',
  forest: 'green',
  sand: 'green',
  plaza: 'roads',
  water: 'water',
  rock: 'green',
  ice: 'green',
  built: 'green',
  town: 'green',
  shops: 'green',
  industry: 'green',
  civic: 'green',
  quarry: 'green',
  orchard: 'green',
  vineyard: 'green',
  heath: 'green',
  scrub: 'green',
  wetland: 'green',
};

const ROAD_RANK: Record<LineKind, number> = {
  path: 0,
  service: 1,
  minor: 2,
  tertiary: 3,
  secondary: 4,
  primary: 5,
  motorway: 6,
  rail: 7,
  stream: -1,
  canal: -1,
  river: -1,
};

export class Overlay {
  readonly canvas: HTMLCanvasElement;
  readonly texture: CanvasTexture;
  private seaLayer: HTMLCanvasElement | null = null;
  /** data layers painted on top of the map (a route), in local metres */
  painters: GroundPainter[] = [];
  /**
   * Water drawn as a shape of its own (the game's `river.ts`): cut out of the picture, leaving it
   * see-through there, so the ground drawn with it has a hole for the water below.
   */
  cut: Polygon[] | null = null;
  /**
   * The ground's own lie (`relief.ts`): a small picture, row 0 at the north, a pixel for each point of
   * the height grid, `spanM` across from the middle of the first point to the middle of the last.
   */
  relief: { image: CanvasImageSource; spanM: number; px: number } | null = null;
  private patterns = new Map<string, CanvasPattern | null>();

  constructor(readonly px: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px;
    this.canvas.height = px;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.generateMipmaps = true;
    this.draw(null, 1000, { roads: true, water: true, green: true });
  }

  /** Pre-render the sea mask once; draw() composites it under the water layer. */
  setSea(mask: SeaMask | null): void {
    if (!mask) {
      this.seaLayer = null;
      return;
    }
    const c = document.createElement('canvas');
    c.width = mask.px;
    c.height = mask.px;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(mask.px, mask.px);
    const [r, g, b] = hexToRgb(PALETTE.water);
    for (let i = 0; i < mask.data.length; i++) {
      if (!mask.data[i]) continue;
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.seaLayer = c;
  }

  draw(features: FeatureSet | null, sizeM: number, layers: Layers): void {
    const ctx = this.canvas.getContext('2d')!;
    const W = this.px;
    const s = W / sizeM;
    const h = sizeM / 2;
    ctx.save();
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, W, W);
    if (!features) {
      this.paintData(ctx, sizeM);
      ctx.restore();
      this.texture.needsUpdate = true;
      return;
    }
    if (this.seaLayer && layers.water) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.seaLayer, 0, 0, W, W);
    }
    // local (E, N) metres → canvas pixels (north up)
    ctx.setTransform(s, 0, 0, -s, h * s, h * s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const fine = landCoverOn();
    const byKind = new Map<PaintKind, AreaFeature[]>();
    for (const a of features.areas) {
      const k = paintKind(a, fine);
      if (!k) continue;
      const arr = byKind.get(k);
      if (arr) arr.push(a);
      else byKind.set(k, [a]);
    }
    let reliefDone = false;
    for (const kind of AREA_ORDER) {
      if (!reliefDone && !UNDER_RELIEF.has(kind)) {
        reliefDone = true;
        this.paintRelief(ctx, sizeM, layers);
      }
      if (!layers[AREA_LAYER[kind]]) continue;
      const list = byKind.get(kind);
      if (!list) continue;
      ctx.beginPath();
      for (const a of list) {
        for (const p of a.polys) {
          traceRing(ctx, p.outer);
          for (const hole of p.holes) traceRing(ctx, hole);
        }
      }
      // outers are counter-clockwise and holes clockwise, so nonzero keeps holes open while
      // overlapping areas of the same kind (a park on grass) stay filled; evenodd would punch them out
      ctx.fillStyle = PALETTE[kind === 'lawn' ? 'green' : (kind as keyof typeof PALETTE)] ?? PALETTE.ground;
      ctx.fill('nonzero');
      if (kind === 'orchard' || kind === 'vineyard' || kind === 'wetland' || kind === 'quarry' || kind === 'rock') {
        const pattern = this.texture_(ctx, kind, s);
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fill('nonzero');
        }
      }
    }

    const minW = 0.8 / s; // keep thin lines at least ~0.8 px wide
    if (layers.water) {
      ctx.strokeStyle = PALETTE.water;
      for (const l of features.lines) {
        if (ROAD_RANK[l.kind] >= 0) continue;
        strokeLine(ctx, l, Math.max(l.widthM, minW));
      }
    }

    if (layers.roads) {
      const roads = features.lines.filter((l) => ROAD_RANK[l.kind] >= 0 && l.kind !== 'rail').sort((a, b) => ROAD_RANK[a.kind] - ROAD_RANK[b.kind]);
      // paths: no casing
      ctx.strokeStyle = PALETTE.path;
      for (const l of roads) if (l.kind === 'path') strokeLine(ctx, l, Math.max(l.widthM, minW));
      // casings first, then fills, so junctions merge cleanly
      const vehicular = roads.filter((l) => l.kind !== 'path');
      const casing = Math.max(4, 3 / s);
      ctx.strokeStyle = PALETTE.roadCasing;
      for (const l of vehicular) strokeLine(ctx, l, Math.max(l.widthM, minW) + casing);
      ctx.strokeStyle = PALETTE.roadFill;
      for (const l of vehicular) strokeLine(ctx, l, Math.max(l.widthM, minW));
      ctx.strokeStyle = PALETTE.rail;
      for (const l of features.lines) if (l.kind === 'rail') strokeLine(ctx, l, Math.max(l.widthM * 0.6, minW));
    }
    if (this.cut?.length && layers.water) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      for (const p of this.cut) for (const r of [p.outer, ...p.holes]) traceRing(ctx, r);
      ctx.fill('nonzero');
      ctx.globalCompositeOperation = 'source-over';
    }
    this.paintData(ctx, sizeM);
    ctx.restore();
    this.texture.needsUpdate = true;
  }

  /** Slopes, cliffs and snow, over the land and under squares, water and roads. */
  private paintRelief(ctx: CanvasRenderingContext2D, sizeM: number, layers: Layers): void {
    const r = this.relief;
    if (!r || !layers.green) return;
    const s = this.px / sizeM;
    // a pixel of the small picture stands for the ground around its point: half a step past the edge points
    const step = r.spanM / (r.px - 1);
    const across = (r.spanM + step) * s;
    const x0 = (sizeM / 2 - r.spanM / 2 - step / 2) * s;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(r.image, x0, x0, across, across);
    ctx.restore();
  }

  /** The small repeated marks of some kinds of land: rows of trees and vines, reeds, stones. */
  private texture_(ctx: CanvasRenderingContext2D, kind: PaintKind, s: number): CanvasPattern | null {
    const key = `${kind}|${s.toFixed(3)}|${PALETTE.rows}|${PALETTE.cliff}|${PALETTE.wetland}`;
    if (this.patterns.has(key)) return this.patterns.get(key)!;
    // the size of the repeat, in metres
    const tileM = kind === 'orchard' ? 6 : kind === 'vineyard' ? 2.5 : kind === 'wetland' ? 4 : 3;
    const n = Math.max(4, Math.round(tileM * s));
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const g = c.getContext('2d');
    let pattern: CanvasPattern | null = null;
    if (g) {
      const u = n / tileM; // pixels a metre
      if (kind === 'orchard') {
        g.fillStyle = PALETTE.rows;
        g.beginPath();
        g.arc(n / 2, n / 2, Math.max(1, 1.6 * u), 0, Math.PI * 2);
        g.fill();
      } else if (kind === 'vineyard') {
        g.fillStyle = PALETTE.rows;
        g.fillRect(0, 0, n, Math.max(1, 0.8 * u));
      } else if (kind === 'wetland') {
        // short strokes of reed, a few to a tile
        g.strokeStyle = shade(PALETTE.wetland, -0.12);
        g.lineWidth = Math.max(1, 0.25 * u);
        g.beginPath();
        g.moveTo(0.4 * u, 1 * u);
        g.lineTo(1.6 * u, 1 * u);
        g.moveTo(2.2 * u, 3 * u);
        g.lineTo(3.4 * u, 3 * u);
        g.stroke();
      } else {
        // stones: a few specks, darker for rock than for a quarry
        g.fillStyle = kind === 'rock' ? shade(PALETTE.rock, -0.14) : shade(PALETTE.quarry, -0.1);
        for (const [x, y, r] of [[0.5, 0.6, 0.3], [2.1, 1.4, 0.4], [1.2, 2.5, 0.25]]) {
          g.beginPath();
          g.arc(x * u, y * u, Math.max(0.7, r * u), 0, Math.PI * 2);
          g.fill();
        }
      }
      pattern = ctx.createPattern(c, 'repeat');
      // the canvas is drawn in metres: one pixel of the tile to one pixel of the picture
      pattern?.setTransform(new DOMMatrix([1 / s, 0, 0, 1 / s, 0, 0]));
    }
    this.patterns.set(key, pattern);
    return pattern;
  }

  /** Data layers over the map, with the canvas in local metres (north up). */
  private paintData(ctx: CanvasRenderingContext2D, sizeM: number): void {
    if (!this.painters.length) return;
    const s = this.px / sizeM;
    const h = sizeM / 2;
    ctx.save();
    ctx.setTransform(s, 0, 0, -s, h * s, h * s);
    for (const paint of this.painters) paint(ctx, sizeM);
    ctx.restore();
  }

  dispose(): void {
    this.texture.dispose();
  }
}

/** A colour a little lighter (amount > 0) or darker (amount < 0). */
function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function traceRing(ctx: CanvasRenderingContext2D, ring: Array<[number, number]>): void {
  if (ring.length < 3) return;
  ctx.moveTo(ring[0][0], ring[0][1]);
  for (let k = 1; k < ring.length; k++) ctx.lineTo(ring[k][0], ring[k][1]);
  ctx.closePath();
}

function strokeLine(ctx: CanvasRenderingContext2D, l: LineFeature, width: number): void {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(l.pts[0][0], l.pts[0][1]);
  for (let k = 1; k < l.pts.length; k++) ctx.lineTo(l.pts[k][0], l.pts[k][1]);
  ctx.stroke();
}
