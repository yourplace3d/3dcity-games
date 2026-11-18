// Browser regressions against the real app and public map tiles.
// npm install --no-save --package-lock=false playwright && npx playwright install chromium
// node tools/ui-test.mjs (or CHROME_CHANNEL=chrome node tools/ui-test.mjs)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    channel: process.env.CHROME_CHANNEL || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'warn') console.warn(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  // Never write test saves to the live service.
  await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 503, json: { message: 'Offline for this test' } }));
  const base = server.resolvedUrls.local[0];
  const playing = async () => {
    await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'), null, { timeout: 90000 });
    assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());
  };

  // Keep search tests deterministic; the world itself still uses the real map servers.
  let searches = 0;
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    searches++;
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ json: { features: [] } });
  });
  await page.route('https://nominatim.openstreetmap.org/search**', (route) => route.fulfill({ json: [] }));
  console.log('Checking malformed links and repeated searches');
  await page.goto(base + '#Bad%_link');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Nothing found'));
  assert.deepEqual(errors, [], 'malformed percent escapes must not stop page setup');
  await page.locator('#q').fill('Unknown town');
  await page.locator('#q').press('Enter');
  await page.locator('#q').press('Enter');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Nothing found'));
  assert.equal(searches, 2, 'one lookup per search, even when Enter is pressed twice');

  await page.evaluate(async () => {
    const { wireCloud } = await import('/src/cloudUi.ts');
    wireCloud(document.querySelector('#account'), location.href, () => 'Test');
  });
  await page.locator('#cloud-form input').fill('Test');
  await page.locator('#cloud-form button').click();
  await page.waitForFunction(() => document.querySelector('#cloud-note').textContent.includes('didn’t go through'));
  assert.equal(await page.locator('#cloud-form button').isEnabled(), true, 'a failed first save offers another attempt');
  await page.evaluate(() => localStorage.clear());

  await page.evaluate(() => localStorage.setItem('drive-it-3d', JSON.stringify({ cash: 500, delivered: 'oops' })));
  console.log('Loading Berlin and checking controls');
  // Change the query as well: changing only a fragment does not reload this app.
  await page.goto(base + '?ui=controls#Berlin');
  await playing();
  assert.deepEqual(await page.evaluate(() => [game.cash, game.delivered]), [500, 0]);
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(() => !!game.car), true, 'spawn car is reachable');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyP');
  const pausedAt = await page.evaluate(() => game.pos());
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(() => game.pos()), pausedAt, 'pause stops simulation');
  await page.locator('#btn-continue').click();
  await page.waitForFunction(() => game.car?.controls.throttle === 0);
  assert.equal(await page.evaluate(() => game.car.controls.throttle), 0, 'pause clears a held accelerator');
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyM');
  assert.equal(await page.locator('#bigmap').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#bigmap').isVisible(), false);

  await page.evaluate(() => { game.onRunEnd(123, 10); game.newRun(); });
  await page.waitForTimeout(1550);
  assert.equal(await page.locator('#result').isVisible(), false, 'a delayed result must not interrupt a new run');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('3da-scores')).some((s) => s.score === 123)), true, 'finished score is still saved');
  for (const [key, panel, close] of [['KeyP', '#pause', '#btn-continue'], ['KeyM', '#bigmap', '#btn-map-close']]) {
    await page.evaluate(() => game.onRunEnd(124, 11));
    await page.keyboard.press(key);
    await page.waitForTimeout(1550);
    assert.equal(await page.locator(panel).isVisible(), true);
    assert.equal(await page.locator('#result').isVisible(), false, 'results wait while another card is open');
    await page.locator(close).click();
    await page.locator('#result').waitFor({ state: 'visible' });
    await page.locator('#btn-close').click();
  }

  console.log('Checking city guesses');
  const { packGuess } = await server.ssrLoadModule('/src/guess.ts');
  const code = packGuess({ name: 'Test', points: 900, seconds: 25, wrong: 0,
    round: { city: 'Berlin', at: { lat: 52.52, lon: 13.405 }, options: ['Berlin', 'Hamburg', 'Paris', 'London'] } });
  await page.goto(base + '?g=' + code);
  await playing();
  await page.locator('#btn-guess').click();
  await page.getByRole('button', { name: 'Hamburg', exact: true }).click();
  await page.locator('#btn-guess-back').click();
  await page.locator('#btn-guess').click();
  assert.equal(await page.getByRole('button', { name: 'Hamburg', exact: true }).isDisabled(), true, 'wrong guesses stay removed after looking around');
  await page.getByRole('button', { name: 'Paris', exact: true }).click();
  await page.getByRole('button', { name: 'London', exact: true }).click();
  assert.equal(await page.locator('#guess-after').isVisible(), true, 'three distinct wrong guesses end the round');
  assert.equal(await page.locator('#guess-score').textContent(), 'No points this time');
  assert.deepEqual(errors, [], 'no browser exceptions');
  console.log('Browser regressions passed: malformed links, repeated search, saved counters, car entry, pause/input, map, delayed results, wrong guesses.');
} finally {
  await browser?.close();
  await server.close();
}
