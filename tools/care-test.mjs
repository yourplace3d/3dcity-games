// The garage's own job in a browser, on real map tiles (Nuremberg): a car to deliver stands by the garage
// with the player in it; a new dent and the job is gone, and that car cannot be kept; delivered without one,
// it is paid, "Not a dent" is earned, the job is a level up and the car is for sale; bought, it is kept and
// taken out like any car. The player is moved by hand: the test browser runs too slowly to drive.
// Needs Playwright (see tools/ui-test.mjs). SHOTS=<folder> keeps screenshots.
// node tools/care-test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = process.env.SHOTS || '';
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Never write test saves to the live service.
  await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 503, json: { message: 'Offline for this test' } }));
  const base = server.resolvedUrls.local[0];
  const shot = async (name, what = page) => {
    if (!SHOTS) return;
    await what.screenshot({ path: `${SHOTS}/${name}.png` });
    console.log(`  ${name}`);
  };
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('3da-garage') ?? '{"cars":[],"done":0,"shown":[]}'));
  /** a line from the game that begins with `start`, on screen now or soon */
  const line = async (start) => {
    try {
      return await (await page.waitForFunction((p) => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).find((t) => t.startsWith(p)), start, { timeout: 60000 })).jsonValue();
    } catch (e) {
      // not said: where things stand, for whoever reads the failure
      console.log(`  no line "${start}":`, JSON.stringify(await page.evaluate(() => ({ held: game.held, here: garage.here(), cash: game.cash, job: !!game.job, car: game.car?.kind ?? null, speed: game.speed(), card: ['mission', 'firsthome', 'result', 'pause', 'bigmap'].filter((id) => document.getElementById(id) && !document.getElementById(id).hidden), panel: document.querySelector('#forsale').hidden ? null : document.querySelector('#forsale').innerText.slice(0, 300), toasts: [...document.querySelectorAll('#toasts > *')].map((t) => t.textContent) }))));
      throw e;
    }
  };
  /** the garage's panel is up: what it offers */
  const panel = async () => {
    await page.waitForFunction(() => !document.querySelector('#forsale').hidden && document.querySelector('#forsale > b')?.textContent === 'Garage' && !!document.querySelector('#forsale button.care'), null, { timeout: 60000 });
    return page.evaluate(() => ({
      heads: [...document.querySelectorAll('#forsale > b')].map((b) => b.textContent),
      lines: [...document.querySelectorAll('#forsale > p')].map((p) => p.textContent),
      job: document.querySelector('#forsale button.care').textContent,
      rows: [...document.querySelectorAll('#forsale .kept')].map((r) => `${r.querySelector('span').textContent}: ${[...r.querySelectorAll('button')].map((b) => `${b.textContent}${b.disabled ? ' (off)' : ''}`).join(' | ')}`),
    }));
  };
  /** whatever the player sits in, or the player on foot, stood by hand on the garage's spot on the road */
  const toGarage = () =>
    page.evaluate(() => {
      const spot = garage.spots[window.at];
      Object.assign(game.car ?? game.me, { x: spot.rx, y: spot.ry, vx: 0, vy: 0 });
    });

  console.log('A player in Nuremberg, on foot at a garage: its own job is offered');
  const { packHomes } = await server.ssrLoadModule('/src/game/homes.ts');
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await page.goto(base);
  await page.evaluate((s) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, {
    'drive-it-3d': JSON.stringify({ cash: 1000, delivered: 40 }),
    '3da-mode': 'jobs',
    '3da-coached': '1',
    '3da-homes': packHomes({ v: 1, homes: [{ id: '901', lat: 49.4521, lon: 11.0767, kind: 'flat', paid: 900, rent: 216, street: '', place: 'Nuremberg', at: Date.now() - 86400000 }], paidDay: ymd }),
    '3da-reno': JSON.stringify({ stage: 'done' }),
    '3da-bank': JSON.stringify({ v: 1, saved: 4 }),
    '3da-banklesson': JSON.stringify({ v: 1, stage: 'done', rent: true }),
    '3da-pointsnote': '1',
    '3da-rentnotes': '9',
    // nothing new happens at the home today: its card would hold the game
    '3da-events': JSON.stringify({ v: 1, open: [], last: ymd, first: 'before', renovated: {}, disputed: {}, settled: 0, lower: {}, moved: {}, glad: [] }),
  });
  await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
  await page.waitForFunction(() => (window.game?.world && window.garage && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'), null, { timeout: 120000 });
  assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());
  await page.waitForFunction(() => garage.spots.length > 0, null, { timeout: 120000 });
  await page.evaluate(() => {
    const [px, py] = game.pos();
    window.at = garage.spots.map((s, i) => [i, s.line < 0 ? Infinity : Math.hypot(s.rx - px, s.ry - py)]).sort((a, b) => a[1] - b[1])[0][0];
  });
  await toGarage();
  let p = await panel();
  assert.deepEqual(p.heads, ['Garage', 'Car delivery']);
  assert.equal(p.job, 'Deliver a car  $200');
  assert.ok(p.lines.includes('A customer’s car goes to its owner. A new dent on the way, and the job is gone.'));
  await shot('01-offer', page.locator('#forsale'));

  console.log('Taken: a car like no other, the player in it, and its owner’s ring across town');
  await page.locator('#forsale button.care').click();
  let job = await page.evaluate(() => game.job && { care: game.job.care === game.car, pay: game.job.pay, kind: game.job.kind, left: game.job.left, look: game.car.look, top: game.car.spec.top, dent: game.car.dent, driver: game.car.driver });
  assert.deepEqual(job, { care: true, pay: 200, kind: 'plain', left: 0, look: 'convertible', top: 24, dent: 1.6, driver: 'player' });
  assert.match(await line('An old cream convertible, for a customer'), /take it to the yellow ring and stop there\. A new dent, and the job is gone\.$/);
  // the line on the screen: the job, the car's way, the pay and the rule, and no clock
  await page.waitForFunction(() => !document.querySelector('#job').hidden && document.querySelector('#job').textContent.startsWith('Car delivery'));
  const hud = await page.locator('#job').textContent();
  assert.match(hud, /^Car delivery · [\d.,]+ k?m · \$200 · not a dent$/);
  // no garage's panel, no other jobs meanwhile
  await page.waitForFunction(() => document.querySelector('#forsale').hidden || document.querySelector('#forsale > b')?.textContent !== 'Garage');
  assert.equal(await page.evaluate(() => game.pickups.length), 0);
  await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(() => game.job?.left), 0, 'no clock runs');
  const way = await page.evaluate(() => {
    const [x, y] = game.local(game.job.to);
    return Math.hypot(x - game.car.x, y - game.car.y);
  });
  assert.ok(way > 250 && way < 1400, `its owner lives across town: ${Math.round(way)} m`);
  await shot('02-on-the-way');

  console.log('A new dent: the job is gone, nothing is paid, and the car cannot be kept');
  const cash = await page.evaluate(() => game.cash);
  await page.evaluate(() => {
    window.first = game.car;
    game.car.hp -= 6;
  });
  await page.waitForFunction(() => !game.job);
  await line('A dent. The job is gone');
  assert.equal(await page.evaluate(() => game.cash), cash);
  assert.equal((await stored()).done ?? 0, 0);
  assert.equal(await page.evaluate(() => game.car === window.first && !window.first.gone), true, 'the car stays on the street');
  await toGarage();
  await page.waitForFunction(() => [...document.querySelectorAll('#forsale > p')].some((e) => e.textContent === 'This car is a customer’s: it cannot be kept.'));
  p = await panel();
  assert.deepEqual(p.rows, []);
  assert.equal(await page.locator('#forsale > button:not(.care)').count(), 0, 'no button to park it');
  assert.equal(p.job, 'Deliver a car  $200', 'the level stays');

  console.log('Again, and handed over stopped at the ring: paid, a trophy, a level up, and the car for sale');
  await page.locator('#forsale button.care').click();
  await page.waitForFunction(() => game.job?.care && game.car === game.job.care && game.car !== window.first);
  const before = await page.evaluate(() => ({ delivered: game.delivered, cars: game.cars.filter((c) => !c.gone).length }));
  await page.evaluate(() => {
    const [x, y] = game.local(game.job.to);
    Object.assign(game.car, { x, y, vx: 0, vy: 0 });
  });
  await page.waitForFunction(() => !game.job);
  assert.equal(await line('Handed over without a dent'), 'Handed over without a dent: +$200. The old convertible is for sale at the garages now.');
  const after = await page.evaluate(() => ({ cash: game.cash, delivered: game.delivered, onFoot: game.car === null, trophy: JSON.parse(localStorage.getItem('3da-trophies') ?? '{"got":{}}').got.care > 0 }));
  assert.deepEqual(after, { cash: cash + 200, delivered: before.delivered + 1, onFoot: true, trophy: true });
  await line('Trophy: Not a dent');
  let kept = await stored();
  assert.equal(kept.done, 1);
  assert.deepEqual(kept.shown, ['convertible']);
  assert.deepEqual(kept.cars, []);
  await shot('03-handed-over');

  console.log('Back at the garage: the next pays a little more, and the convertible can be bought');
  await toGarage();
  await page.waitForFunction(() => document.querySelector('#forsale button.care')?.textContent === 'Deliver a car  $215');
  p = await panel();
  assert.deepEqual(p.heads, ['Garage', 'Car delivery', 'For sale']);
  // $1,200 in the pocket: not enough
  assert.deepEqual(p.rows, ['Old convertible: Buy $2,000 (off)']);
  await page.evaluate(() => (game.cash = 5000));
  await page.waitForFunction(() => document.querySelector('#forsale .kept.sale button')?.disabled === false);
  await shot('04-for-sale', page.locator('#forsale'));
  // a screenshot takes a while in the test browser, and someone on foot in the road is knocked aside by traffic: back to the garage
  await toGarage();
  await page.waitForFunction(() => document.querySelector('#forsale .kept.sale button')?.disabled === false);
  await page.locator('#forsale .kept.sale button').click();
  assert.equal(await line('Yours: an old cream convertible'), 'Yours: an old cream convertible. It is kept here.');
  assert.equal(await page.evaluate(() => game.cash), 3000);
  kept = await stored();
  assert.equal(kept.cars.length, 1);
  assert.equal(kept.cars[0].special, 'convertible');
  await page.waitForFunction(() => document.querySelectorAll('#forsale .kept:not(.sale)').length === 1);
  p = await panel();
  assert.deepEqual(p.rows, ['Old convertible: Take it | Sell $800', 'Old convertible: Buy $2,000']);

  console.log('Taken out: the car it is, and the player’s own');
  await page.locator('#forsale .kept:not(.sale)').getByText('Take it').click();
  const mine = await page.evaluate(() => ({ look: game.car?.look, top: game.car?.spec.top, dent: game.car?.dent, kind: game.car?.kind }));
  assert.deepEqual(mine, { look: 'convertible', top: 24, dent: 1.6, kind: 'sedan' });
  await toGarage();
  await page.waitForFunction(() => document.querySelector('#forsale > button:not(.care)')?.textContent === 'Leave it here');
  assert.ok((await panel()).lines.includes('This old convertible is kept here. Leave it anywhere: it comes back.'));
  await shot('05-own');

  assert.deepEqual(errors, [], 'no errors on the page');
  console.log('Car delivery checks passed');
} finally {
  await browser?.close();
  await server.close();
}
