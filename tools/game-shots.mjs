// Before and after pictures of the ground in the real game, from high up and at street level.
// node tools/game-shots.mjs <outdir> name:lat:lon ...   ("before" is ?try=plainland: the ground as it was)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, ...spots] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const spot of spots) {
    const [name, lat, lon] = spot.split(':');
    for (const mode of ['before', 'after']) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await page.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 503, json: {} }));
      await page.route('https://photon.komoot.io/api/**', (r) => r.fulfill({ json: { features: [{ geometry: { coordinates: [+lon, +lat] }, properties: { name } }] } }));
      await page.goto(`${base}?ui=controls${mode === 'before' ? '&try=plainland' : ''}#${encodeURIComponent(name + ' spot')}`);
      await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status')?.classList.contains('error'), null, { timeout: 180000 });
      // down at the street, after the arrival from high up
      await page.waitForTimeout(9000);
      await page.screenshot({ path: `${out}/${name}-street-${mode}.png` });
      // then up and away, as at the end of a run
      await page.evaluate(() => { window.game.rising = true; });
      await page.waitForTimeout(9000);
      await page.screenshot({ path: `${out}/${name}-high-${mode}.png` });
      console.log(name, mode, JSON.stringify(await page.evaluate(() => window.game.world.model.reliefStats ?? null)));
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
