// Plays a build of the game in a real browser and takes pictures, so a change can be seen before it
// goes live. Run by .github/workflows/preview-check.yml on every pull request.
//   node tools/preview-check.mjs <dist folder> <out folder>
// Writes a picture per place and screen size, and report.json with what happened.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');

const [dist = 'dist', out = 'shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const server = await preview({ build: { outDir: dist }, preview: { host: '127.0.0.1', port: 4173 }, logLevel: 'error' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = { base, runs: [] };
const sizes = [
  { name: 'ipad', viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
];
const places = (process.env.PLACES || 'Hamburg').split(',');
for (const size of sizes) {
  for (const place of places) {
    const ctx = await browser.newContext({ viewport: size.viewport, hasTouch: size.hasTouch, isMobile: size.isMobile });
    const page = await ctx.newPage();
    const run = { size: size.name, place, errors: [], failed: [] };
    page.on('pageerror', (e) => run.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') run.errors.push(m.text()); });
    page.on('requestfailed', (r) => run.failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`));
    // never write to the live online save or the play counts
    await page.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 503, json: { message: 'Offline for this check' } }));
    const t0 = Date.now();
    await page.goto(base);
    await page.screenshot({ path: `${out}/${size.name}-start.png` });
    await page.goto(`${base}?check=1#${place}`);
    try {
      await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status')?.classList.contains('error'), null, { timeout: 120000 });
      run.screen = await page.evaluate(() => document.body.dataset.screen);
      run.status = await page.evaluate(() => document.querySelector('#status')?.textContent ?? '');
      // let the city fill in
      await page.waitForTimeout(8000);
    } catch (e) {
      run.screen = 'timeout';
      run.status = String(e.message).slice(0, 200);
    }
    run.seconds = Math.round((Date.now() - t0) / 1000);
    await page.screenshot({ path: `${out}/${size.name}-${place}.png` });
    report.runs.push(run);
    await ctx.close();
  }
}
// Scenes of their own for what a pull request changes: each file in tools/preview-scenes/ plays its own,
// takes its pictures into the same folder and gives what it saw for the report, under its file's name. A
// scene never fails the check: it is there to be looked at. (One file a scene, so that two pull requests
// adding scenes at the same time do not meet in this file.)
const scenes = new URL('./preview-scenes/', import.meta.url);
for (const file of existsSync(scenes) ? readdirSync(scenes).filter((f) => f.endsWith('.mjs')).sort() : []) {
  const name = file.replace(/\.mjs$/, '');
  try {
    const { default: scene } = await import(new URL(file, scenes).href);
    report[name] = await scene({ browser, base, out, sizes });
  } catch (e) {
    report[name] = { failed: String(e?.message ?? e).slice(0, 300) };
  }
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
await server.close();
console.log(JSON.stringify(report, null, 1));
process.exit(report.runs.every((r) => r.screen === 'play') ? 0 : 1);
