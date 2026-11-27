// The pump's scene played in a browser, on real map tiles (Nuremberg): a customer's car to find in a circle,
// seen when near, a new square that leaves it behind, the circle closing in, getting in, out and in again,
// and driving it back to the ring at the pump. The player is moved by hand: the test browser runs too slowly
// to drive. Needs Playwright (see tools/ui-test.mjs). SHOTS=<folder> keeps a screenshot of each step.
// node tools/find-test.mjs
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Never write test saves to the live service.
  await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 503, json: { message: 'Offline for this test' } }));
  const base = server.resolvedUrls.local[0];
  const shot = async (name) => {
    if (!SHOTS) return;
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    console.log(`  ${name}`);
  };
  /** a line from the game with `part` in it, on screen now or soon */
  const line = (part) => page.waitForFunction((p) => [...document.querySelectorAll('#toasts > *')].some((e) => e.textContent.includes(p)), part, { timeout: 60000 });
  const story = () => page.evaluate(() => JSON.parse(localStorage.getItem('3da-story') ?? 'null'));

  console.log('A player who has met the three at the stations, the day after');
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('3da-mode', 'jobs');
    localStorage.setItem('3da-coached', '1');
    const day = '2026-01-10';
    const done = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, { day }]));
    localStorage.setItem(
      '3da-story',
      JSON.stringify({ v: 1, open: 6, opened: day, last: day, done, first: day, kinds: ['supply', 'rush', 'clean'], said: ['regulars', 'thanks-supply', 'thanks-rush', 'thanks-clean'], inbox: [{ who: 'pump', from: 'Laura · the pump', text: "Delivered, and the load in one piece. You'll do.", day }], pending: [], turn: 0, sofar: [], offered: {}, names: { region: 'german', pump: 'Laura', flame: 'Thomas', shield: 'Sarah', neighbour: 'Stefan', friends: ['Nicole', 'Jan', 'Anna'] } }),
    );
  });
  await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
  await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'), null, { timeout: 120000 });
  assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());
  // the test browser is slow: let the story's clock run as if a while had been played
  await page.evaluate(() => (story.playedS = 60));

  console.log('Laura asks: a customer’s car is gone');
  await page.waitForFunction(() => !document.querySelector('#mission').hidden && document.querySelector('#mission-title').textContent === 'A customer’s car is gone', null, { timeout: 90000 });
  assert.equal(await page.locator('#mission-kicker').textContent(), 'Laura · the pump');
  const ask = await page.locator('#mission-text').textContent();
  const car = ask.match(/her car: (a [a-z-]+ (?:car|van|sports car))\./)[1];
  console.log('  the car:', car);
  await shot('01-card');
  // her ask is kept with the messages once it is taken on, not while the card waits
  assert.equal((await story()).inbox.filter((m) => m.text.includes('left her keys')).length, 0, 'not kept before the answer');
  await page.locator('#btn-mission-yes').click();
  assert.ok(await page.evaluate(() => !!game.find), 'the search is on');
  assert.equal((await story()).inbox.filter((m) => m.text.includes('left her keys')).length, 1, 'kept once taken on');
  await line('orange circle');
  const zone = await page.evaluate(() => game.mapView().zone);
  assert.ok(zone && zone.r === 150, 'the circle is on the little map');
  await shot('02-circle');
  assert.equal(await page.evaluate(() => game.pickups.length), 0, 'no other jobs meanwhile');
  await page.waitForTimeout(4500);
  assert.equal(await page.locator('#openjobs').isHidden(), true, 'no note on the open jobs meanwhile');
  assert.equal(await page.locator('#forsale').isHidden(), true, 'nothing to buy meanwhile');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(1500);
  await shot('02b-bigmap');
  await page.keyboard.press('Escape');
  assert.equal((await story()).offered['find-car'] !== undefined, true);

  console.log('The car is in the circle, not in its middle, and stays put');
  const where = await page.evaluate(() => {
    const c = game.findCar;
    const f = game.find;
    const [zx, zy] = game.world.proj.toLocal(f.zone.lon, f.zone.lat);
    return { x: c.x, y: c.y, colour: c.colour, inZone: Math.hypot(c.x - zx, c.y - zy), r: f.r };
  });
  assert.ok(where.inZone < where.r && where.inZone > 20, `inside the circle, off its middle (${Math.round(where.inZone)} m)`);
  // a new square left it behind: it is put back where it was
  await page.evaluate(() => game.dropCar(game.findCar));
  await page.waitForFunction(([x, y]) => game.findCar && !game.findCar.gone && Math.hypot(game.findCar.x - x, game.findCar.y - y) < 0.5, [where.x, where.y]);

  console.log('After a while the circle closes in');
  await page.evaluate(() => (game.findT = 61));
  await line('circle is smaller');
  assert.ok((await page.evaluate(() => game.find.r)) < 150);

  console.log('Seen from up close, then taken, left and taken again');
  await page.evaluate(() => {
    const c = game.findCar;
    // on foot, a little way along the street from it
    game.me.x = c.x + Math.cos(c.th) * 10;
    game.me.y = c.y + Math.sin(c.th) * 10;
  });
  await line('There it is');
  assert.ok(await page.evaluate(() => !!game.mapView().sought), 'the car blinks on the little map');
  // the camera catches up, and the ring lies around the car
  await page.waitForTimeout(2500);
  assert.ok(await page.evaluate(() => !!game.findRing), 'a ring around it');
  await shot('03-seen');
  await page.evaluate(() => {
    const c = game.findCar;
    game.me.x = c.x + Math.cos(c.th + Math.PI / 2) * 2.2;
    game.me.y = c.y + Math.sin(c.th + Math.PI / 2) * 2.2;
    game.action();
  });
  assert.ok(await page.evaluate(() => game.car === game.findCar), 'in the car');
  await line('back to the pump');
  assert.ok(await page.evaluate(() => !!game.mapView().drop), 'the ring at the pump');
  await shot('04-in');
  await page.evaluate(() => game.action());
  await line('Get back in');
  await page.evaluate(() => game.action());
  await page.waitForFunction(() => game.car === game.findCar);

  console.log('Handed over at the pump');
  const cash = await page.evaluate(() => game.cash);
  await page.evaluate(() => {
    const c = game.findCar;
    const [x, y] = game.local(game.findDrop);
    c.x = x;
    c.y = y;
    c.vx = 0;
    c.vy = 0;
  });
  await line('Handed over');
  assert.equal(await page.evaluate(() => game.find), null, 'the search is over');
  assert.ok((await page.evaluate(() => game.cash)) >= cash + 150, 'it paid');
  await page.waitForFunction(() => story.story.inbox.some((m) => m.who === 'pump' && m.text.includes('You found it')) || [...document.querySelectorAll('#toasts .msg')].some((e) => e.textContent.includes('You found it')), null, { timeout: 60000 });
  await shot('05-thanks');
  const s = await story();
  assert.ok(s.said.includes('find-car'), 'played');
  assert.equal(s.sofar.at(-1).text, "Laura's customer got her car back.");
  assert.ok(await page.evaluate(() => !!game.car), 'still at the wheel of the customer’s car, for the day');

  console.log('Another search, the car lost in the water on the way back: over, not stuck');
  await page.evaluate(() => game.startFind(game.planFind({ kind: 'van', colour: '#e0569b' }, null)));
  await page.waitForFunction(() => game.findCar && !game.findCar.gone);
  await page.evaluate(() => {
    if (game.car) {
      game.car.vx = 0;
      game.car.vy = 0;
      game.action();
    }
    const c = game.findCar;
    game.me.x = c.x + Math.cos(c.th + Math.PI / 2) * 2.2;
    game.me.y = c.y + Math.sin(c.th + Math.PI / 2) * 2.2;
    game.action();
  });
  await page.waitForFunction(() => game.car === game.findCar && game.findStage === 'back');
  await page.evaluate(() => {
    // as sinking does: out of it, and the car gone
    const c = game.car;
    game.car = null;
    c.driver = 'none';
    game.dropCar(c);
  });
  await page.waitForFunction(() => game.find === null);
  await line('Found, but wrecked');
  assert.equal(await page.evaluate(() => game.pickups.length >= 0 && !game.find), true);

  assert.deepEqual(errors, [], 'no errors on the page');
  console.log('Find checks passed');
} finally {
  await browser?.close();
  await server.close();
}
