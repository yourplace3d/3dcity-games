// The garage, its own job and the trophies, for the preview check (../preview-check.mjs): pictures of each
// on a tablet and on a phone, with a player who is on the way (six homes in three towns, 312 deliveries,
// three cars kept in Hamburg, one car delivery done). Played in English, in Hamburg, the player moved by
// hand to the nearest garage. Never fails the check.
export default async function garage({ browser, base, out, sizes }) {
  const day = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const flat = (id, lat, lon, place) => ({ id, lat, lon, kind: 'flat', paid: 583, street: '', place, at: now - 12 * 86400000 });
  const HAM = [53.5503, 9.9937];
  const kept = (id, more) => ({ id, lat: HAM[0], lon: HAM[1], at: now - id * 86400000, ...more });
  const seed = {
    '3da-lang': 'en',
    '3da-mode': 'jobs',
    '3da-coached': '1',
    '3da-discord': JSON.stringify({ card: true }),
    'drive-it-3d': JSON.stringify({ cash: 5200, delivered: 312 }),
    '3da-homes': JSON.stringify({ v: 1, homes: [flat('g1', 53.5503, 9.9937, 'Hamburg'), flat('g2', 53.553, 9.99, 'Hamburg'), flat('g3', 53.556, 9.985, 'Hamburg'), flat('g4', 53.559, 9.98, 'Hamburg'), flat('g5', 54.3233, 10.1228, 'Kiel'), flat('g6', 53.0793, 8.8017, 'Bremen')], paidDay: day }),
    '3da-reno': JSON.stringify({ stage: 'done' }),
    '3da-bank': JSON.stringify({ v: 1, saved: 400 }),
    '3da-banklesson': JSON.stringify({ v: 1, stage: 'done', rent: true }),
    '3da-pointsnote': '1',
    '3da-rentnotes': '9',
    // nothing new at the homes today, and the story told: no card comes over the garage
    '3da-events': JSON.stringify({ v: 1, open: [], last: day, first: 'before', renovated: {}, disputed: {}, settled: 1, lower: {}, moved: {}, glad: [] }),
    '3da-story': JSON.stringify({ v: 1, open: 9, opened: '', last: day, first: day, kinds: ['supply', 'rush', 'clean'], said: ['regulars', 'find-car'], inbox: [], pending: [], turn: 0, sofar: [], offered: {}, done: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, { day, silent: true }])) }),
    '3da-trophies': JSON.stringify({ v: 1, got: Object.fromEntries(['car', 'delivery', 'run', 'home', 'bank', 'homes5', 'towns2', 'deliveries100', 'story'].map((id) => [id, 20780])), places: ['53.55,9.99', '54.32,10.12', '53.08,8.80'] }),
    // a sports car, a bus still in the town's yellow, and a convertible bought after delivering one: the three spots taken
    '3da-garage': JSON.stringify({ v: 1, next: 4, done: 1, shown: ['convertible'], cars: [kept(1, { kind: 'sport', colour: '#7a3f8f' }), kept(2, { kind: 'bus', colour: '#8a8f96' }), kept(3, { kind: 'sedan', colour: '#efe6c8', special: 'convertible' })] }),
  };
  const runs = [];
  for (const size of sizes) {
    const ctx = await browser.newContext({ viewport: size.viewport, hasTouch: size.hasTouch, isMobile: size.isMobile, locale: 'en-US' });
    await ctx.addInitScript((kv) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    }, seed);
    const page = await ctx.newPage();
    const run = { size: size.name, errors: [] };
    page.on('pageerror', (e) => run.errors.push(e.message));
    await page.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 503, json: { message: 'Offline for this check' } }));
    const shot = (name) => page.screenshot({ path: `${out}/${size.name}-${name}.png` });
    try {
      await page.goto(`${base}?check=1#Hamburg`);
      await page.waitForFunction(() => window.game?.world && window.garage && document.body.dataset.screen === 'play' && garage.spots.length > 0, null, { timeout: 120000 });
      // the opening view from above comes down in seconds of the game, which runs slowly here: wait for it, but not for ever
      await page.waitForFunction(() => game.descent <= 0 && !game.rising, null, { timeout: 150000 }).catch(() => undefined);
      run.garages = await page.evaluate(() => ({ here: game.world.garages.length, onTheMap: game.world.garages.filter((g) => !g.invented).length }));

      // on foot at the nearest garage that stands on a street: its panel, with the cars kept, its own job, and what is for sale
      const toGarage = () =>
        page.evaluate(() => {
          const [px, py] = game.pos();
          const spot = garage.spots.filter((s) => s.line >= 0).sort((a, b) => Math.hypot(a.rx - px, a.ry - py) - Math.hypot(b.rx - px, b.ry - py))[0];
          Object.assign(game.car ?? game.me, { x: spot.rx, y: spot.ry, vx: 0, vy: 0 });
        });
      await toGarage();
      await page.waitForFunction(() => !document.querySelector('#forsale').hidden && !!document.querySelector('#forsale button.care'), null, { timeout: 60000 });
      await page.waitForTimeout(4000);
      run.panel = await page.evaluate(() => {
        const box = document.querySelector('#forsale').getBoundingClientRect();
        return {
          text: document.querySelector('#forsale').innerText.replace(/\n+/g, ' | '),
          // whether it fits the screen, and whether anything in it is cut off at its side
          box: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)],
          screen: [innerWidth, innerHeight],
          scrolls: document.querySelector('#forsale').scrollHeight > document.querySelector('#forsale').clientHeight + 1,
          wider: [...document.querySelectorAll('#forsale *')].filter((e) => e.getBoundingClientRect().right > box.right + 1).length,
        };
      });
      await shot('garage');

      // the garage's own job: a special car, the player in it, and the job's line with no clock
      await page.evaluate(() => document.querySelector('#forsale button.care').click());
      await page.waitForFunction(() => !!game.job?.care, null, { timeout: 30000 });
      await page.waitForTimeout(5000);
      run.delivery = await page.evaluate(() => ({ line: document.querySelector('#job')?.innerText ?? '', lineHeight: Math.round(document.querySelector('#job')?.getBoundingClientRect().height ?? 0), car: game.car?.look ?? null, lines: [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent) }));
      await shot('car-delivery');
      // handed over, stopped at the ring: paid, and "Not a dent" earned
      await page.evaluate(() => {
        const [x, y] = game.local(game.job.to);
        Object.assign(game.car, { x, y, vx: 0, vy: 0 });
      });
      await page.waitForFunction(() => !game.job, null, { timeout: 30000 });
      await page.waitForTimeout(3000);
      run.handedOver = await page.evaluate(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent));
      await shot('car-handed-over');

      // the Trophies tab: thirty, with how far along the counting ones are
      await page.evaluate(() => document.querySelector('#btn-menu')?.click());
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('#tab-trophies')?.click());
      await page.waitForTimeout(800);
      run.trophies = await page.evaluate(() => ({
        line: document.querySelector('#trophies-line')?.textContent ?? '',
        onTheWay: [...document.querySelectorAll('#trophies-list li')].flatMap((li) => (li.querySelector('.sofar-n') ? [`${li.querySelector('b').textContent}: ${li.querySelector('.sofar-n').textContent}`] : [])),
      }));
      await shot('trophies');
      await page.evaluate(() => document.querySelectorAll('#trophies-list .trophy-group')[2]?.scrollIntoView());
      await page.waitForTimeout(500);
      await shot('trophies-driving');
      run.screen = 'play';
    } catch (e) {
      run.screen = 'garage-failed';
      run.status = String(e?.message ?? e).slice(0, 300);
      await shot('garage-failed').catch(() => undefined);
    }
    runs.push(run);
    await ctx.close();
  }
  return runs;
}
