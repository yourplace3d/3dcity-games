// A stand-in map for trying the game where the map servers can't be reached (the cloud sessions):
// flat ground, a grid of streets, and blocks of buildings between them. Every map tile and terrain
// request of a Playwright page is answered from here; anything else off the page's own server gets 404.
// `await fakeMap(page)` before `page.goto`; the place is then "thin", so press "Play here anyway".
import Pbf from 'pbf';
import zlib from 'node:zlib';

const zz = (n) => (n << 1) ^ (n >> 31);
function geom(rings, close) {
  const out = [];
  let cx = 0, cy = 0;
  for (const r of rings) {
    out.push(9, zz(r[0][0] - cx), zz(r[0][1] - cy));
    cx = r[0][0]; cy = r[0][1];
    const rest = r.slice(1);
    out.push(2 | (rest.length << 3));
    for (const [x, y] of rest) { out.push(zz(x - cx), zz(y - cy)); cx = x; cy = y; }
    if (close) out.push(15);
  }
  return out;
}
function layer(pbf, name, feats) {
  const keys = [], values = [];
  const k = (s) => { let i = keys.indexOf(s); if (i < 0) { keys.push(s); i = keys.length - 1; } return i; };
  const v = (s) => { let i = values.findIndex((x) => x === s); if (i < 0) { values.push(s); i = values.length - 1; } return i; };
  pbf.writeVarintField(15, 2);
  pbf.writeStringField(1, name);
  let id = 1;
  for (const f of feats) {
    pbf.writeMessage(2, (_, p) => {
      p.writeVarintField(1, id++);
      const tags = [];
      for (const [kk, vv] of Object.entries(f.props)) tags.push(k(kk), v(vv));
      p.writePackedVarint(2, tags);
      p.writeVarintField(3, f.type);
      p.writePackedVarint(4, f.geom);
    });
  }
  for (const s of keys) pbf.writeStringField(3, s);
  for (const s of values) pbf.writeMessage(4, (_, p) => (typeof s === 'number' ? p.writeVarintField(4, s) : p.writeStringField(1, s)));
  pbf.writeVarintField(5, 4096);
}
export function tile() {
  const roads = [], blds = [];
  const step = 512;
  for (let i = -1; i <= 9; i++) {
    const c = i * step;
    roads.push({ type: 2, props: { class: i % 4 === 0 ? 'primary' : 'secondary' }, geom: geom([[[-200, c], [4296, c]]], false) });
    roads.push({ type: 2, props: { class: i % 4 === 0 ? 'primary' : 'secondary' }, geom: geom([[[c, -200], [c, 4296]]], false) });
  }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x0 = i * step + 80, y0 = j * step + 80, x1 = x0 + step - 160, y1 = y0 + step - 160;
    blds.push({ type: 3, props: { render_height: 12 + ((i * 7 + j * 3) % 5) * 6 }, geom: geom([[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]], true) });
  }
  const pbf = new Pbf();
  pbf.writeMessage(3, (_, p) => layer(p, 'transportation', roads));
  pbf.writeMessage(3, (_, p) => layer(p, 'building', blds));
  return Buffer.from(pbf.finish());
}
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
export function flatPng() {
  const w = 256, h = 256;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 128; raw[o + 1] = 10; raw[o + 2] = 0; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
export async function fakeMap(page) {
  const pbf = tile();
  const png = flatPng();
  await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => {
    const u = r.request().url();
    if (u.startsWith('https://tiles.openfreemap.org/planet')) return r.fulfill({ json: { tiles: ['https://fake.tiles/{z}/{x}/{y}.pbf'] } });
    if (u.startsWith('https://fake.tiles/')) return r.fulfill({ body: pbf, contentType: 'application/x-protobuf' });
    if (u.includes('elevation-tiles-prod')) return r.fulfill({ body: png, contentType: 'image/png' });
    return r.fulfill({ status: 404, body: '' });
  });
}
