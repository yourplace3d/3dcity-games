// Which places the start screen calls "not much on the map", and why: the place a name or a link
// lands on, and the counts the check reads. Usage: node tools/thin-check.mjs Perth "Perth, Scotland" -31.95,115.86 ...
// (needs the preview server on 4173: npx vite preview --host 127.0.0.1)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const places = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function one(spec) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const res = { spec };
  try {
    await page.goto('http://127.0.0.1:4173/#' + encodeURIComponent(spec));
    await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || !document.getElementById('thin').hidden || document.getElementById('status').textContent.trim().length > 3, null, { timeout: 120000 });
    await page.waitForTimeout(300);
    Object.assign(res, await page.evaluate(() => {
      const w = window.game?.world;
      const s = document.getElementById('status').textContent;
      return {
        status: s, hash: location.hash, thin: !document.getElementById('thin').hidden,
        buildings: w?.buildingCount, streetKm: w ? +w.roads.streetKm.toFixed(1) : null,
        perKm: w ? +(w.buildingCount / w.roads.streetKm).toFixed(1) : null,
        kmByKind: w ? w.roads.lines.filter((l) => l.traffic).reduce((a, l) => { a[l.kind] = +((a[l.kind] ?? 0) + l.len / 1000).toFixed(1); return a; }, {}) : null,
        wet: w ? (() => { let n = 0, t = 0; for (let x = -720; x <= 720; x += 40) for (let y = -720; y <= 720; y += 40) { t++; if (w.water.at(x, y)) n++; } return +(n / t).toFixed(2); })() : null,
      };
    }));
  } catch (e) { res.error = String(e).slice(0, 160); }
  await page.close();
  return res;
}
for (let i = 0; i < places.length; i += 3) {
  const out = await Promise.all(places.slice(i, i + 3).map(one));
  for (const r of out) console.log(JSON.stringify(r));
}
await browser.close();
