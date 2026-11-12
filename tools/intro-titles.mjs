// Renders the intro's titles as transparent 1080x1920 PNGs in the 3DA look. node tools/intro-titles.mjs <outDir>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2];
const mark = readFileSync(new URL('../brand/wordmark-on-dark.svg', import.meta.url), 'utf8');
const step = (n, html) => `<div class="step"><i>${n}</i><p>${html}</p></div>`;
const cards = {
  hook: `<div class="hook"><small>3DA</small><h1>Guess<br>the city.</h1></div>`,
  car: step(1, 'Walk up to a car.<br>Get in.'),
  pickup: step(2, 'Drive through a <b class="c">blue ring</b><br>to pick up a package.'),
  clock: step(3, 'Follow the arrow.<br>Beat the clock.'),
  drop: step(4, 'The <b class="y">yellow ring</b><br>pays you.'),
  police: step(5, 'Trouble brings<br>the <b class="r">police</b>.'),
  ask: `<div class="ask"><h1>Which city<br>is this?</h1></div>`,
  end: `<div class="end">${mark}<p>Drive any city.</p><u>yourplace3d.github.io/3dcity-games</u><small>Map data © OpenStreetMap contributors</small></div>`,
};
const css = `
html,body{margin:0;width:1080px;height:1920px;background:transparent;font-family:'Inter Display','Inter',sans-serif;color:#f4f1ea}
.step{position:absolute;left:70px;right:70px;top:1210px;display:flex;gap:30px;align-items:center;padding:34px 40px;border-radius:36px;background:rgba(28,31,36,.93);border:2px solid rgba(255,255,255,.14);box-shadow:0 14px 50px rgba(0,0,0,.35)}
.step i{flex:none;width:96px;height:96px;border-radius:50%;background:#ffd400;color:#1c1f24;font:900 58px/96px 'Inter Display';text-align:center;font-style:normal}
.step p{margin:0;font-weight:800;font-size:58px;line-height:1.14;letter-spacing:-.01em}
b.c{color:#2bd4e0}b.y{color:#ffd400}b.r{color:#ff5a4d}
.hook,.ask{position:absolute;left:70px;right:70px;top:480px;padding:44px 50px 50px;border-radius:40px;background:rgba(28,31,36,.93);border:2px solid rgba(255,255,255,.14);box-shadow:0 14px 50px rgba(0,0,0,.35)}
.hook small{display:block;color:#ffd400;font-weight:800;font-size:34px;letter-spacing:.14em;margin-bottom:10px}
h1{margin:0;font-weight:900;font-size:128px;line-height:1.0;letter-spacing:-.025em}
.ask{top:240px;border-left:14px solid #ffd400}
.ask h1{font-size:112px}
.end{position:absolute;left:0;right:0;bottom:0;padding:60px 70px 250px;background:linear-gradient(rgba(28,31,36,0),rgba(28,31,36,.95) 26%,#1c1f24);text-align:center}
.end svg{width:420px;display:block;margin:110px auto 0}
.end p{margin:14px 0 18px;font-weight:800;font-size:64px;letter-spacing:-.01em}
.end u{display:inline-block;text-decoration:none;font-weight:700;font-size:38px;color:#1c1f24;background:#ffd400;border-radius:999px;padding:14px 34px}
.end small{display:block;margin-top:26px;font-size:24px;font-weight:500;color:#b9b4a8}
`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
for (const [name, html] of Object.entries(cards)) {
  await page.setContent(`<style>${css}</style>${html}`);
  await page.screenshot({ path: `${out}/${name}.png`, omitBackground: true });
}
await browser.close();
