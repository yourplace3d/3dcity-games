// The garage in a browser, on real map tiles (Nuremberg, then Munich): its symbol on the maps; a car driven up
// is parked and kept; three spots, and the fourth car finds none; a kept car taken out, left somewhere and
// taken out again; one sold, which frees its spot; all of it still there after the page is loaded again; and
// another city with spots of its own. The player is moved by hand: the test browser runs too slowly to drive.
// Needs Playwright (see tools/ui-test.mjs). SHOTS=<folder> keeps screenshots.
// node tools/garage-test.mjs
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
  const playing = async () => {
    await page.waitForFunction(() => (window.game?.world && window.garage && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'), null, { timeout: 120000 });
    assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());
    // the garages' symbols go up on the first step of the game
    await page.waitForFunction(() => garage.spots.length === game.world.garages.length && game.world.garages.length > 0, null, { timeout: 120000 });
  };
  const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('3da-garage') ?? '{"cars":[]}').cars);
  /** the garage's panel is up, with `rows` kept cars listed (the panel is drawn anew a step after a press): its lines and its buttons, as shown */
  const panel = async (rows) => {
    await page.waitForFunction((n) => !document.querySelector('#forsale').hidden && document.querySelector('#forsale > b')?.textContent === 'Garage' && (n === null || document.querySelectorAll('#forsale .kept').length === n), rows ?? null, { timeout: 60000 });
    return page.evaluate(() => ({
      lines: [...document.querySelectorAll('#forsale > p')].map((p) => p.textContent),
      buttons: [...document.querySelectorAll('#forsale > button')].map((b) => `${b.textContent}${b.disabled ? ' (off)' : ''}`),
      rows: [...document.querySelectorAll('#forsale .kept')].map((r) => `${r.querySelector('span').textContent}: ${[...r.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`),
    }));
  };
  /** no garage's panel: hidden, or a building's */
  const noPanel = () => page.waitForFunction(() => document.querySelector('#forsale').hidden || document.querySelector('#forsale > b')?.textContent !== 'Garage', null, { timeout: 60000 });
  /** sit in a parked car of the street and stand it, by hand, on the garage's spot on the road: what car it is */
  const driveUp = () =>
    page.evaluate(() => {
      const spot = garage.spots[window.at];
      const taken = [...garage.out.values()];
      const car = game.cars.find((c) => c.driver === 'none' && !c.gone && c.hp > 0 && c !== game.car && !taken.includes(c) && ['sedan', 'sport', 'van'].includes(c.kind));
      game.seat(car);
      Object.assign(car, { x: spot.rx, y: spot.ry, vx: 0, vy: 0 });
      return { kind: car.kind, colour: car.colour };
    });
  const word = (kind) => ({ sedan: 'car', sport: 'sports car', van: 'van' })[kind];
  const Word = (kind) => word(kind).replace(/^./, (c) => c.toUpperCase());
  const price = (kind) => ({ sedan: 100, sport: 200, van: 120 })[kind];
  const money = (n) => `$${n.toLocaleString('en-US')}`;

  console.log('A player in Nuremberg: garages on the map');
  const { packHomes } = await server.ssrLoadModule('/src/game/homes.ts');
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const seed = {
    'drive-it-3d': JSON.stringify({ cash: 1000, delivered: 40 }),
    '3da-mode': 'jobs',
    '3da-coached': '1',
    '3da-homes': packHomes({ v: 1, homes: [{ id: '901', lat: 49.4521, lon: 11.0767, kind: 'flat', paid: 900, rent: 216, street: '', place: 'Nuremberg', at: Date.now() - 12 * 86400000 }], paidDay: ymd }),
    '3da-reno': JSON.stringify({ stage: 'done' }),
    '3da-bank': JSON.stringify({ v: 1, saved: 4 }),
    '3da-banklesson': JSON.stringify({ v: 1, stage: 'done', rent: true }),
    '3da-pointsnote': '1',
    '3da-rentnotes': '9',
  };
  await page.goto(base);
  await page.evaluate((s) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
  await playing();
  const there = await page.evaluate(() => ({ garages: game.world.garages.length, real: game.world.garages.filter((g) => !g.invented).length, marks: game.world.marks.length, over: game.run.over, apart: Math.min(...game.world.garages.flatMap((a, i) => game.world.garages.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)))) }));
  console.log(`  ${there.garages} garages in this part of town, ${there.real} of them on the map`);
  assert.ok(there.garages >= 1 && there.marks >= there.garages, 'each garage has its symbol');
  if (there.garages > 1) assert.ok(there.apart >= 400, `garages stand apart: ${Math.round(there.apart)} m`);
  assert.equal(there.over, true, 'no run of three is on');
  // the one nearest the player that stands on a street
  await page.evaluate(() => {
    const [px, py] = game.pos();
    window.at = garage.spots.map((s, i) => [i, s.line < 0 ? Infinity : Math.hypot(s.rx - px, s.ry - py)]).sort((a, b) => a[1] - b[1])[0][0];
  });
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(1500);
  assert.match(await page.locator('#bigmap-key').textContent(), /garage/);
  assert.match(await page.locator('#bigmap-key .ico[data-kind="garage"]').evaluate((el) => el.style.backgroundImage), /^url\("data:image\/png/);
  await shot('01-map');
  await page.keyboard.press('Escape');

  // where the visit starts, a building is for sale: its panel is up, and is looked for again further down
  await page.waitForFunction(() => !document.querySelector('#forsale').hidden && document.querySelector('#forsale > b')?.textContent === 'For sale', null, { timeout: 60000 });
  await page.evaluate(() => (window.start = game.pos()));

  console.log('A car driven up: parked, and kept');
  assert.deepEqual(await kept(), []);
  const first = await driveUp();
  let p = await panel(0);
  assert.deepEqual(p.lines, ['Park a car here and it is yours: 3 spots in this town.']);
  assert.deepEqual(p.buttons, [`Park this ${word(first.kind)} here`]);
  assert.deepEqual(p.rows, []);
  await shot('02-drive-up');
  await page.locator('#forsale > button').click();
  assert.equal(await page.evaluate(() => game.car), null, 'on foot, where the car stood');
  let cars = await kept();
  assert.equal(cars.length, 1);
  assert.equal(cars[0].kind, first.kind);
  assert.equal(cars[0].colour, first.colour);
  await page.waitForFunction(() => [...document.querySelectorAll('#toasts > *')].some((e) => e.textContent.startsWith('Parked.')), null, { timeout: 60000 });
  // on foot: what is kept, and nothing to park
  p = await panel(1);
  assert.deepEqual(p.lines, ['Your cars in this town: 1 of 3 spots taken.', 'A kept car is never lost: left anywhere, or wrecked, it is here again.']);
  assert.deepEqual(p.buttons, []);
  assert.deepEqual(p.rows, [`${Word(first.kind)}: Take it | Sell ${money(price(first.kind))}`]);

  console.log('Three spots: the fourth car finds none');
  const second = await driveUp();
  await page.waitForFunction((w) => document.querySelector('#forsale > button')?.textContent === `Park this ${w} here`, word(second.kind));
  await page.locator('#forsale > button').click();
  const third = await driveUp();
  await page.waitForFunction((w) => document.querySelector('#forsale > button')?.textContent === `Park this ${w} here`, word(third.kind));
  await page.locator('#forsale > button').click();
  cars = await kept();
  assert.deepEqual(cars.map((c) => c.id), [1, 2, 3]);
  // all three under the one place, the city's
  assert.equal(new Set(cars.map((c) => `${c.lat},${c.lon}`)).size, 1);
  const fourth = await driveUp();
  await page.waitForFunction(() => document.querySelector('#forsale > button')?.disabled === true);
  p = await panel(3);
  assert.deepEqual(p.lines[0], 'Your cars in this town: 3 of 3 spots taken.');
  assert.deepEqual(p.buttons, ['Full: sell a car to make room (off)']);
  assert.equal(p.rows.length, 3);
  await shot('03-full', page.locator('#forsale'));
  await page.locator('#forsale > button').click({ force: true });
  assert.equal((await kept()).length, 3, 'a press on the button that is off parks nothing');

  console.log('A kept car taken out: on the street by the garage, and the player in it');
  await page.locator('#forsale .kept').nth(1).getByText('Take it').click();
  const out = await page.evaluate(() => {
    const c = game.car;
    const other = game.cars.filter((o) => !o.gone && o !== c);
    const spot = garage.spots[window.at];
    return { kind: c.kind, colour: c.colour, hp: c.hp, driver: c.driver, out: garage.out.size, nearest: Math.min(...other.map((o) => Math.hypot(o.x - c.x, o.y - c.y))), fromSpot: Math.hypot(c.x - spot.rx, c.y - spot.ry) };
  });
  assert.equal(out.kind, second.kind);
  assert.equal(out.colour, second.colour);
  assert.equal(out.driver, 'player');
  assert.equal(out.out, 1);
  assert.ok(out.nearest > 3, `clear of the car the player came in: ${out.nearest.toFixed(1)} m`);
  assert.ok(out.fromSpot < 60, `by the garage: ${out.fromSpot.toFixed(1)} m`);
  assert.equal((await kept()).length, 3, 'taken out, it is still kept');
  // the car the player came in stays where it stood, with nobody in it
  assert.equal(await page.evaluate(([k, col]) => game.cars.filter((o) => !o.gone && o.driver === 'none' && o.kind === k && o.colour === col).length >= 1, [fourth.kind, fourth.colour]), true);
  // stood back on the garage's spot: its own panel
  await page.evaluate(() => Object.assign(game.car, { x: garage.spots[window.at].rx, y: garage.spots[window.at].ry, vx: 0, vy: 0 }));
  await page.waitForFunction(() => document.querySelector('#forsale > button')?.textContent === 'Leave it here');
  p = await panel(2);
  assert.equal(p.lines[1], `This ${word(second.kind)} is kept here. Leave it anywhere: it comes back.`);
  assert.equal(p.rows.length, 2, 'the other two');
  await shot('04-taken-out');

  console.log('Left somewhere, wrecked: taken out again at the garage, good as new');
  await page.evaluate(() => {
    window.left = game.car;
    // 300 m off, and wrecked there
    Object.assign(game.car, { x: game.car.x + 300, y: game.car.y, vx: 0, vy: 0 });
  });
  await noPanel();
  await driveUp();
  await page.evaluate(() => (window.left.hp = 0));
  await page.waitForFunction(() => document.querySelectorAll('#forsale .kept').length === 3);
  await page.locator('#forsale .kept').nth(1).getByText('Take it').click();
  const again = await page.evaluate(() => ({ kind: game.car.kind, colour: game.car.colour, hp: game.car.hp, same: game.car === window.left, gone: window.left.gone, out: garage.out.size }));
  assert.equal(again.kind, second.kind);
  assert.equal(again.colour, second.colour);
  assert.equal(again.hp, 100);
  assert.equal(again.same, false);
  assert.equal(again.gone, true, 'the one left about is taken away');
  assert.equal(again.out, 1);

  console.log('Leave it here: back in, and on foot');
  await page.evaluate(() => Object.assign(game.car, { x: garage.spots[window.at].rx, y: garage.spots[window.at].ry, vx: 0, vy: 0 }));
  await page.waitForFunction(() => document.querySelector('#forsale > button')?.textContent === 'Leave it here');
  await page.locator('#forsale > button').click();
  assert.equal(await page.evaluate(() => game.car === null && garage.out.size === 0), true);
  await page.waitForFunction(() => document.querySelectorAll('#forsale .kept').length === 3 && !document.querySelector('#forsale > button'));

  console.log('Sold, at the second press: its spot is free');
  const cash = await page.evaluate(() => game.cash);
  const sellFirst = page.locator('#forsale .kept').nth(0).locator('button.sell');
  await sellFirst.click();
  await page.waitForFunction(() => document.querySelector('#forsale .kept button.sell').textContent.startsWith('Really sell?'));
  assert.equal(await page.evaluate(() => game.cash), cash, 'nothing sold at the first press');
  assert.equal((await kept()).length, 3);
  await shot('05-really-sell', page.locator('#forsale'));
  await page.locator('#forsale .kept').nth(0).locator('button.sell').click();
  assert.equal(await page.evaluate(() => game.cash), cash + price(first.kind));
  cars = await kept();
  assert.deepEqual(cars.map((c) => c.id), [2, 3]);
  await page.waitForFunction(() => [...document.querySelectorAll('#toasts > *')].some((e) => e.textContent.startsWith('Sold: ')), null, { timeout: 60000 });
  // and the fourth car can be parked now
  const fifth = await driveUp();
  await page.waitForFunction((w) => document.querySelector('#forsale > button')?.textContent === `Park this ${w} here` && !document.querySelector('#forsale > button').disabled, word(fifth.kind));
  await page.locator('#forsale > button').click();
  cars = await kept();
  assert.deepEqual(cars.map((c) => c.id), [2, 3, 4], 'a number is never given twice');

  console.log('Driven off: the panel goes, and beside a building for sale the building’s comes');
  await driveUp();
  await panel();
  await page.evaluate(() => Object.assign(game.car, { x: game.car.x + 120, y: game.car.y + 120, vx: 0, vy: 0 }));
  await noPanel();
  await driveUp();
  await panel();
  // straight from the garage to where the visit began: the homes draw their panel in the step the garage lets go of it
  await page.evaluate(() => Object.assign(game.car, { x: window.start[0], y: window.start[1], vx: 0, vy: 0 }));
  await page.waitForFunction(() => !document.querySelector('#forsale').hidden && document.querySelector('#forsale > b')?.textContent === 'For sale', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => !document.querySelector('#forsale').hidden && document.querySelector('#forsale > b').textContent), 'For sale', 'the building’s panel stays up');

  console.log('The page loaded again: the cars are still there');
  await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
  await playing();
  await page.evaluate(() => {
    const [px, py] = game.pos();
    window.at = garage.spots.map((s, i) => [i, s.line < 0 ? Infinity : Math.hypot(s.rx - px, s.ry - py)]).sort((a, b) => a[1] - b[1])[0][0];
    // on foot, to the garage
    Object.assign(game.me, { x: garage.spots[window.at].rx, y: garage.spots[window.at].ry, vx: 0, vy: 0 });
  });
  p = await panel(3);
  assert.equal(p.lines[0], 'Your cars in this town: 3 of 3 spots taken.');
  assert.deepEqual(p.buttons, []);
  assert.deepEqual(p.rows.map((r) => r.split(':')[0]), [Word(second.kind), Word(third.kind), Word(fifth.kind)]);
  // on foot, a car taken out: in it at once
  await page.locator('#forsale .kept').nth(0).getByText('Take it').click();
  assert.equal(await page.evaluate(() => game.car?.driver), 'player');
  assert.equal(await page.evaluate(() => game.car.kind), second.kind);

  console.log('Munich: spots of its own');
  await page.goto(`${base}?n=${Math.random()}#Munich`);
  await playing();
  await page.evaluate(() => {
    const [px, py] = game.pos();
    window.at = garage.spots.map((s, i) => [i, s.line < 0 ? Infinity : Math.hypot(s.rx - px, s.ry - py)]).sort((a, b) => a[1] - b[1])[0][0];
  });
  const munich = await driveUp();
  p = await panel(0);
  assert.deepEqual(p.lines, ['Park a car here and it is yours: 3 spots in this town.']);
  assert.deepEqual(p.rows, []);
  await page.locator('#forsale > button').click();
  cars = await kept();
  assert.deepEqual(cars.map((c) => c.id), [2, 3, 4, 5]);
  assert.equal(cars[3].kind, munich.kind);
  assert.equal(new Set(cars.map((c) => `${c.lat},${c.lon}`)).size, 2, 'two cities');
  p = await panel(1);
  assert.equal(p.lines[0], 'Your cars in this town: 1 of 3 spots taken.');

  assert.deepEqual(errors, [], 'no errors on the page');
  console.log('Garage checks passed');
} finally {
  await browser?.close();
  await server.close();
}
