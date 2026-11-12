// The game drives itself for eight game-minutes per place and reports deliveries and mishaps.
// Usage: npm run build && npx vite preview --port 4173 &   then: node tools/selfdrive-test.mjs 52.5170,13.3889 49.4539,11.0773
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}), args: process.env.SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
for (const place of process.argv.slice(2)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
  await page.goto(BASE + '#' + place);
  await page.waitForFunction(() => window.game?.world && document.body.dataset.screen === 'play', null, { timeout: 60000 });
  await page.click('#btn-menu');
  console.log(place, JSON.stringify(await page.evaluate(async () => {
    const g = window.game; g.render = false; g.auto = true;
    const toasts = {}; g.onToast = (t) => { const k = t.replace(/[0-9$+,]/g, '').trim(); toasts[k] = (toasts[k] ?? 0) + 1; }; g.onFlash = g.onToast;
    const idle = { moveX: 0, moveY: 0, stick: false, throttle: 0, steer: 0, brake: false, handbrake: false };
    let stuckT = 0, maxStuck = 0, swaps = 0, last = g.world, cars = new Set();
    for (let t = 0; t < 480; t += 1 / 30) {
      g.update(1 / 30, idle);
      if (g.car) { cars.add(g.car); if (g.car.speed < 0.3) { stuckT += 1 / 30; maxStuck = Math.max(maxStuck, stuckT); } else stuckT = 0; }
      if (g.world !== last) { swaps++; last = g.world; }
      if (Math.round(t * 30) % 60 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { delivered: g.delivered, cash: g.cash, toasts, maxStuckS: Math.round(maxStuck), swaps, carsUsed: cars.size, hp: g.car && Math.round(g.car.hp), heat: g.heat };
  })));
  await page.close();
}
await browser.close();
