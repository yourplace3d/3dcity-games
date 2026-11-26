/**
 * Bakes ESA WorldCover 2021 (10 m land cover, CC BY 4.0) into small map squares the game reads for its
 * trees: one 256 × 256 PNG per zoom-14 tile, grey, each pixel the WorldCover class (10 tree cover,
 * 20 shrubland, 30 grassland, 40 cropland, 50 built-up, 60 bare, 70 snow, 80 water, 90 wetland,
 * 95 mangroves, 100 moss; 0 no data).
 *
 * The source is ESA's open bucket of 3° × 3° GeoTIFFs, read in pieces over HTTP. It sends no CORS
 * headers, so the browser cannot read it itself: the squares are baked here and served beside the game.
 *
 *   npm i --no-save geotiff@2.1.3
 *   node tools/landcover-bake.mjs public/landcover 52.5170,13.3889,4 48.8566,2.3522,4 …
 *
 * Each place is lat,lon,radius in km. Tiles already baked are kept.
 */

import { fromUrl } from 'geotiff';
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const Z = 14;
const PX = 256;
const SRC = (name) => `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${name}_Map.tif`;
const RES = 3 / 36000;

const [out, ...places] = process.argv.slice(2);
if (!out || !places.length) {
  console.error('usage: node tools/landcover-bake.mjs <out dir> lat,lon,km [lat,lon,km …]');
  process.exit(1);
}

const tileX = (lon) => ((lon + 180) / 360) * 2 ** Z;
const tileY = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z;
const lonOf = (x) => (x / 2 ** Z) * 360 - 180;
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z))) * 180) / Math.PI;

function fileName(lat0, lon0) {
  const ns = lat0 >= 0 ? `N${String(lat0).padStart(2, '0')}` : `S${String(-lat0).padStart(2, '0')}`;
  const ew = lon0 >= 0 ? `E${String(lon0).padStart(3, '0')}` : `W${String(-lon0).padStart(3, '0')}`;
  return `${ns}${ew}`;
}

const files = new Map();
function file(lat0, lon0) {
  const k = fileName(lat0, lon0);
  if (!files.has(k)) files.set(k, fromUrl(SRC(k)).then((t) => t.getImage()).catch(() => null));
  return files.get(k);
}

function png(gray) {
  const raw = Buffer.alloc(PX * (PX + 1));
  for (let y = 0; y < PX; y++) {
    raw[y * (PX + 1)] = 0;
    gray.copy ? gray.copy(raw, y * (PX + 1) + 1, y * PX, (y + 1) * PX) : raw.set(gray.subarray(y * PX, (y + 1) * PX), y * (PX + 1) + 1);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PX, 0);
  ihdr.writeUInt32BE(PX, 4);
  ihdr[8] = 8; // depth
  ihdr[9] = 0; // grey
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function bakeTile(x, y) {
  const path = join(out, String(Z), String(x), `${y}.png`);
  if (existsSync(path)) return 'kept';
  const w = lonOf(x), e = lonOf(x + 1), n = latOf(y), s = latOf(y + 1);
  const gray = new Uint8Array(PX * PX);
  // every 3° file the tile touches
  for (let lat0 = Math.floor(s / 3) * 3; lat0 < n; lat0 += 3) {
    for (let lon0 = Math.floor(w / 3) * 3; lon0 < e; lon0 += 3) {
      const img = await file(lat0, lon0);
      if (!img) continue; // open sea: no file
      const top = lat0 + 3;
      const c0 = Math.max(0, Math.floor((Math.max(w, lon0) - lon0) / RES));
      const c1 = Math.min(36000, Math.ceil((Math.min(e, lon0 + 3) - lon0) / RES));
      const r0 = Math.max(0, Math.floor((top - Math.min(n, top)) / RES));
      const r1 = Math.min(36000, Math.ceil((top - Math.max(s, lat0)) / RES));
      if (c1 <= c0 || r1 <= r0) continue;
      const [band] = await img.readRasters({ window: [c0, r0, c1, r1] });
      const ww = c1 - c0;
      for (let py = 0; py < PX; py++) {
        const lat = latOf(y + (py + 0.5) / PX);
        if (lat < lat0 || lat >= top) continue;
        const r = Math.floor((top - lat) / RES) - r0;
        if (r < 0 || r >= r1 - r0) continue;
        for (let qx = 0; qx < PX; qx++) {
          const lon = lonOf(x + (qx + 0.5) / PX);
          if (lon < lon0 || lon >= lon0 + 3) continue;
          const c = Math.floor((lon - lon0) / RES) - c0;
          if (c < 0 || c >= ww) continue;
          gray[py * PX + qx] = band[r * ww + c];
        }
      }
    }
  }
  mkdirSync(join(out, String(Z), String(x)), { recursive: true });
  writeFileSync(path, png(Buffer.from(gray)));
  return 'baked';
}

for (const p of places) {
  const [lat, lon, km] = p.split(',').map(Number);
  const dLat = km / 111.32;
  const dLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const x0 = Math.floor(tileX(lon - dLon)), x1 = Math.floor(tileX(lon + dLon));
  const y0 = Math.floor(tileY(lat + dLat)), y1 = Math.floor(tileY(lat - dLat));
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((await bakeTile(x, y)) === 'baked') n++;
  console.log(`${p}: ${(x1 - x0 + 1) * (y1 - y0 + 1)} tiles, ${n} new`);
}
