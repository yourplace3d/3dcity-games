// For each place: does the first-time tour start right where the player spawns, and can it be played through?
// The game drives itself on a hand-turned clock, with pauses so the next map square can arrive.
// Usage: node tools/spawn-test.mjs Berlin=52.5163,13.3777 Ottawa=45.4215,-75.6972 ...   (four places at a time; needs the preview server)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const places = process.argv.slice(2);
const browser = await chromium.launch({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function one(spec) {
  const [name, at] = spec.split('=');
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const res = { name };
  try {
    await page.goto('http://127.0.0.1:4173/#' + at);
    await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || !document.getElementById('thin').hidden || document.getElementById('status').textContent, null, { timeout: 90000 });
    res.status = await page.evaluate(() => document.getElementById('status').textContent);
    if (res.status) return res;
    res.thin = await page.evaluate(() => !document.getElementById('thin').hidden);
    if (res.thin) await page.click('#btn-anyway');
    await page.waitForTimeout(1200);
    Object.assign(res, await page.evaluate(() => {
      const g = window.game; const [px, py] = g.pos();
      return {
        step: document.getElementById('coach').hidden ? 'hidden' : document.getElementById('coach-n').textContent,
        hint: document.getElementById('hint').hidden ? '' : document.getElementById('hint').textContent,
        carM: +Math.min(...g.cars.map((c) => Math.hypot(c.x - px, c.y - py))).toFixed(1),
        pickups: g.pickups.length,
        nearestPickup: Math.round(Math.min(...g.pickups.map((m) => { const [x, y] = g.local(m); return Math.hypot(x - px, y - py); }))),
        km: +g.world.roads.streetKm.toFixed(1),
      };
    }));
    await page.evaluate(() => {
      let vt = performance.now(); let raf = null; const timers = []; const realRaf = window.requestAnimationFrame.bind(window); const realTo = window.setTimeout.bind(window);
      window.requestAnimationFrame = (cb) => { raf = cb; return 1; };
      window.setTimeout = (fn, ms = 0, ...a) => { if (typeof fn !== 'function') return realTo(fn, ms, ...a); timers.push({ at: vt + ms, fn }); return 0; };
      window.__step = (ms) => { vt += ms; for (const t of timers.splice(0)) { if (t.at <= vt) t.fn(); else timers.push(t); } const cb = raf; raf = null; if (cb) cb(vt + 1000); };
      window.game.auto = true; window.game.render = false; window.__auto = true;
    });
    res.at = {};
    for (let s = 0; s < 480; s += 3) {
      const step = await page.evaluate(() => { for (let i = 0; i < 90; i++) window.__step(1000 / 30); return document.getElementById('coach').hidden ? 'hidden' : document.getElementById('coach-n').textContent; });
      if (!(step in res.at)) res.at[step] = s + 3;
      if (step.startsWith('4')) break;
      await page.waitForTimeout(60);
    }
    // a fine in the middle of things: is there a car to take, and does the tour say so?
    res.fine = await page.evaluate(() => { const g = window.game; g.auto = false; g.fine('Caught!', 0.25); for (let i = 0; i < 90; i++) window.__step(1000 / 30); const [px, py] = g.pos(); return { inCar: !!g.car, carM: +Math.min(...g.cars.filter((c) => c.driver === 'none').map((c) => Math.hypot(c.x - px, c.y - py))).toFixed(1), blocked: g.world.solids.inside(px, py), coach: document.getElementById('coach').hidden ? 'hidden' : document.getElementById('coach-text').textContent.slice(0, 40) }; });
    res.end = await page.evaluate(() => { const g = window.game; return { done: g.run.done, inCar: !!g.car, job: !!g.job, pickups: g.pickups.length }; });
  } catch (e) { res.error = String(e).slice(0, 160); }
  if (errors.length) res.pageErrors = errors.slice(0, 2);
  await page.close();
  return res;
}
const out = await Promise.all(places.map(one));
for (const r of out) console.log(JSON.stringify(r));
await browser.close();
