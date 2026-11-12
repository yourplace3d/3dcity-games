// One square picture of a place from straight above, at the height the intro film ends: the slab the film tilts away from.
// Usage: node tools/intro-still.mjs <lat,lon> <out.jpg>     (TOP = camera height in m, as for tools/intro.mjs in portrait)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const [place, out] = process.argv.slice(2);
const TOP = Number(process.env.TOP ?? 1850);
const browser = await chromium.launch({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}), args: process.env.SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem('3da-coached', '1'); } catch { /* private window */ } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(BASE + '#' + place);
await page.waitForFunction(() => window.game?.world && document.body.dataset.screen === 'play', null, { timeout: 90000 });
await page.waitForTimeout(800);
const url = await page.evaluate((h) => {
  const g = window.game;
  for (const id of ['hud', 'touch']) document.getElementById(id).style.display = 'none';
  g.world.solids.tallestNear = () => h - 34;
  g.cam.h = h;
  // stop the game's own frames; draw one of ours
  window.requestAnimationFrame = () => 0;
  g.render = false;
  const gy = g.world.groundY(0, 0);
  g.camera.position.set(0, gy + h, 0);
  g.camera.lookAt(0, gy, 0);
  g.renderer.render(g.scene, g.camera);
  // read the picture off the canvas straight away, while it still holds this frame
  return g.renderer.domElement.toDataURL('image/jpeg', 0.93);
}, TOP);
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
