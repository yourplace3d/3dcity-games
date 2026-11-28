// The trophies in a browser, on real map tiles (Nuremberg): a player who is further on comes back after
// the update of 28 November 2026 (30 trophies where there were 18) and earns what fits at once, in one
// line; the Trophies tab lists all 30, and says how far along a counting one is; a package brought in a
// bus, a police station's job, and a city known within 50 seconds in Where am I? each earn theirs; a
// player on the way sees a bar and a number on each trophy that counts something. The deliveries are said
// by hand, as the test browser runs too slowly to drive. Needs Playwright (see tools/ui-test.mjs).
// SHOTS=<folder> keeps screenshots.
// node tools/trophies-test.mjs
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
    await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'), null, { timeout: 120000 });
    assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());
  };
  const got = () => page.evaluate(() => JSON.parse(localStorage.getItem('3da-trophies') ?? '{"got":{}}').got);
  /** a line from the game that begins with `start`, on screen now or soon: its text */
  const line = async (start) => {
    const h = await page.waitForFunction((p) => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).find((t) => t.startsWith(p)), start, { timeout: 60000 });
    return h.jsonValue();
  };

  console.log('A player who is further on: ten homes in five towns, 500 deliveries, a party thrown, a home renovated');
  const { packHomes } = await server.ssrLoadModule('/src/game/homes.ts');
  const { homeKey } = await server.ssrLoadModule('/src/game/events.ts');
  const { ALL } = await server.ssrLoadModule('/src/trophies.ts');
  assert.equal(ALL.length, 30);
  const DAY = Date.UTC(2026, 10, 23) / 86400000; // 23 November 2026, as a trophy's day is kept
  const home = (id, lat, lon, place, kind = 'flat') => ({ id, lat, lon, kind, paid: 900, rent: 140, street: '', place, at: (DAY - 12) * 86400000, ...(kind === 'building' ? { colour: '#c96f4a' } : {}) });
  const homes = [
    home('901', 49.4521, 11.0767, 'Nuremberg', 'building'),
    ...[2, 3, 4, 5, 6].map((n) => home(`90${n}`, 49.45 + n * 0.002, 11.07, 'Nuremberg')),
    home('911', 49.8917, 10.8858, 'Bamberg'),
    home('912', 48.1372, 11.5755, 'Munich'),
    home('913', 52.52, 13.405, 'Berlin'),
    home('914', 53.5503, 9.9937, 'Hamburg'),
  ];
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // the 18 there were, less the story's and the two a player earns by doing: as the owner's own list stood
  const before = ['car', 'delivery', 'run', 'home', 'bank', 'homes5', 'building', 'painted', 'towns2', 'rent1000', 'lost', 'clean', 'rush', 'deliveries100', 'places5', 'guessed'];
  const seed = {
    'drive-it-3d': JSON.stringify({ cash: 14884, delivered: 500 }),
    '3da-mode': 'jobs',
    '3da-coached': '1',
    '3da-homes': packHomes({ v: 1, homes, paidDay: ymd }),
    '3da-reno': JSON.stringify({ stage: 'done' }),
    '3da-bank': JSON.stringify({ v: 1, saved: 4 }),
    '3da-banklesson': JSON.stringify({ v: 1, stage: 'done', rent: true }),
    '3da-pointsnote': '1',
    '3da-rentnotes': '9',
    '3da-party': JSON.stringify({ v: 1, paid: '2026-11-24', places: {}, best: {}, warned: true }),
    // the first building's day is kept when its own repairs end; the second home was renovated after its walls wore down
    '3da-events': JSON.stringify({ v: 1, open: [], last: ymd, first: 'before', renovated: { [homeKey(homes[0])]: DAY - 5, [homeKey(homes[1])]: DAY + 2 }, disputed: {}, settled: 0, lower: {}, moved: {}, glad: [] }),
    // Nuremberg, Berlin, New York and Rio de Janeiro among the places played
    '3da-trophies': JSON.stringify({ v: 1, got: Object.fromEntries(before.map((id, i) => [id, DAY + (i % 3)])), places: ['49.45,11.08', '52.52,13.40', '40.71,-74.01', '-22.91,-43.20', '48.14,11.58'] }),
  };
  await page.goto(base);
  await page.evaluate((s) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
  await playing();

  console.log('What fits is earned at once, in one line');
  const said = await line('7 trophies: ');
  for (const name of ['Ten homes', 'Good as new', 'Five towns', 'Full house', '500 deliveries', 'Far from home', 'Across the equator']) assert.ok(said.includes(name), `${name} in: ${said}`);
  await shot('01-at-once');
  let have = await got();
  for (const id of ['homes10', 'renovated', 'towns5', 'party', 'deliveries500', 'far', 'equator']) assert.ok(have[id] > 0, id);
  // what is done in play is not given for what a player has
  for (const id of ['care', 'book', 'found', 'bus', 'sight', 'story', 'places20']) assert.equal(have[id], undefined, id);
  // the days of the ones there were stay as they were
  assert.equal(have.car, DAY);
  assert.equal(Object.keys(have).length, before.length + 7);

  console.log('The Trophies tab lists all 30, the new ones in their groups');
  await page.keyboard.press('Escape');
  await page.locator('#tab-trophies').click();
  assert.match(await page.locator('#trophies-line').textContent(), /^23 of 30 earned\./);
  const groups = await page.evaluate(() => [...document.querySelectorAll('#trophies-list .trophy-group')].map((g) => [g.querySelector('.town-head b').textContent, g.querySelector('.town-head small').textContent, g.querySelectorAll('li').length, g.querySelectorAll('li.locked').length]));
  assert.deepEqual(groups, [
    ['Getting started', '5 of 5 earned', 5, 0],
    ['Real estate', '9 of 10 earned', 10, 1],
    ['Driving', '5 of 9 earned', 9, 4],
    ['Places', '4 of 6 earned', 6, 2],
  ]);
  const locked = await page.evaluate(() => [...document.querySelectorAll('#trophies-list li.locked')].map((li) => `${li.querySelector('b').textContent}: ${li.querySelector('small').textContent}`));
  assert.deepEqual(locked, [
    'The whole story: Play the story to its last chapter: settle a dispute with your tenants',
    'Not a dent: Deliver a car for a garage: not a dent on the way',
    'By the book: Finish a police station’s job: no law broken on the way',
    'Found it: Find the car the pump asks you to look for, and drive it back',
    'By bus: Deliver a package in a bus',
    'Twenty places: Play in 20 places, each a town or more apart',
    'At first sight: Make 800 points or more in Where am I?',
  ]);
  // how far along: the one counting trophy still to earn has the bar and its number, and no other has
  const bars = () => page.evaluate(() => [...document.querySelectorAll('#trophies-list li')].flatMap((li) => (li.querySelector('.sofar') ? [`${li.querySelector('b').textContent}: ${li.querySelector('.sofar-n').textContent}, ${li.querySelector('.sofar i').style.width}`] : [])));
  assert.deepEqual(await bars(), ['Twenty places: 5 of 20, 25%']);
  // every disc is drawn: a sign of some size on each
  const flat = await page.evaluate(() => [...document.querySelectorAll('#trophies-list .disc svg g')].filter((g) => g.getBBox().width < 12 || g.getBBox().height < 12).length);
  assert.equal(flat, 0, 'a sign on every disc');
  await shot('02-tab', page.locator('#pause .card'));
  if (SHOTS) {
    // the whole list, however long: one picture of each group
    const n = await page.locator('#trophies-list .trophy-group').count();
    for (let i = 0; i < n; i++) {
      await page.locator('#trophies-list .trophy-group').nth(i).scrollIntoViewIfNeeded();
      await shot(`03-group-${i + 1}`, page.locator('#trophies-list .trophy-group').nth(i));
    }
  }
  await page.keyboard.press('Escape');

  console.log('In play: a police station’s job, a package in a bus');
  // said by hand, as the game says them: the wiring from the game's events to the trophies is what is checked
  const deliver = (job, car) =>
    page.evaluate(
      ([job, car]) => {
        const was = game.car;
        game.car = { kind: car };
        try {
          game.emit({ kind: 'delivered', job, left: 5, special: false, dented: false });
        } finally {
          game.car = was;
        }
      },
      [job, car],
    );
  // a supply run earns nothing of its own, with or without a dent: "Not a dent" is the garage's car delivery (tools/care-test.mjs)
  await deliver('supply', 'van');
  await deliver('plain', 'sedan');
  have = await got();
  assert.equal(Object.keys(have).length, before.length + 7);
  await deliver('clean', 'sedan');
  assert.equal(await line('Trophy: By the book'), 'Trophy: By the book');
  await deliver('plain', 'bus');
  await line('Trophy: By bus');
  have = await got();
  for (const id of ['book', 'bus']) assert.ok(have[id] > 0, id);
  assert.equal(have.found, undefined);

  console.log('Where am I?: the right city at once is "At first sight"; the city alone was earned before');
  const { packGuess } = await server.ssrLoadModule('/src/guess.ts');
  const code = packGuess({ name: 'Test', points: 500, seconds: 125, wrong: 0, round: { city: 'Berlin', at: { lat: 52.52, lon: 13.405 }, options: ['Berlin', 'Hamburg', 'Paris', 'London'] } });
  await page.goto(`${base}?g=${code}`, { timeout: 60000 });
  await playing();
  await page.locator('#btn-guess').click();
  await page.getByRole('button', { name: 'Berlin', exact: true }).click();
  const points = Number((await page.locator('#guess-score').textContent()).replace(/\D/g, ''));
  assert.ok(points >= 800, `picked within 50 seconds: ${points}`);
  await line('Trophy: At first sight');
  have = await got();
  assert.ok(have.sight > 0);
  // a city to guess is no place played: it changed neither the places nor the furthest
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('3da-trophies')).places)).length, 5);
  await shot('04-sight');

  console.log('A player on the way: a bar and a number on each trophy that counts something');
  const some = [
    home('801', 49.4521, 11.0767, 'Nuremberg'),
    ...[2, 3, 4].map((n) => home(`80${n}`, 49.45 + n * 0.002, 11.07, 'Nuremberg')),
    home('811', 49.8917, 10.8858, 'Bamberg'),
    home('812', 48.1372, 11.5755, 'Munich'),
    // rent follows from the price paid (`rentFor`): $140 a day each, $840 for the six
  ].map((h) => ({ ...h, paid: 583 }));
  const sofar = ['car', 'delivery', 'run', 'home', 'bank', 'homes5', 'towns2', 'deliveries100'];
  await page.goto(base);
  await page.evaluate(
    (s) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    },
    {
      'drive-it-3d': JSON.stringify({ cash: 900, delivered: 312 }),
      '3da-mode': 'jobs',
      '3da-coached': '1',
      '3da-homes': packHomes({ v: 1, homes: some, paidDay: ymd }),
      '3da-reno': JSON.stringify({ stage: 'done' }),
      '3da-bank': JSON.stringify({ v: 1, saved: 4 }),
      '3da-banklesson': JSON.stringify({ v: 1, stage: 'done', rent: true }),
      '3da-pointsnote': '1',
      '3da-rentnotes': '9',
      '3da-trophies': JSON.stringify({ v: 1, got: Object.fromEntries(sofar.map((id) => [id, DAY])), places: ['49.45,11.08', '52.52,13.40', '48.14,11.58'] }),
    },
  );
  await page.goto(`${base}?n=${Math.random()}#Nuremberg`);
  await playing();
  // the first look at what the player has, a second in
  await page.waitForFunction(() => window.game?.clock > 2, null, { timeout: 120000 });
  await page.keyboard.press('Escape');
  await page.locator('#tab-trophies').click();
  have = await got();
  assert.deepEqual(Object.keys(have).filter((id) => !sofar.includes(id)), [], 'nothing more is earned at once');
  assert.match(await page.locator('#trophies-line').textContent(), /^8 of 30 earned\./);
  assert.deepEqual(await bars(), ['Ten homes: 6 of 10, 60%', 'Five towns: 3 of 5, 60%', '$1,000 a day: $840 of $1,000, 84%', '500 deliveries: 312 of 500, 62%', 'Five places: 3 of 5, 60%', 'Twenty places: 3 of 20, 15%']);
  // the bar sits within its trophy, under the words
  const out = await page.evaluate(() => [...document.querySelectorAll('#trophies-list li')].filter((li) => li.querySelector('.sofar') && (li.querySelector('.sofar').getBoundingClientRect().width > li.getBoundingClientRect().width || li.querySelector('.sofar').getBoundingClientRect().top < li.querySelector('small').getBoundingClientRect().bottom - 1)).length);
  assert.equal(out, 0, 'each bar under its words, no wider than its trophy');
  await shot('05-on-the-way', page.locator('#pause .card'));
  if (SHOTS) {
    const n = await page.locator('#trophies-list .trophy-group').count();
    for (let i = 0; i < n; i++) {
      await page.locator('#trophies-list .trophy-group').nth(i).scrollIntoViewIfNeeded();
      await shot(`06-group-${i + 1}`, page.locator('#trophies-list .trophy-group').nth(i));
    }
  }

  assert.deepEqual(errors, [], 'no errors on the page');
  console.log('Trophy checks passed');
} finally {
  await browser?.close();
  await server.close();
}
