// Driving skill in a browser, on the stand-in map (tools/stand-in-map.mjs): a drift, a near miss, the
// delivery burst, and what is kept. The game is stepped by hand, so it does not depend on the frame rate.
// node tools/skill-test.mjs (SHOTS=<folder> for screenshots, LANG2=de for German)
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { fakeMap } from './stand-in-map.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const lang = process.env.LANG2 || 'en';
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, locale: lang === 'de' ? 'de-DE' : 'en-GB' });
const base = server.resolvedUrls.local[0];
page.on('pageerror', (e) => console.log('ERR', e.message));
await fakeMap(page);
const shot = (n) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${lang}-${n}.png` });
await page.goto(base);
await page.waitForTimeout(1000);
await page.locator('#start .places button').first().click();
await page.locator('#btn-anyway').click({ timeout: 30000 });
await page.waitForFunction(() => window.game?.world && document.body.dataset.screen === 'play', null, { timeout: 90000 });
await page.waitForTimeout(5000);
if (await page.locator('#coach-skip').isVisible()) await page.locator('#coach-skip').click();
await page.evaluate(() => {
  const g = window.game;
  window.__ev = [];
  const said = g.onSkill;
  g.onSkill = (e, at) => { window.__ev.push(e); said(e, at); };
  const c = g.cars.filter((c) => c.driver === 'none' || c.driver === 'ai').sort((a, b) => Math.hypot(a.x - g.me.x, a.y - g.me.y) - Math.hypot(b.x - g.me.x, b.y - g.me.y))[0];
  g.seat(c);
  // just short of level 2, so the chain banked below brings the level-up
  g.skill.save.total = 30;
  // stop the clock's own pace: drive the game by hand at 50 frames a second of game time
});
// a drift: up to speed by stepping the game by hand, then the handbrake round a bend
const drive = (keys, frames) => page.evaluate(([keys, frames]) => {
  const g = window.game;
  for (let i = 0; i < frames; i++) {
    // the car passed keeps to its line, whatever its driver would do
    const o = window.__o;
    if (o) Object.assign(o, { th: Math.PI, vx: -8, vy: 0, y: window.__oy });
    g.update(0.02, { moveX: 0, moveY: 0, stick: false, throttle: keys.up ? 1 : 0, steer: keys.left ? 1 : keys.right ? -1 : 0, brake: false, handbrake: !!keys.hb });
  }
  return { v: g.car.speed, ev: window.__ev.map((e) => `${e.kind}:${e.move ?? ''}:${e.points ?? ''}`) };
}, [keys, frames]);
await page.evaluate(() => { const c = window.game.car; c.th = 0; });
console.log(await drive({ up: 1 }, 120));
console.log(await drive({ up: 1, left: 1, hb: 1 }, 55));
await shot('1-drift');
// the drift is judged once the car runs straight again
const drift = await drive({ up: 1 }, 40);
console.log(drift);
assert.ok(drift.ev.some((e) => e.startsWith('move:drift')), 'a held handbrake turn is a drift');
await shot('2-after');
// a near miss: put a moving car just beside ours, coming the other way
await page.evaluate(() => {
  const g = window.game; const me = g.car;
  me.th = 0; me.vx = 16; me.vy = 0;
  const o = g.cars.find((c) => c.driver === 'ai' && c.kind === 'sedan');
  o.x = me.x + 18; o.y = me.y + 2.5; o.th = Math.PI; o.vx = -8; o.vy = 0;
  window.__o = o;
  window.__oy = o.y;
});
const near = await drive({ up: 1 }, 90);
await page.evaluate(() => { window.__o = null; });
console.log(near);
assert.ok(near.ev.some((e) => e.startsWith('move:near')), 'a close pass is a near miss');
await shot('3-near');
// a 180: back up to speed, then the handbrake held at full lock until the car has come round
await page.evaluate(() => { const c = window.game.car; c.th = 0; c.vx = 18; c.vy = 0; });
const spin = await drive({ up: 1, left: 1, hb: 1 }, 90);
await shot('2b-spin');
console.log(spin);
assert.ok(spin.ev.some((e) => e.startsWith('move:spin')), 'a handbrake held round is a 180');
await page.evaluate(() => { const c = window.game.car; c.vx = 0; c.vy = 0; });
await drive({}, 200);
// bonuses: straight to the total, with a word floating up
const bonus = await page.evaluate(() => {
  const g = window.game;
  const was = g.skill.save.total;
  g.skillBonus('escape', 2);
  return g.skill.save.total - was;
});
await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
await shot('2c-bonus');
assert.equal(bonus, 60, 'shaking off two stars is 60');
// the delivery burst and the pay floating up
await page.evaluate(() => { const g = window.game; g.arrived(g.car.x + 25, g.car.y, '+$240', false); });
await page.evaluate(() => new Promise((r) => setTimeout(r, 150)));
await shot('4-burst');
// stop where we are, so nothing is hit while the chain goes quiet and is banked
await page.evaluate(() => { const c = window.game.car; c.vx = 0; c.vy = 0; });
const quiet = await drive({}, 200);
console.log(quiet);
// 30 + the chain banked: level 2 (the banner's own seconds have gone by while the game was stepped by hand)
// 30 + the moves and bonuses: past level 1 now
assert.match(await page.evaluate(() => document.getElementById('skill-lv').textContent), lang === 'de' ? /^Stufe [23] · Neuling$/ : /^Lv [23] · Rookie$/);
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('3da-skill')));
console.log(kept);
assert.ok(kept.total > 0 && kept.drift >= 1 && kept.near === 1 && kept.spin === 1 && kept.escape === 1, 'kept in the browser');
console.log('skill test passed');
await browser.close(); await server.close();
