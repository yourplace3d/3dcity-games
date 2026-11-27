// The police and the wrong way down a one-way street, in a browser on real map tiles (Nuremberg): a police
// car that sees it follows at a distance and never catches for it; stopped beside it, a warning and no fine.
// Needs Playwright (see tools/ui-test.mjs). SHOTS=<folder> keeps a screenshot of each step.
// node tools/police-test.mjs
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
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Never write test saves to the live service.
  await page.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 503, json: { message: 'Offline for this test' } }));
  const base = server.resolvedUrls.local[0];
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
  };
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('3da-mode', 'jobs');
    localStorage.setItem('3da-coached', '1');
  });
  await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
  await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'));
  assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());

  console.log('The wrong way down a one-way street, a police car behind');
  const street = await page.evaluate(() => {
    const net = game.world.roads;
    // a one-way street long enough to drive along for a while, well inside the square
    let best = null;
    net.lines.forEach((l, line) => {
      if (!l.oneway || !l.traffic || l.kind === 'motorway' || l.len < 260) return;
      const [x, y] = net.point(line, l.len / 2);
      if (Math.abs(x) > 450 || Math.abs(y) > 450) return;
      if (!best || l.len > best.len) best = { line, len: l.len, oneway: l.oneway };
    });
    if (!best) return null;
    const test = (window.policeTest = { line: best.line, s: best.oneway > 0 ? best.len - 80 : 80, hold: 8, flashed: [], said: [], nearest: Infinity, offences: 0 });
    const flash = game.onFlash;
    game.onFlash = (t, ...rest) => {
      test.flashed.push(t);
      flash(t, ...rest);
    };
    const toast = game.onToast;
    game.onToast = (t, ...rest) => {
      test.said.push(t);
      toast(t, ...rest);
    };
    game.cash = 1000;
    // against the way the street goes, from 80 m before its far end
    const [hx, hy] = net.heading({ line: best.line, s: test.s, dir: best.oneway });
    const [x, y] = net.point(best.line, test.s);
    const me = game.addCar('sedan', x, y, Math.atan2(-hy, -hx));
    me.driver = 'player';
    game.car = me;
    test.me = me;
    // a police car 45 m behind on the same street, facing the same way
    const [cx, cy] = net.point(best.line, test.s + best.oneway * 45);
    const cop = game.addCar('police', cx, cy, Math.atan2(-hy, -hx));
    cop.driver = 'cop';
    test.cop = cop;
    game.ticks.push(() => {
      // nobody else on the street: a knock with traffic would be an offence of its own
      for (const c of [...game.cars]) if (c !== me && c !== cop && !c.gone) game.dropCar(c);
      for (let i = game.people.length - 1; i >= 0; i--) game.dropPerson(i);
      // the player keeps the car going along the street, against its way, at `hold` m/s
      if (test.hold > 0 && game.car === me) {
        const n = net.nearest(me.x, me.y, 30, 'drive');
        const [ax, ay] = n ? net.heading({ line: n.line, s: n.s, dir: net.lines[n.line].oneway || 1 }) : [hx, hy];
        const against = n && n.line === best.line ? [-ax, -ay] : [-hx, -hy];
        me.vx = against[0] * test.hold;
        me.vy = against[1] * test.hold;
        me.th = Math.atan2(against[1], against[0]);
      } else if (game.car === me) {
        me.vx = 0;
        me.vy = 0;
      }
      if (game.heat > 0) test.nearest = Math.min(test.nearest, Math.hypot(cop.x - me.x, cop.y - me.y));
    });
    return { len: Math.round(best.len), oneway: best.oneway };
  });
  assert.ok(street, 'a one-way street in this part of Nuremberg');
  console.log('  the street:', JSON.stringify(street));
  await page.waitForFunction(() => game.heat > 0);
  assert.equal(await page.evaluate(() => game.heat), 1, 'one badge: they follow');
  assert.match((await page.evaluate(() => policeTest.said)).join(' | '), /Wrong way down a one-way street: the police follow you/);
  await shot('01-followed');

  console.log('They follow at a distance: no knock, no chase');
  const t0 = await page.evaluate(() => game.clock);
  // four seconds of the game's time, still the wrong way, still in their sight
  await page.waitForFunction((t) => game.clock - t > 4, t0);
  let now = await page.evaluate(() => ({ heat: game.heat, nearest: policeTest.nearest, cash: game.cash, flashed: policeTest.flashed, gap: Math.hypot(policeTest.cop.x - policeTest.me.x, policeTest.cop.y - policeTest.me.y), inCar: game.car === policeTest.me }));
  console.log('  after 4 s:', JSON.stringify(now));
  assert.equal(now.heat, 1, 'still one badge while the wrong way goes on in their sight');
  assert.ok(now.nearest > 7, `the police car kept off: never nearer than ${now.nearest.toFixed(1)} m`);
  assert.deepEqual(now.flashed, []);
  await shot('02-at-a-distance');

  console.log('Stopped for them: a warning, no fine, still in the car');
  await page.evaluate(() => (policeTest.hold = 0));
  await page.waitForFunction(() => game.heat === 0);
  now = await page.evaluate(() => ({ cash: game.cash, flashed: policeTest.flashed, said: policeTest.said.at(-1), inCar: game.car === policeTest.me, gone: policeTest.me.gone }));
  console.log('  then:', JSON.stringify(now));
  assert.equal(now.cash, 1000, 'nothing paid');
  assert.deepEqual(now.flashed, [], 'no "Caught!"');
  assert.equal(now.inCar, true, 'still in the car');
  assert.match(now.said, /The police let (you off with a warning: no fine for the wrong way|it go)/);
  await shot('03-let-off');

  assert.deepEqual(errors, [], 'no errors on the page');
  console.log('Police checks passed');
} finally {
  await browser?.close();
  await server.close();
}
