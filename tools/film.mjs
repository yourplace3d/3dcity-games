// Films a scene frame by frame at 1080p: the game is stepped 1/30 s per frame, so the video is smooth however slow the renderer.
// Usage: node tools/film.mjs <delivery|chase|cruise> <lat,lon> <outDir> [caption]   (NOCAP=1 for no captions, VIEW=540x960 SCALE=2 for 1080x1920 portrait with a phone-sized display)
// Then: ffmpeg -framerate 30 -i outDir/%05d.jpg -c:v libx264 -crf 16 -pix_fmt yuv420p clip.mp4
// Films one scene frame by frame: the game is stepped 1/30 s per frame, so the video is smooth however slow the renderer.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const [scene, place, outDir, caption = ''] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}), args: process.env.SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: Number((process.env.VIEW ?? '1920x1080').split('x')[0]), height: Number((process.env.VIEW ?? '1920x1080').split('x')[1]) }, deviceScaleFactor: Number(process.env.SCALE ?? 1) });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(BASE + '#' + place);
await page.waitForFunction(() => window.game?.world && document.body.dataset.screen === 'play', null, { timeout: 90000 });
await page.evaluate((caption) => {
  // a clock we turn by hand: animation frames and timers only move when a frame is filmed
  let vt = 0; let raf = null; const timers = [];
  window.requestAnimationFrame = (cb) => { raf = cb; return 1; };
  window.setTimeout = (fn, ms = 0) => { timers.push({ at: vt + ms, fn }); return 0; };
  window.__step = (ms) => { vt += ms; for (const t of timers.splice(0)) { if (t.at <= vt) t.fn(); else timers.push(t); } const cb = raf; raf = null; if (cb) cb(vt + 1000); };
  const st = document.createElement('style');
  st.textContent = '.toast,#flash{animation:none!important;opacity:1!important}#btn-menu{display:none}#cap{position:fixed;left:0;right:0;bottom:54px;text-align:center;font:800 40px/1.1 ui-rounded,system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 #000,0 0 18px rgba(0,0,0,.85);letter-spacing:.01em;pointer-events:none}#cap small{display:block;font-size:20px;font-weight:600;color:#ffd400;margin-top:8px}.hint{display:none!important}';
  document.head.append(st);
  const cap = document.createElement('div'); cap.id = 'cap'; cap.innerHTML = caption; document.body.append(cap);
  window.game.auto = true;
}, caption);
await page.waitForTimeout(300);
let n = 0;
const shoot = async (seconds) => { for (let i = 0; i < seconds * 30; i++) { await page.evaluate(() => { window.game.render = true; window.__step(1000 / 30); }); writeFileSync(`${outDir}/${String(n++).padStart(5, '0')}.jpg`, await page.screenshot({ type: 'jpeg', quality: 93 })); } };
// run the game without filming until `cond` holds (checked each game second), at most maxS seconds
const skip = (cond, maxS, each = '') => page.evaluate(([cond, maxS, each]) => { const g = window.game; g.render = false; const test = new Function('g', 'return ' + cond); const tick = new Function('g', each); for (let s = 0; s < maxS; s++) { for (let i = 0; i < 30; i++) { tick(g); window.__step(1000 / 30); } if (test(g)) return s; } return -1; }, [cond, maxS, each]);
const set = (code) => page.evaluate((code) => new Function('g', code)(window.game), code);
const cap = (html) => process.env.NOCAP ? null : page.evaluate((html) => (document.getElementById('cap').innerHTML = html), html);

if (scene === 'delivery') {
  await set('g.autoSpeed = 17');
  await shoot(5.5);
  console.log('to pickup', await skip('!g.job && g.car && g.pickups.length && Math.min(...g.pickups.map(m => Math.hypot(g.local(m)[0]-g.car.x, g.local(m)[1]-g.car.y))) < 55', 240));
  await cap('Pick up a package');
  await shoot(4.5);
  console.log('job', await skip('!!g.job', 30));
  await cap('Race the clock');
  await shoot(4);
  console.log('to drop', await skip('!g.job || g.job.metres < 75', 240));
  await cap('Get paid');
  console.log('drop starts at frame', n);
  for (let k = 0; k < 16 && (await page.evaluate(() => window.game.delivered)) === 0 && (await page.evaluate(() => !!window.game.job)); k++) await shoot(1);
  await shoot(3);
} else if (scene === 'chase') {
  await set('g.autoSpeed = 27; g.autoAvoid = false');
  console.log('in car', await skip('!!g.car && !!g.job', 240));
  const keep = 'g.heat = Math.max(g.heat, 3.2); if (g.car) g.car.hp = 100; g.caughtT = 0;';
  console.log('cops', await skip('g.car && g.cars.filter(c => c.driver === "cop" && Math.hypot(c.x-g.car.x, c.y-g.car.y) < 50).length >= 2 && g.car.speed > 12', 120, keep));
  await page.evaluate((keep) => { const g = window.game; const tick = new Function('g', keep); const old = g.update.bind(g); g.update = (dt, i) => { tick(g); old(dt, i); }; }, keep);
  await shoot(13);
} else {
  await set('g.autoSpeed = 21');
  console.log('cruise', await skip('g.car && g.car.speed > 14 && !!g.job', 240));
  await skip('g.car && g.car.speed > 14', 6);
  await shoot(9);
}
console.log(scene, place, n, 'frames', await page.evaluate(() => { const g = window.game; const c = g.car; return JSON.stringify({ delivered: g.delivered, cash: g.cash, inCar: !!c, v: c && +c.speed.toFixed(1), hp: c && Math.round(c.hp), inside: c && g.world.solids.inside(c.x, c.y), stuck: c && +c.stuck.toFixed(1), thr: c && c.controls.throttle, job: !!g.job }); }));
await browser.close();
