// What a job pays, in a browser on real map tiles (Nuremberg): a player with 500 deliveries takes an open
// job at each kind of station and is paid $300 and no more, where such a job paid over a thousand before
// 28 November 2026; then a run of three, whose score still counts what a delivery is worth while the cash
// stops at $300. Packages are taken and delivered by hand: the test browser runs too slowly to drive.
// Needs Playwright (see tools/ui-test.mjs).
// node tools/pay-test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Never write test saves to the live service.
  await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 503, json: { message: 'Offline for this test' } }));
  const base = server.resolvedUrls.local[0];
  const { JOB_MAX, PAY_TOP } = await server.ssrLoadModule('/src/game/services.ts');
  const { packHomes } = await server.ssrLoadModule('/src/game/homes.ts');
  assert.equal(JOB_MAX, 300);
  const playing = async () => {
    await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'), null, { timeout: 120000 });
    assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());
  };
  /** in a car of the street */
  const seat = () =>
    page.evaluate(() => {
      if (!game.car) game.seat(game.cars.find((c) => c.driver === 'none' && !c.gone && c.hp > 0 && ['sedan', 'sport', 'van'].includes(c.kind)));
    });
  /** take a package by hand: the job it gives */
  const take = (kind) =>
    page.evaluate((kind) => {
      const m = game.pickups.find((p) => (p.kind ?? 'plain') === kind);
      if (!m || !game.take(m) || !game.job) return null;
      return { kind: game.job.kind, pay: game.job.pay, left: game.job.left, metres: game.job.metres };
    }, kind);
  /** stand the car on the drop-off: what the delivery added, and what the game said */
  const deliver = async () => {
    const before = await page.evaluate(() => ({ cash: game.cash, score: game.run.score, n: game.delivered }));
    await page.evaluate(() => {
      const [x, y] = game.local(game.job.to);
      Object.assign(game.car, { x, y, vx: 0, vy: 0 });
    });
    await page.waitForFunction((n) => game.delivered > n && !game.job, before.n, { timeout: 60000 });
    const after = await page.evaluate(() => ({ cash: game.cash, score: game.run.score, said: [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent) }));
    return { cash: after.cash - before.cash, score: after.score - before.score, said: after.said };
  };
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const seed = (mode) => ({
    'drive-it-3d': JSON.stringify({ cash: 1000, delivered: 500 }),
    '3da-mode': mode,
    '3da-coached': '1',
    '3da-homes': packHomes({ v: 1, homes: [{ id: '901', lat: 49.4521, lon: 11.0767, kind: 'flat', paid: 900, rent: 216, street: '', place: 'Nuremberg', at: Date.now() - 12 * 86400000 }], paidDay: ymd }),
    '3da-reno': JSON.stringify({ stage: 'done' }),
    '3da-bank': JSON.stringify({ v: 1, saved: 4 }),
    '3da-banklesson': JSON.stringify({ v: 1, stage: 'done', rent: true }),
    '3da-pointsnote': '1',
    '3da-rentnotes': '9',
    // nothing new happens at the home today: its card would hold the game, and no package would come
    '3da-events': JSON.stringify({ v: 1, open: [], last: ymd, first: 'before', renovated: {}, disputed: {}, settled: 0, lower: {}, moved: {}, glad: [] }),
  });
  const load = async (mode) => {
    await page.goto(base);
    await page.evaluate((s) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, seed(mode));
    await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
    await playing();
  };

  console.log('Open jobs, after 500 deliveries: each kind at its top, and $300 at the door');
  await load('jobs');
  assert.equal(await page.evaluate(() => game.run.over), true);
  await seat();
  await page.evaluate(() => (window.start = game.pos()));
  for (const kind of ['supply', 'rush', 'clean']) {
    // back where the visit began, a package waits at the nearest station of each kind
    await page.evaluate(() => Object.assign(game.car, { x: window.start[0], y: window.start[1], vx: 0, vy: 0 }));
    await page.waitForFunction((k) => !game.held && game.pickups.some((p) => p.kind === k), kind, { timeout: 120000 });
    const job = await take(kind);
    assert.ok(job, `a ${kind} job`);
    // at fifty deliveries and more, any way over 150 m comes to more than the top: so it is the top
    assert.ok(job.metres > 150, `${kind}: ${Math.round(job.metres)} m`);
    assert.equal(job.pay, PAY_TOP[kind], `${kind}: its own pay`);
    const got = await deliver();
    console.log(`  ${kind}: ${Math.round(job.metres)} m, pay $${job.pay}, ${Math.round(job.left)} s on the clock: +$${got.cash}`);
    assert.equal(got.cash, JOB_MAX, `${kind}: paid`);
    assert.ok(got.said.some((t) => /^Delivered\s+\+\$300$/.test(t)), `${kind}: ${got.said.join(' | ')}`);
  }

  console.log('A run of three: the score counts what a delivery is worth, the cash stops at $300');
  await load('run');
  assert.equal(await page.evaluate(() => game.run.over), false);
  await seat();
  let over = 0;
  for (let n = 1; n <= 3; n++) {
    await page.waitForFunction(() => game.pickups.length > 0 && !game.job, null, { timeout: 120000 });
    const job = await take('plain');
    assert.ok(job, `package ${n}`);
    const got = await deliver();
    console.log(`  delivery ${n}: ${Math.round(job.metres)} m, pay $${job.pay}: +$${got.score} for the run, +$${got.cash} cash`);
    assert.ok(got.score >= job.pay, 'the score counts the pay and what comes on top');
    assert.equal(got.cash, Math.min(JOB_MAX, got.score), 'the cash is the worth, up to $300');
    if (got.score > JOB_MAX) {
      over++;
      assert.ok(got.said.some((t) => t.includes(`+$${got.score.toLocaleString('en-US')} for the run · $300 cash`)), got.said.join(' | '));
    }
  }
  // with nearly the whole clock left, a run's delivery is worth more than $300: the case is met
  assert.ok(over >= 1, 'a delivery worth more than $300 was among the three');

  assert.deepEqual(errors, [], 'no errors on the page');
  console.log('Pay checks passed');
} finally {
  await browser?.close();
  await server.close();
}
