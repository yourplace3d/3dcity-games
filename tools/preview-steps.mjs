// Steps of the preview check (tools/preview-check.mjs) for the change being looked at: they run once the
// city has reached play, at each screen size, and take pictures of what the change shows. Replace them
// with your own change's steps; delete the file for none.
//   export default async (page, { size, place, out, note }) => { … }
//
// Now: more driving skill. Sit in the nearest car, pass a car close by, hold the handbrake round for a 180,
// then the bonuses (police shaken off, a perfect delivery), and look at the menu's card. The game is stepped by hand
// (`game.update`), so it doesn't depend on how fast the test browser draws.

export default async function steps(page, { size, out, note }) {
  const shot = (name) => page.screenshot({ path: `${out}/${size}-skill-${name}.png`, timeout: 90000 });
  await page.evaluate(() => {
    for (const id of ['coach-skip']) document.getElementById(id)?.click();
    const g = window.game;
    window.__ev = [];
    const said = g.onSkill;
    g.onSkill = (e, at) => { window.__ev.push(`${e.kind}:${e.move ?? ''}:${e.points ?? ''}`); said(e, at); };
    const c = g.cars.filter((c) => c.driver === 'none' || c.driver === 'ai').filter((c) => ['sedan', 'sport', 'van', 'police'].includes(c.kind))
      .sort((a, b) => Math.hypot(a.x - g.me.x, a.y - g.me.y) - Math.hypot(b.x - g.me.x, b.y - g.me.y))[0];
    g.seat(c);
    // just short of level 2, so the chain below brings a level-up
    g.skill.save.total = 30;
  });
  const drive = (keys, frames) => page.evaluate(([keys, frames]) => {
    const g = window.game;
    // the picture is drawn once at the end: a real city in software graphics is slow to draw
    g.render = false;
    for (let i = 0; i < frames; i++) {
      const o = window.__o;
      if (o) Object.assign(o, { th: g.car.th + Math.PI, vx: -Math.cos(g.car.th) * 8, vy: -Math.sin(g.car.th) * 8 });
      if (o) window.__gap = Math.min(window.__gap ?? 99, Math.hypot(o.x - g.car.x, o.y - g.car.y));
      g.update(0.02, { moveX: 0, moveY: 0, stick: false, throttle: keys.up ? 1 : 0, steer: keys.left ? 1 : 0, brake: false, handbrake: !!keys.hb });
    }
    g.render = true;
    g.watch(0);
    return window.__ev.slice();
  }, [keys, frames]);
  // stand the car on the nearest street, pointing along it, at a speed (m/s)
  const onStreet = (v) => page.evaluate((v) => {
    const g = window.game;
    const c = g.car;
    const n = g.world.roads.nearest(c.x, c.y, 300, 'traffic') ?? g.world.roads.nearest(c.x, c.y, 300, 'drive');
    const [hx, hy] = g.world.roads.heading({ line: n.line, s: n.s, dir: 1 });
    Object.assign(c, { x: n.x, y: n.y, th: Math.atan2(hy, hx), vx: hx * v, vy: hy * v });
  }, v);
  const stop = () => page.evaluate(() => { const c = window.game.car; c.vx = 0; c.vy = 0; });
  // a car coming the other way, a lane over, to scrape past
  await onStreet(16);
  await page.evaluate(() => {
    const g = window.game;
    const me = g.car;
    const o = g.cars.find((c) => c.driver === 'ai' && c !== me && c.kind === 'sedan') ?? g.cars.find((c) => c.driver === 'ai' && c !== me);
    const fx = Math.cos(me.th);
    const fy = Math.sin(me.th);
    o.x = me.x + fx * 18 - fy * 2.5;
    o.y = me.y + fy * 18 + fx * 2.5;
    window.__o = o;
  });
  await drive({ up: 1 }, 40);
  // past it: stop before running into anything, while it goes on its way and the pass is judged
  await stop();
  note(`after the near miss: ${(await drive({}, 60)).join(', ')} (closest ${(await page.evaluate(() => window.__gap))?.toFixed(1)} m between middles)`);
  await shot('1-near');
  await page.evaluate(() => { window.__o = null; });
  // a 180: the handbrake held at full lock until the car has come round; judged as it goes
  await onStreet(18);
  await drive({ up: 1, left: 1, hb: 1 }, 90);
  await shot('2-spin');
  await stop();
  await drive({}, 16);
  note(`after the 180: ${(await drive({}, 10)).join(', ')}`);
  note(`after the pause: ${(await drive({}, 180)).join(', ')}`);
  // the bonuses: shaking off two stars of police, and a perfect rush delivery, each straight to the total
  await page.evaluate(() => { window.game.skillBonus('escape', 2); window.game.skillBonus('perfect', 1.5); });
  await page.waitForTimeout(350);
  await shot('3-bonus');
  note(`after the bonuses: ${(await page.evaluate(() => window.__ev.slice(-2))).join(', ')}; level shown: ${await page.evaluate(() => document.getElementById('skill-lv')?.textContent)}`);
  await page.evaluate(() => document.getElementById('btn-menu')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('tab-trophies')?.click());
  await page.waitForTimeout(400);
  await shot('4-menu');
}
