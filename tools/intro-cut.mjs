// Cuts the intro film in the trailer's look: neon opener, graded footage with typed pixel titles, then the city as a tilted slab.
// Usage: node tools/intro-cut.mjs <framesDir from intro.mjs> <slab.jpg from intro-still.mjs> <pixel-font.woff2> <outDir>
//   ONLY=12,300,700 renders just those output frames (for a look). Then:
//   ffmpeg -framerate 30 -i outDir/%05d.jpg -c:v libx264 -crf 16 -pix_fmt yuv420p -movflags +faststart intro.mp4
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [src, slab, font, out] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(out, { recursive: true });
const FPS = 30;

// ---- which filmed frames to keep: per step, seconds from its start or (negative) before its end
const cues = Object.fromEntries(JSON.parse(readFileSync(`${src}/cues.json`, 'utf8')).map((c) => [c.name, c.frame]));
const order = ['car', 'pickup', 'clock', 'drop', 'police', 'rise', 'top'];
const keep = { car: [0, 3.7], pickup: [-3.4, null], clock: [0, 2.8], drop: [-3.6, null], police: [0, 3.2], rise: [0, null] };
const frames = [];
const at = {};
for (let i = 0; i < order.length - 1; i++) {
  const a = cues[order[i]];
  const b = cues[order[i + 1]];
  const [lo, hi] = keep[order[i]];
  const first = lo < 0 ? Math.max(a, b + Math.round(lo * FPS)) : a + Math.round(lo * FPS);
  const last = hi === null ? b : Math.min(b, a + Math.round(hi * FPS));
  at[order[i]] = frames.length / FPS;
  for (let f = first; f < last; f++) frames.push(`${src}/${String(f).padStart(5, '0')}.jpg`);
}
const FOOT = frames.length / FPS;
const OPEN = 1.3; // the neon opener, s
const SLAB = 5.2; // the slab and the end titles, s
const TOTAL = OPEN + FOOT + SLAB;

// ---- titles: [from, to, where, lines]; times in film seconds. {c}…{/} colours a word.
const o = (name) => OPEN + at[name];
const titles = [
  [0.45, OPEN + 1.9, 'hook', ['GUESS', 'THE CITY']],
  [OPEN + 2.0, o('pickup'), 'step', ['{n}1/5{/}', 'TAKE ANY CAR']],
  [o('pickup'), o('clock'), 'step', ['{n}2/5{/}', '{c}BLUE RING:{/}', 'PICK UP']],
  [o('clock'), o('drop'), 'step', ['{n}3/5{/}', 'BEAT THE CLOCK']],
  [o('drop'), o('police'), 'step', ['{n}4/5{/}', '{y}YELLOW RING:{/}', 'GET PAID']],
  [o('police'), o('rise') + 0.4, 'step', ['{n}5/5{/}', 'DODGE', 'THE {r}POLICE{/}']],
  [o('rise') + 1.7, OPEN + FOOT + 0.9, 'ask', ['GUESS', 'THE CITY']],
  [OPEN + FOOT + 2.3, TOTAL, 'play', ['OR PLAY THE CITY']],
];

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Pix;src:url('file://${font}')}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#07040f}
#bg{position:absolute;inset:0;background:radial-gradient(900px 1100px at 50% 56%,#2a1066,#12082e 55%,#07040f)}
.grade{filter:saturate(1.18) contrast(1.06)}
.tint{position:absolute;inset:0;background:linear-gradient(180deg,#ff5fb8,#c44dff 55%,#6a4bff);mix-blend-mode:soft-light;opacity:.6}
.tint2{position:absolute;inset:0;background:#ff8fd0;mix-blend-mode:multiply;opacity:.22}
.lift{position:absolute;inset:0;background:#3b0f7a;mix-blend-mode:screen;opacity:.2}
#foot{position:absolute;inset:0}
#foot img{position:absolute;inset:0;width:1080px;height:1920px}
#stage3d{position:absolute;inset:0;perspective:2600px;perspective-origin:50% 50%}
#slab{position:absolute;left:-420px;top:0;width:1920px;height:1920px;transform-style:preserve-3d}
#top{position:absolute;inset:0;background:url('file://${slab}') center/100% 100%}
.side{position:absolute;background:#1a0d33}
#sS{left:0;top:100%;width:100%;height:46px;transform-origin:top;transform:rotateX(-90deg)}
#sN{left:0;top:-46px;width:100%;height:46px;transform-origin:bottom;transform:rotateX(90deg)}
#sE{left:100%;top:0;width:46px;height:100%;transform-origin:left;transform:rotateY(90deg);background:#241247}
#sW{left:-46px;top:0;width:46px;height:100%;transform-origin:right;transform:rotateY(-90deg);background:#241247}
#open{position:absolute;inset:0;background:#07040f;overflow:hidden}
#sky{position:absolute;left:0;right:0;top:0;height:960px;background:linear-gradient(180deg,#07040f 55%,#3a0d5c 86%,#ff2bd6 99%)}
#glow{position:absolute;left:-10%;right:-10%;top:880px;height:150px;background:radial-gradient(closest-side,rgba(255,43,214,.9),rgba(255,43,214,0));filter:blur(12px)}
#floorw{position:absolute;left:0;right:0;top:960px;height:960px;perspective:520px;perspective-origin:50% 0;overflow:hidden}
#floor{position:absolute;left:-1500px;right:-1500px;top:0;height:2600px;transform-origin:top;transform:rotateX(74deg);
 background:repeating-linear-gradient(90deg,rgba(41,230,255,.95) 0 4px,transparent 4px 160px),repeating-linear-gradient(0deg,rgba(255,43,214,.95) 0 4px,transparent 4px 160px)}
#flash{position:absolute;left:0;right:0;top:940px;height:40px;background:#e9e2ff;box-shadow:0 0 60px #b9a8ff}
#scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 2px,transparent 2px 6px);mix-blend-mode:multiply}
#vig{position:absolute;inset:0;background:radial-gradient(closest-corner at 50% 50%,transparent 62%,rgba(7,4,15,.6))}
.t{position:absolute;left:0;right:0;font-family:Pix,monospace;color:#f3ecff;text-align:center;white-space:pre;
 text-shadow:-5px 0 #ff2bd6,5px 0 #29e6ff,0 0 26px rgba(160,90,255,.9),0 6px 0 rgba(20,6,50,.85)}
.t div{margin:0 0 .5em}
.hook{top:600px;font-size:104px;line-height:1.1}
.ask{top:330px;font-size:104px;line-height:1.1}
.step{top:1230px;font-size:60px;line-height:1.1}
.play{top:500px;font-size:54px}
.t .c,.t .y,.t .r{text-shadow:0 6px 0 rgba(20,6,50,.9),0 0 22px rgba(20,6,50,.85)}
.t .n{font-size:.62em;color:#ffd400}.t .c{color:#5df2ff}.t .y{color:#ffd400}.t .r{color:#ff5a7a}
#mark{position:absolute;left:0;right:0;top:230px;text-align:center}
#mark svg{width:560px;filter:drop-shadow(-6px 0 #ff2bd6) drop-shadow(6px 0 #ffd400) drop-shadow(0 0 30px rgba(160,90,255,.7))}
#url{position:absolute;left:0;right:0;top:1680px;text-align:center;font:26px Pix,monospace;color:#ffd400;text-shadow:0 0 18px rgba(255,212,0,.5),0 4px 0 rgba(20,6,50,.85)}
#osm{position:absolute;left:0;right:0;top:1748px;text-align:center;font:500 24px Inter,sans-serif;color:#b7a9d9}
</style>
<div id="bg"></div>
<div id="stage3d"><div id="slab" class="grade"><div id="top"><div class="tint"></div><div class="tint2"></div><div class="lift"></div></div><div class="side" id="sS"></div><div class="side" id="sN"></div><div class="side" id="sE"></div><div class="side" id="sW"></div></div></div>
<div id="foot" class="grade"><img id="img"><div class="tint"></div><div class="tint2"></div><div class="lift"></div></div>
<div id="open"><div id="sky"></div><div id="floorw"><div id="floor"></div></div><div id="glow"></div><div id="flash"></div></div>
<div id="texts"></div>
<div id="mark">${readFileSync(new URL('../brand/wordmark-on-dark.svg', import.meta.url), 'utf8')}</div>
<div id="url">yourplace3d.github.io/3dcity-games</div>
<div id="osm">Map data © OpenStreetMap contributors</div>
<div id="scan"></div><div id="vig"></div>`;
writeFileSync(`${out}/_page.html`, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(`file://${out}/_page.html`);
await page.evaluate(() => document.fonts.ready);
await page.evaluate(([titles, OPEN, FOOT, TOTAL]) => {
  const $ = (id) => document.getElementById(id);
  const sm = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  const box = $('texts');
  const els = titles.map(([, , cls]) => { const d = document.createElement('div'); d.className = 't ' + cls; box.append(d); return d; });
  // typed text: `shown` characters of the lines, markup kept whole
  const typed = (lines, shown) => {
    let left = shown;
    return lines.map((line) => {
      let outp = ''; let open = false;
      for (const part of line.split(/(\{.\}|\{\/\})/)) {
        if (/^\{.\}$/.test(part)) { outp += `<span class="${part[1]}">`; open = true; } else if (part === '{/}') { outp += '</span>'; open = false; } else { const take = part.slice(0, Math.max(0, left)); left -= part.length; outp += take; }
      }
      return `<div>${outp + (open ? '</span>' : '') || ' '}</div>`;
    }).join('');
  };
  window.draw = async (T, file) => {
    const ft = T - OPEN; // footage time
    const st = ft - FOOT; // slab time
    // opener: a flash, then the grid rolls toward us, then it gives way to the street
    $('open').style.display = T < OPEN + 0.35 ? '' : 'none';
    $('open').style.opacity = String(1 - sm((T - (OPEN - 0.05)) / 0.4));
    $('flash').style.opacity = String(Math.max(0, 1 - T / 0.2));
    $('flash').style.transform = `scaleX(${Math.min(1, T / 0.12)})`;
    $('sky').style.opacity = $('glow').style.opacity = $('floorw').style.opacity = String(sm((T - 0.12) / 0.25));
    $('floor').style.backgroundPosition = `0 0, 0 ${Math.round(T * 420)}px`;
    // footage
    $('foot').style.display = st < 0 ? '' : 'none';
    if (file && st < 0) { const img = $('img'); if (img.dataset.f !== file) { img.dataset.f = file; img.src = 'file://' + file; await img.decode(); } }
    // slab: starts exactly where the last filmed frame ends, then tips back and shrinks
    const e = sm(st / 2.4);
    const drift = Math.max(0, st) * 1.6;
    $('stage3d').style.display = st >= 0 ? '' : 'none';
    $('slab').style.transform = `translateY(${e * 170}px) rotateX(${e * 50}deg) rotateZ(${-e * 24 - drift * e}deg) scale(${1 - 0.54 * e})`;
    $('slab').style.filter = `saturate(1.18) contrast(1.06) brightness(${1 - 0.12 * sm((st - 2) / 1)})`;
    // end titles
    $('mark').style.opacity = String(sm((st - 1.7) / 0.35));
    $('mark').style.transform = `translateY(${(1 - sm((st - 1.7) / 0.35)) * -30}px)`;
    $('url').style.opacity = $('osm').style.opacity = String(sm((st - 3.2) / 0.3));
    titles.forEach(([a, b, , lines], i) => {
      const d = els[i];
      const on = T >= a && T < b;
      d.style.display = on ? '' : 'none';
      if (!on) return;
      const n = Math.floor((T - a) * 30);
      // a flicker on the way in and out, like the trailer's type
      const edge = Math.min(T - a, b - T);
      d.style.opacity = edge < 0.1 && Math.floor(T * 30) % 2 ? '0.35' : '1';
      d.innerHTML = typed(lines, n);
    });
  };
}, [titles, OPEN, FOOT, TOTAL]);

const only = process.env.ONLY?.split(',').map(Number);
const N = Math.round(TOTAL * FPS);
for (let f = 0; f < N; f++) {
  if (only && !only.includes(f)) continue;
  const T = f / FPS;
  const k = Math.round((T - OPEN) * FPS);
  await page.evaluate(([T, file]) => window.draw(T, file), [T, k < frames.length ? frames[Math.max(0, k)] : null]);
  writeFileSync(`${out}/${String(f).padStart(5, '0')}.jpg`, await page.screenshot({ type: 'jpeg', quality: 93 }));
}
console.log('seconds', TOTAL.toFixed(2), 'frames', N, JSON.stringify(at));
await browser.close();
