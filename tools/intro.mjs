// Films the "guess the city" intro: the tutorial steps played in one place, then the camera rises until the city shows.
// Usage: node tools/intro.mjs <lat,lon> <outDir>     (VIEW=540x960 SCALE=2 for 1080x1920; SOFTWARE_GL=1 without a GPU)
// Writes clean frames (no captions) and outDir/cues.json: which frames belong to which step, for titles added afterwards.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const [place, outDir] = process.argv.slice(2);
const [vw, vh] = (process.env.VIEW ?? '1920x1080').split('x').map(Number);
/** how high the camera ends, m: the view must stay inside the 1.5 km square that is loaded */
const TOP = Number(process.env.TOP ?? (vw < vh ? 1850 : 1000));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}), args: process.env.SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(process.env.SCALE ?? 1) });
// the game's own first-time tour stays off: the film's titles say it
await ctx.addInitScript(() => { try { localStorage.setItem('3da-coached', '1'); } catch { /* private window */ } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(BASE + '#' + place);
await page.waitForFunction(() => window.game?.world && document.body.dataset.screen === 'play', null, { timeout: 90000 });
await page.evaluate(() => {
  // a clock we turn by hand: animation frames and timers only move when a frame is filmed
  let vt = performance.now(); let raf = null; const timers = [];
  window.requestAnimationFrame = (cb) => { raf = cb; return 1; };
  window.setTimeout = (fn, ms = 0) => { timers.push({ at: vt + ms, fn }); return 0; };
  window.__step = (ms) => { vt += ms; for (const t of timers.splice(0)) { if (t.at <= vt) t.fn(); else timers.push(t); } const cb = raf; raf = null; if (cb) cb(vt + 1000); };
  const st = document.createElement('style');
  st.textContent = '.toast,#flash{animation:none!important;opacity:1!important}#btn-menu,#next{display:none!important}';
  document.head.append(st);
});
await page.waitForTimeout(300);
let n = 0;
const cues = [];
const cue = (name) => cues.push({ name, frame: n });
const frame = async () => writeFileSync(`${outDir}/${String(n++).padStart(5, '0')}.jpg`, await page.screenshot({ type: 'jpeg', quality: 93 }));
const shoot = async (seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) { await page.evaluate(() => { window.game.render = true; window.__step(1000 / 30); }); await frame(); } };
// run the game without filming until `cond` holds (checked each game second), at most maxS seconds; real pauses let the next streets load
const skip = async (cond, maxS, each = '') => {
  for (let s = 0; s < maxS; s += 5) {
    const hit = await page.evaluate(([cond, each]) => { const g = window.game; g.render = false; const test = new Function('g', 'return ' + cond); const tick = new Function('g', each); for (let k = 0; k < 5; k++) { for (let i = 0; i < 30; i++) { tick(g); window.__step(1000 / 30); } if (test(g)) return true; } return false; }, [cond, each]);
    if (hit) return s;
    await page.waitForTimeout(80);
  }
  return -1;
};
const get = (code) => page.evaluate((code) => new Function('g', 'return ' + code)(window.game), code);
const set = (code) => page.evaluate((code) => new Function('g', code)(window.game), code);

// 1. on foot beside a parked car, then in and away
cue('car');
await shoot(1.3);
await set('g.auto = true; g.autoSpeed = 17');
await shoot(2.4);

// 2. the blue ring
console.log('to pickup', await skip('!g.job && g.car && g.pickups.length && Math.min(...g.pickups.map(m => Math.hypot(g.local(m)[0]-g.car.x, g.local(m)[1]-g.car.y))) < 50', 240));
cue('pickup');
for (let k = 0; k < 12 && !(await get('!!g.job')); k++) await shoot(0.5);
await shoot(0.8);

// 3. the clock
cue('clock');
await shoot(3.2);

// 4. the yellow ring
console.log('to drop', await skip('!g.job || g.job.metres < 70', 240));
cue('drop');
for (let k = 0; k < 24 && (await get('g.delivered === 0 && !!g.job')); k++) await shoot(0.5);
await shoot(1.6);

// 5. the police
await set('g.autoSpeed = 26; g.autoAvoid = false');
const keep = 'g.heat = Math.max(g.heat, 3.2); if (g.car) g.car.hp = 100; g.caughtT = 0;';
console.log('cops', await skip('g.car && g.cars.filter(c => c.driver === "cop" && Math.hypot(c.x-g.car.x, c.y-g.car.y) < 50).length >= 2 && g.car.speed > 15', 120, keep));
await page.evaluate((keep) => { const g = window.game; const tick = new Function('g', keep); const old = g.update.bind(g); g.update = (dt, i) => { tick(g); old(dt, i); }; }, keep);
cue('police');
await shoot(3.4);

// 6. up and away: the camera rises over the middle of the loaded square while the chase goes on below
cue('rise');
const RISE = 5.2 * 30;
const HOLD = 3.4 * 30;
const from = await get('({ h: g.cam.h, x: g.cam.x, y: g.cam.y })');
for (let i = 1; i <= RISE + HOLD; i++) {
  if (i === RISE) cue('top');
  const t = Math.min(1, i / RISE);
  const e = t * t * (3 - 2 * t);
  await page.evaluate(([h, x, y, fade]) => {
    const g = window.game;
    // the game keeps its camera above the roofs; telling it the roofs are this high takes shadows and far cars along
    g.world.solids.tallestNear = () => h - 34;
    g.cam.h = h;
    document.getElementById('hud').style.opacity = String(fade);
    document.getElementById('touch').style.opacity = String(fade);
    g.render = false;
    window.__step(1000 / 30);
    g.cam.x = x; g.cam.y = y;
    const gy = g.world.groundY(Math.max(-g.world.half, Math.min(g.world.half, x)), Math.max(-g.world.half, Math.min(g.world.half, y)));
    g.camera.position.set(x, gy + h, -y);
    g.camera.lookAt(x, gy, -y);
    g.renderer.render(g.scene, g.camera);
  }, [Math.exp(Math.log(from.h) + (Math.log(TOP) - Math.log(from.h)) * e), from.x * (1 - e), from.y * (1 - e), Math.max(0, 1 - i / 12)]);
  await frame();
}
cue('end');
writeFileSync(`${outDir}/cues.json`, JSON.stringify(cues));
console.log(place, n, 'frames', JSON.stringify(cues), await get('JSON.stringify({ delivered: g.delivered, cash: g.cash, inCar: !!g.car })'));
await browser.close();
