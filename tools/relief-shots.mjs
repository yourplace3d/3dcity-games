// Before and after pictures of the ground's relief: node tools/relief-shots.mjs <outdir> name:lat:lon:height ...
// (tools/relief-bench.html in a headless browser; the height tiles are fetched here and handed over)
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, ...spots] = process.argv.slice(2);
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const spot of spots) {
    const [name, lat, lon, h] = spot.split(':');
    for (const mode of ['before', 'after']) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await page.route('https://s3.amazonaws.com/**', async (r) => {
        const res = await fetch(r.request().url());
        await r.fulfill({ status: res.status, contentType: 'image/png', body: Buffer.from(await res.arrayBuffer()) });
      });
      await page.goto(`${base}tools/relief-bench.html#${lat},${lon},${h}${mode === 'before' ? ',off' : ''}`);
      await page.waitForFunction(() => window.result, null, { timeout: 120000 });
      console.log(name, mode, JSON.stringify(await page.evaluate(() => window.result)));
      await page.locator('#c').screenshot({ path: `${out}/${name}-${mode}.png` });
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
