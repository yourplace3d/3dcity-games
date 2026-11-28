// The story played through in a browser, on real map tiles (Nuremberg, then Berlin): a new player's first
// visit to the first flat, then a chapter on each following day, the people's messages on their own papers,
// a player who is further on, the story waiting away from the home town, and chapter 8's dispute.
// Needs Playwright (see tools/ui-test.mjs). SHOTS=<folder> keeps a screenshot of each step.
// node tools/story-test.mjs
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
    const t = Date.now();
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    console.log(`  ${name}: ${Date.now() - t} ms`);
  };
  const playing = async () => {
    await page.waitForFunction(() => (window.game?.world && document.body.dataset.screen === 'play') || document.querySelector('#status').classList.contains('error'), null, { timeout: 120000 });
    assert.equal(await page.locator('body').getAttribute('data-screen'), 'play', await page.locator('#status').textContent());
    // the game runs slowly in a test browser: let the story's clocks run as if a while had been played
    await page.evaluate(() => (story.playedS = 60));
  };
  const story = () => page.evaluate(() => JSON.parse(localStorage.getItem('3da-story') ?? 'null'));
  /** a message from `who` with `part` in it, on screen now or soon */
  const message = async (who, part) => {
    try {
      // on screen now, or shown already and kept with the person's messages
      await page.waitForFunction(
        ([w, p]) => [...document.querySelectorAll('#toasts .msg')].some((e) => e.dataset.who === w && e.textContent.includes(p)) || story.story.inbox.some((m) => m.who === w && m.text.includes(p)),
        [who, part],
        { timeout: 90000 },
      );
    } catch (err) {
      console.log('  waiting for', who, part, JSON.stringify(await page.evaluate(() => ({ queue: story.queue, open: story.story.open, opened: story.story.opened, toasts: [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent), over: game.run.over, menu: !document.querySelector('#pause').hidden, mission: !document.querySelector('#mission').hidden, firsthome: !document.querySelector('#firsthome').hidden, result: !document.querySelector('#result').hidden }))));
      throw err;
    }
    // faded in
    await page.waitForTimeout(1200);
  };
  /** the story's day moves on by one, as on a new day of play */
  const nextDay = () =>
    page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('3da-story'));
      s.last = '2000-01-01';
      localStorage.setItem('3da-story', JSON.stringify(s));
      // The page has the story in memory too and writes it whenever it moves on (a message shown, say). Such
      // a write before the page is loaded again would put today's date back, and the next chapter would not
      // open: so until then nothing more is written of the story.
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k !== '3da-story') set.call(this, k, v);
      };
    });
  const reload = async (place = 'Nuremberg') => {
    await page.goto(`${base}?n=${Math.random()}#${place}`);
    await playing();
  };

  console.log('A new player: chapters 1 to 3 on the first visit');
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('3da-mode', 'jobs');
  });
  await reload();
  await page.locator('#coach-skip').click();
  // a first visit plays a run of three, whatever way to play was kept (the first minute for new players, 28
  // November), and the first flat is offered once the run is over: here the open jobs follow at once, and
  // "Do jobs" is the way to play kept for the days after, as picking it under "Other ways to play" keeps it
  await page.evaluate(() => {
    game.openPlay();
    localStorage.setItem('3da-mode', 'jobs');
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('3da-story') ?? '{}').open === 1);
  await page.evaluate(() => (game.delivered = 1));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('3da-story')).open === 2);
  await page.evaluate(() => {
    game.delivered = 2;
    game.cash = 1500;
  });
  await page.waitForFunction(() => !document.querySelector('#mission').hidden);
  assert.equal(await page.locator('#mission-kicker').textContent(), 'Chapter 3 of 8 · A roof over your head', 'the first flat is chapter 3');
  await shot('01-chapter3-card');
  await page.locator('#btn-mission-yes').click();
  await page.waitForFunction(() => !!homes.area);
  assert.equal(await page.evaluate(() => homes.buy(homes.area.lots[0], 'flat')), true, 'the worn-down flat is bought');
  await page.waitForFunction(() => !document.querySelector('#firsthome').hidden);
  await page.locator('#btn-firsthome-go').click();
  await message('neighbour', 'Welcome to the house');
  await shot('02-neighbour');
  const names = (await story()).names;
  assert.equal(names.region, 'german', 'Nuremberg’s people have German names');
  console.log('  names:', JSON.stringify(names));
  // the first package for the flat, from the pump
  await page.evaluate(() => game.onSpecialTaken('supply'));
  await page.waitForFunction(() => !document.querySelector('#mission').hidden);
  await page.locator('#btn-mission-yes').click();
  await message('pump', 'grey flat');
  assert.ok((await page.locator('#toasts .msg[data-who="pump"] .from').first().textContent()).startsWith(`${names.pump} · `));
  await shot('03-receipt');
  // delivered: the flat is repaired, and chapter 3 is done
  await page.evaluate(() => game.onSpecialDone());
  await message('game', 'Come back tomorrow for chapter 4');
  // as in play, the repair is a supply run delivered; and a keen player does a job at the other stations too
  for (const job of ['supply', 'rush', 'clean']) await page.evaluate((j) => game.events.forEach((f) => f({ kind: 'delivered', job: j, left: 20, special: j === 'supply' })), job);
  assert.deepEqual((await story()).kinds.sort(), ['clean', 'rush', 'supply'], 'a job of each kind on the first day');
  await shot('04-chapter3-done');
  let s = await story();
  assert.deepEqual(Object.keys(s.done).map(Number), [1, 2, 3]);
  assert.ok(Object.values(s.done).every((d) => !d.silent), 'played, not ticked');
  assert.equal(s.open, 4);
  assert.equal(s.opened, '', 'chapter 4 waits for the next day');
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  assert.match(await page.locator('#pane-story').textContent(), /Opens on your next day of play/);
  await shot('05-story-tab-day1');
  await page.keyboard.press('KeyP');

  console.log('The next day: chapter 4, safe money');
  await nextDay();
  await reload();
  await message('game', 'pay it in at a bank');
  await shot('06-chapter4');
  await page.evaluate(() => {
    game.cash = 800;
    homes.payIn();
  });
  // chapter 5 is not ticked unseen, though a job of each kind is done: its people write on its day
  await message('game', 'Come back tomorrow for chapter 5');
  s = await story();
  assert.equal(s.open, 5, 'chapter 5 waits for its day');
  assert.equal(s.done[5], undefined);

  console.log('The next day: chapter 5, the regulars');
  await nextDay();
  await reload();
  await message('flame', 'fire station');
  await shot('07-pager');
  await message('shield', 'by the book');
  await shot('08-notebook');
  assert.equal(await page.locator('#toasts .msg[data-who="pump"]').count(), 0, 'Mira has written before: she is not introduced again');
  s = await story();
  assert.deepEqual(s.kinds, ['supply'], 'the job for the one who has written counts; the others are still to do');
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  assert.match(await page.locator('#pane-story .story-now p').textContent(), new RegExp(`^Do a job for ${names.flame} at the fire station and ${names.shield} at the police station\\.$`));
  await page.keyboard.press('KeyP');
  // another job for her is no part of the chapter: no thanks for it
  await page.evaluate(() => game.events.forEach((f) => f({ kind: 'delivered', job: 'supply', left: 20, special: false })));
  assert.equal((await story()).said.includes('thanks-supply'), false, 'no thanks from someone the chapter does not ask for');
  for (const job of ['rush', 'clean']) await page.evaluate((j) => game.events.forEach((f) => f({ kind: 'delivered', job: j, left: 20, special: false })), job);
  await message('flame', 'That was quick');
  await message('game', 'know you now');
  await shot('09-chapter5-done');
  s = await story();
  assert.deepEqual(s.kinds.sort(), ['clean', 'rush', 'supply']);
  assert.equal(s.open, 6);

  console.log('The next day: chapter 6, housewarming, opened in another part of the home town');
  await nextDay();
  // 3 km north of the flat: still Nuremberg, but the flat is not in the part of town loaded
  const flat = await page.evaluate(() => ({ lat: homes.homes.homes[0].lat, lon: homes.homes.homes[0].lon, street: homes.homes.homes[0].street }));
  await reload(`${(flat.lat + 0.027).toFixed(5)},${flat.lon.toFixed(5)}`);
  assert.equal(await page.evaluate(() => homes.atHomeTown()), true, 'the home town');
  assert.equal(await page.evaluate(() => homes.isHere(homes.homes.homes[0])), false, 'the flat is in another part of it');
  await message('game', 'in another part of town');
  await shot('10a-another-part-of-town');
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  const toFlat = page.locator('#pane-story button.primary');
  assert.equal(await toFlat.textContent(), `Go to your flat${flat.street ? ` on ${flat.street}` : ''}`, 'the Story tab leads to the flat, not to an arrow that cannot show');
  await shot('10b-go-to-flat');
  await toFlat.click();
  await playing();
  assert.equal(await page.evaluate(() => homes.isHere(homes.homes.homes[0])), true, 'beside the flat');
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  assert.equal(await page.locator('#pane-story button.primary').textContent(), 'Show the way');
  assert.match(await page.locator('#pane-story .story-now p').textContent(), /^Throw a party at your home/);
  await page.keyboard.press('KeyP');
  await message('friends', 'Nobody got food');
  await shot('10-friends');
  await page.evaluate(() => localStorage.setItem('3da-party', JSON.stringify({ paid: '', places: {}, best: { x: 300 }, warned: false })));
  await message('friends', 'Best night');

  console.log('The next day: chapter 7, the whole building');
  await nextDay();
  await reload();
  await message('neighbour', 'selling the rest of the house');
  await shot('11-chapter7');
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  assert.equal(await page.locator('#pane-story .chapters li[data-state="done"]').count(), 6);
  assert.equal(await page.locator('#pane-story .chapters li[data-state="open"]').count(), 1);
  assert.ok((await page.locator('#pane-story .inbox .msg').count()) >= 8, 'the messages are kept');
  await shot('12-story-tab-day5');
  await page.keyboard.press('KeyP');

  console.log('A player who is further on: ticked silently, the open chapter said');
  await page.evaluate(() => localStorage.removeItem('3da-story'));
  await reload();
  await message('pump', 'new around here');
  s = await story();
  assert.deepEqual(Object.keys(s.done).map(Number), [1, 2, 3, 4, 6]);
  assert.ok(Object.values(s.done).every((d) => d.silent));
  assert.equal(s.open, 5, 'the people at the stations come first');

  console.log('Away from the home town: chapter 7 opens there, its message waits for home');
  for (const job of ['rush', 'clean', 'supply']) await page.evaluate((j) => game.events.forEach((f) => f({ kind: 'delivered', job: j, left: 20, special: false })), job);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('3da-story')).open === 7);
  await nextDay();
  await reload('Berlin');
  await message('game', 'Waits in Nuremberg');
  await shot('13-away');
  await page.waitForTimeout(4000);
  assert.equal(await page.locator('#toasts .msg[data-who="neighbour"]').count(), 0, 'no neighbour’s card away from home');
  assert.equal((await story()).pending.filter((m) => m.who === 'neighbour').length, 1, 'it is kept for home');
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  const go = page.locator('#pane-story button', { hasText: 'Go to Nuremberg' });
  assert.equal(await go.count(), 1);
  await go.click();
  await playing();
  assert.match(await page.evaluate(() => homes.homeTownName()), /Nuremberg/);
  assert.equal(await page.evaluate(() => homes.atHomeTown()), true, 'back in the home town');
  await message('neighbour', 'selling the rest');
  assert.equal((await story()).pending.length, 0, 'shown at home');

  console.log('On a phone');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    story.queue.push({ who: 'flame', text: 'Need someone quick. Come by the fire station.' }, { who: 'shield', text: 'Clean all the way. Thank you.' });
  });
  await message('flame', 'Need someone quick');
  await shot('14-phone');

  console.log('Chapter 8, the tenants: insisting, too late, the court\'s order and new tenants');
  await page.setViewportSize({ width: 1280, height: 800 });
  // chapter 7 done, as the mission would leave it: the whole building, every flat repaired
  await page.evaluate(async () => {
    const m = await import('/src/game/homes.ts');
    homes.homes.homes[0].kind = 'building';
    m.saveHomes(homes.homes);
    homes.setReno({ stage: 'done' });
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('3da-story')).done[7]);
  await nextDay();
  await reload();
  await message('game', 'Your tenants have something to say');
  await page.waitForFunction(() => !document.querySelector('#mission').hidden && document.querySelector('#mission-title').textContent === 'A note from your tenants', null, { timeout: 90000 });
  assert.equal(await page.locator('#mission-kicker').textContent(), 'Chapter 8 of 8 · Landlord');
  await shot('15-tenants-card');
  await page.locator('#btn-mission-yes').click();
  const d = await page.evaluate(() => ({ stage: homes.dispute().stage, way: !!game.guide || !!homes.wayTo }));
  assert.equal(d.stage, 'talk');
  // the mood is the one thing left to chance: this run, the heating
  await page.evaluate(() => (homes.events.open.find((e) => e.kind === 'dispute').mood = 'broken'));
  // stopped beside the building: the choice, with a third button to put it off
  await page.evaluate(() => homes.talk(homes.dispute().home));
  await page.waitForFunction(() => !document.querySelector('#mission').hidden);
  assert.equal(await page.locator('#mission-title').textContent(), 'Your tenants want to talk');
  assert.equal(await page.locator('#btn-mission-later').isVisible(), true, 'Not now');
  await shot('16-choice');
  await page.locator('#btn-mission-later').click();
  assert.equal(await page.evaluate(() => homes.dispute().stage), 'talk', 'Not now changes nothing');
  await page.evaluate(() => homes.talk(homes.dispute().home));
  await page.waitForFunction(() => !document.querySelector('#mission').hidden);
  await page.locator('#btn-mission-yes').click();
  assert.deepEqual(await page.evaluate(() => game.special.kinds), ['rush'], 'insisting: the part from a fire station');
  // the fire station may lie across the line where the next part of town loads (450 m from the middle of a
  // square 1.5 km across): walk 600 m off, away from the building, and the part still goes to it
  assert.equal(await page.evaluate(() => homes.isHere(homes.dispute().home) && game.specialHere()), true, 'the building is in this part of town');
  await page.evaluate(() => {
    const h = homes.dispute().home;
    const [bx, by] = game.world.proj.toLocal(h.lon, h.lat);
    const along = Math.abs(bx) >= Math.abs(by);
    const off = (along ? bx : by) > 0 ? -600 : 600;
    const n = game.world.roads.nearest(along ? off : 0, along ? 0 : off, 300, 'traffic');
    const [x, y] = n ? game.world.roads.point(n.line, n.s) : [along ? off : 0, along ? 0 : off];
    game.me.x = x;
    game.me.y = y;
  });
  await page.waitForFunction(() => !homes.isHere(homes.dispute().home), null, { timeout: 180000 });
  assert.equal(await page.evaluate(() => game.specialHere()), true, 'the next part of town has left the building behind: its door is kept, the rings still flash green');
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  assert.equal(await page.locator('#pane-story button.primary').textContent(), 'Show the way', 'no trip back for a package that can be taken here');
  await shot('16a-beyond-the-square');
  await page.keyboard.press('KeyP');
  // the part is taken, and comes too late
  await page.evaluate(() => {
    game.onSpecialTaken('rush');
    game.onSpecialLost('late');
  });
  await page.waitForFunction(() => !document.querySelector('#mission').hidden && document.querySelector('#mission-title').textContent === 'The court’s order');
  assert.match(await page.locator('#mission-text').textContent(), new RegExp(`${names.shield} and a colleague`));
  await shot('17-court');
  await page.locator('#btn-mission-yes').click();
  await message('tenants', 'Still no heating');
  await shot('18-tenants-note');
  await message('shield', "court's order");
  assert.deepEqual(await page.evaluate(() => game.special.kinds), ['clean'], 'the court’s order: a clean run');
  // carried out by the book, then the next delivery brings new tenants
  await page.evaluate(() => {
    game.onSpecialTaken('clean');
    game.delivered++;
    game.onSpecialDone(false);
  });
  assert.equal(await page.evaluate(() => homes.dispute().stage), 'moving');
  await page.evaluate(() => {
    game.delivered++;
    game.events.forEach((f) => f({ kind: 'delivered', job: 'plain', left: 10, special: false }));
  });
  await message('tenants', 'Thanks for having us');
  await message('game', "That's the whole story so far");
  // the court's order brought new tenants: the last line doesn't say they know you
  await message('game', 'and new tenants.');
  await message('game', 'have more for you');
  s = await story();
  assert.ok(s.done[8] && !s.done[8].silent, 'chapter 8 played');
  assert.equal(s.sofar.length, 1);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('3da-trophies')).got.story > 0);
  await page.keyboard.press('KeyP');
  await page.locator('#tab-story').click();
  assert.match(await page.locator('#pane-story').textContent(), /The whole story, played/);
  assert.match(await page.locator('#pane-story .sofar').textContent(), /court ordered them out/);
  await shot('19-story-tab-done');
  await page.keyboard.press('KeyP');

  assert.deepEqual(errors, [], 'no errors on the page');
  console.log('Story checks passed');
} finally {
  await browser?.close();
  await server.close();
}
