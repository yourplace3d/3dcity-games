// Steps of the preview check (tools/preview-check.mjs) for the change being looked at: they run once the
// city has reached play, at each screen size, and take pictures of what the change shows. Replace them
// with your own change's steps; delete the file for none.
//   export default async (page, { size, place, out, note }) => { … }
//
// Now: driving skill (PR 41). Sit in the nearest car, pass a car close by, drift with the handbrake,
// let the chain bank across into level 2, and look at the menu's card. The game is stepped by hand
// (`game.update`), so it doesn't depend on how fast the test browser draws.

export default async function steps(page, { size, out, note }) {
  const shot = (name) => page.screenshot({ path: `${out}/${size}-skill-${name}.png` });
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
    g.skill.save.total = 90;
  });
  const drive = (keys, frames) => page.evaluate(([keys, frames]) => {
    const g = window.game;
    for (let i = 0; i < frames; i++) {
      const o = window.__o;
      if (o) Object.assign(o, { th: g.car.th + Math.PI, vx: -Math.cos(g.car.th) * 8, vy: -Math.sin(g.car.th) * 8 });
      if (o) window.__gap = Math.min(window.__gap ?? 99, Math.hypot(o.x - g.car.x, o.y - g.car.y));
      g.update(0.02, { moveX: 0, moveY: 0, stick: false, throttle: keys.up ? 1 : 0, steer: keys.left ? 1 : 0, brake: false, handbrake: !!keys.hb });
    }
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
  // the handbrake round to the left; judged once the car runs straight again, then stop
  await onStreet(14);
  await drive({ up: 1, left: 1, hb: 1 }, 50);
  await shot('2-drift');
  await drive({ up: 1 }, 16);
  await stop();
  note(`after the drift: ${(await drive({}, 10)).join(', ')}`);
  await shot('3-combo');
  note(`after the pause: ${(await drive({}, 180)).join(', ')}`);
  note(`level shown: ${await page.evaluate(() => document.getElementById('skill-lv')?.textContent)}`);
  await page.waitForTimeout(300);
  await shot('4-level');
  // a level-up as the banner shows it (stepping by hand above takes longer than the banner stays)
  await page.evaluate(() => window.game.onSkill({ kind: 'banked', points: 60, combo: 2, total: 420, levelUp: 2 }, [0, 0]));
  await page.waitForTimeout(900);
  await shot('5-banner');
  await page.evaluate(() => document.getElementById('btn-menu')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('tab-trophies')?.click());
  await page.waitForTimeout(400);
  await shot('6-menu');
}
