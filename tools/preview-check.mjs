// Plays a build of the game in a real browser and takes pictures, so a change can be seen before it
// goes live. Run by .github/workflows/preview-check.yml on every pull request.
//   node tools/preview-check.mjs <dist folder> <out folder>
// Writes a picture per place and screen size, and report.json with what happened.
import { mkdirSync, writeFileSync } from 'node:fs';
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
// The Story tab with a chapter that happens in another town: the tenants' dispute in Paris (chapter 8),
// opened while playing in Hamburg, in German. Shows the way there ("Hin: Paris"), the open chapter and the
// message marked "Jetzt" that can be tapped, and where a tap on the chapter leads. Never fails the check.
const day = new Date().toISOString().slice(0, 10);
const now = Date.now();
const house = { id: 'w1', lat: 48.87905, lon: 2.29452, kind: 'house', paid: 240000, street: 'Rue des Acacias', place: 'Paris', at: now - 10 * 86400000 };
const flats = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `w${i + 1}`, lat: 48.87 + i * 0.001, lon: 2.3 + i * 0.001, kind: 'flat', paid: 9000, street: 'Rue de Rome', place: 'Paris', at: now - 12 * 86400000 }));
const seed = {
  '3da-lang': 'de',
  '3da-discord': JSON.stringify({ card: true }),
  '3da-homes': JSON.stringify({ v: 1, homes: [...flats, house], paidDay: day }),
  '3da-reno': JSON.stringify({ stage: 'done' }),
  '3da-events': JSON.stringify({ open: [{ home: `${house.id}@${house.lat.toFixed(5)},${house.lon.toFixed(5)}`, kind: 'dispute', began: day, waiting: 0, mood: 'broken', stage: 'talk', chapter: true }], last: day, first: 'before', renovated: {}, disputed: {}, settled: 0, lower: {}, moved: {}, glad: [] }),
  '3da-story': JSON.stringify({
    v: 1, open: 8, opened: day, last: day, first: day, kinds: ['supply', 'rush', 'clean'], said: [], pending: [], turn: 0, sofar: [], offered: {},
    done: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, { day, silent: true }])),
    inbox: [
      { who: 'pump', from: 'Marie · the pump', text: 'A customer left her keys in while she paid, and someone drove off in her car.', day },
      { who: 'tenants', from: 'Céline · dein Haus (Rue des Acacias)', text: 'Die Heizung ist seit drei Wochen kaputt. Für ein kaltes Haus zahlen wir nicht.', day },
    ],
  }),
};
for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: size.viewport, hasTouch: size.hasTouch, isMobile: size.isMobile, locale: 'de-DE' });
  await ctx.addInitScript((kv) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, seed);
  const page = await ctx.newPage();
  const run = { size: size.name, place: 'story-tab', errors: [], failed: [] };
  page.on('pageerror', (e) => run.errors.push(e.message));
  await page.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 503, json: { message: 'Offline for this check' } }));
  try {
    await page.goto(`${base}?check=1#Hamburg`);
    await page.waitForFunction(() => window.game?.world && document.body.dataset.screen === 'play', null, { timeout: 120000 });
    await page.waitForTimeout(6000);
    await page.evaluate(() => document.querySelector('#btn-menu')?.click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('#tab-story')?.click());
    await page.waitForTimeout(600);
    run.story = await page.evaluate(() => ({
      text: document.querySelector('#pane-story .story-now p')?.textContent ?? '',
      button: document.querySelector('#pane-story .story-now button')?.textContent ?? null,
      chapterTappable: !!document.querySelector('#pane-story .chapters li.tap'),
      messageTappable: !!document.querySelector('#pane-story .inbox .msg.now.tap'),
    }));
    await page.screenshot({ path: `${out}/${size.name}-story.png` });
    await page.evaluate(() => document.querySelector('#pane-story .inbox')?.scrollIntoView());
    await page.screenshot({ path: `${out}/${size.name}-story-messages.png` });
    // a tap on the open chapter: off to Paris
    await page.evaluate(() => document.querySelector('#pane-story .chapters li.tap')?.click());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${size.name}-story-tapped.png` });
    run.screen = 'play';
    run.status = await page.evaluate(() => document.querySelector('#status')?.textContent ?? document.querySelector('#busy-text')?.textContent ?? '');
  } catch (e) {
    run.screen = 'story-failed';
    run.status = String(e.message).slice(0, 200);
  }
  report.story = [...(report.story ?? []), run];
  await ctx.close();
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
await server.close();
console.log(JSON.stringify(report, null, 1));
process.exit(report.runs.every((r) => r.screen === 'play') ? 0 : 1);
