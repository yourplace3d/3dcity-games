/**
 * Drive it 3D: the screens around the game. Pick a place, then the loop runs: read the keys or
 * the touch stick, step the game, draw, and keep the numbers on screen up to date.
 */

import { Game, type Hud } from './game/game';
import { Controls } from './game/input';
import { Minimap } from './game/minimap';
import { areaKey, squaresAround, World } from './game/world';
import { findPlace, nearCity } from './places';
import { addScore, lastName, nameScore, scores, type Score } from './scores';
import { BAKED } from './geo/mapCache';
import type { LngLat } from './geo/projection';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const PLACES: Array<[string, number, number]> = [
  ['Berlin', 52.5163, 13.3777],
  ['Hamburg', 53.5503, 9.992],
  ['Paris', 48.8738, 2.295],
  ['London', 51.5079, -0.1281],
  ['New York', 40.758, -73.9855],
  ['San Francisco', 37.8024, -122.4058],
  ['Tokyo', 35.6595, 139.7005],
  ['Rio', -22.9711, -43.1822],
];
const SAVE = 'drive-it-3d';

const canvas = $<HTMLCanvasElement>('scene');
const status = $('status');
const small = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
addEventListener('pointerdown', (e) => document.body.classList.toggle('touch', e.pointerType === 'touch'), true);

let game: Game | null = null;
let playing = false;
let busy = false;
/** what to call the place being played on the scoreboard */
let placeName = '';
const minimap = new Minimap($<HTMLCanvasElement>('minimap'));
const ROUTE = 'drive-it-3d-route';

/** The line on the road to the next ring: off unless the player turns it on, and remembered. */
function routeLine(on?: boolean): boolean {
  try {
    if (on !== undefined) localStorage.setItem(ROUTE, on ? '1' : '0');
    return localStorage.getItem(ROUTE) === '1';
  } catch {
    return !!on;
  }
}

function toggleRoute(): void {
  if (!game || !playing) return;
  game.showRoute = !game.showRoute;
  routeLine(game.showRoute);
  toast(game.showRoute ? 'Route line on' : 'Route line off', 'info');
}

const controls = new Controls($('pad'), $('knob'), $('btn-action'), $('btn-brake'));

function load(): { cash: number; delivered: number; at?: LngLat } {
  try {
    return { cash: 0, delivered: 0, ...(JSON.parse(localStorage.getItem(SAVE) ?? '{}') as object) };
  } catch {
    return { cash: 0, delivered: 0 };
  }
}

function save(at?: LngLat): void {
  if (!game) return;
  try {
    localStorage.setItem(SAVE, JSON.stringify({ cash: game.cash, delivered: game.delivered, at: at ?? load().at }));
  } catch {
    /* private window: play without saving */
  }
}

function toast(text: string, kind: 'good' | 'bad' | 'info' = 'info'): void {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  const box = $('toasts');
  box.append(el);
  while (box.children.length > 3) box.firstElementChild!.remove();
  setTimeout(() => el.remove(), 3300);
}

function flash(text: string, ride = false): void {
  const el = $('flash');
  el.textContent = text;
  el.classList.toggle('ride', ride);
  el.hidden = true;
  void el.offsetWidth;
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 1750);
}

/** A sign across the start card while a place is being looked up or loaded: hard to miss. */
function working(text: string | null): void {
  $('busy').hidden = text === null;
  if (text !== null) $('busy-text').textContent = text;
  for (const b of document.querySelectorAll<HTMLButtonElement>('#start button')) b.disabled = text !== null;
}

function setScreen(screen: 'start' | 'play'): void {
  document.body.dataset.screen = screen;
  playing = screen === 'play';
  controls.enabled = playing;
  $('btn-resume').hidden = !game?.world;
}

async function go(at: LngLat, name?: string): Promise<void> {
  if (busy) return;
  busy = true;
  status.className = 'status';
  status.textContent = '';
  working(name ? `Loading ${name}` : 'Loading the streets');
  try {
    if (!game) {
      game = new Game(canvas, small);
      const saved = load();
      game.cash = saved.cash;
      game.delivered = saved.delivered;
      game.onToast = toast;
      game.onFlash = (t) => flash(t);
      game.onRide = (t) => flash(t, true);
      game.onSquare = (s) => ($('next').hidden = s !== 'loading');
      game.onSave = () => save();
      // let the last delivery's message be read before the result covers it
      game.onRunEnd = (score, seconds) => setTimeout(() => runEnded(score, seconds), 1400);
      controls.onAction = () => game!.action();
      controls.onReset = () => game!.reset();
      controls.onRoute = toggleRoute;
      game.showRoute = routeLine();
      (window as unknown as { game: Game }).game = game;
    }
    await game.start(at);
    game.newRun();
    placeName = name ?? nearCity(at) ?? `${at.lat.toFixed(2)}, ${at.lon.toFixed(2)}`;
    save(at);
    if (!BAKED) history.replaceState(null, '', `#${at.lat.toFixed(5)},${at.lon.toFixed(5)}`);
    $('btn-menu').blur();
    status.textContent = '';
    // little on the map here: say so, and let them choose
    const thin = game.world.thin;
    $('thin').hidden = !thin;
    if (thin) {
      $<HTMLAnchorElement>('thin-map').href = `https://www.openstreetmap.org/#map=16/${at.lat.toFixed(5)}/${at.lon.toFixed(5)}`;
      $('btn-resume').hidden = true;
      return;
    }
    begin();
  } catch (err) {
    console.warn(err);
    status.className = 'status error';
    const none = err instanceof Error && err.message === 'no roads here';
    status.textContent = navigator.onLine === false ? 'You seem to be offline.' : none ? 'There are no streets on the map right here. Try a spot nearby, or one of the cities above.' : 'That place didn’t load. Try another, or try again.';
    $('thin').hidden = true;
  } finally {
    busy = false;
    working(null);
  }
}

function begin(): void {
  $('thin').hidden = true;
  setScreen('play');
  if (coached()) toast(document.body.classList.contains('touch') ? 'Walk to a car and tap In / out' : 'Walk to a car and press E', 'info');
  else if (step < 0) step = 0;
}

// ------------------------------------------------------------------ first-time tour

const COACHED = '3da-coached';
function coached(): boolean {
  try {
    return localStorage.getItem(COACHED) === '1';
  } catch {
    return true;
  }
}

/** The tour's steps: what to say (keys, touch) and what the player must have done to move on. */
const TOUR: Array<{ keys: string; touch: string; done: (h: Hud) => boolean }> = [
  {
    keys: 'You walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys. Step up to the car beside you and press <kbd>E</kbd> to get in.',
    touch: 'Drag anywhere on the left half of the screen to walk. Step up to the car beside you and tap <b>In / out</b>.',
    done: (h) => h.carHp !== null,
  },
  {
    keys: 'Drive with the same keys, <kbd>Space</kbd> is the handbrake. Follow the arrow to a <b class="c">blue ring</b> and drive through it to pick up a package.',
    touch: 'Drag to steer and drive, <b>Brake</b> to stop. Follow the arrow to a <b class="c">blue ring</b> and drive through it to pick up a package.',
    done: (h) => h.job !== null,
  },
  {
    keys: 'Now take it to the <b class="y">yellow ring</b> before the clock at the top runs out. Time left over pays a bonus. <kbd>G</kbd> draws the way on the road.',
    touch: 'Now take it to the <b class="y">yellow ring</b> before the clock at the top runs out. Time left over pays a bonus. Tap the little map to draw the way on the road.',
    done: (h) => h.job === null,
  },
  {
    keys: 'Five deliveries make a run for the scoreboard. Mind the police: knocking people over, ramming and taking cars light up the badges and bring patrol cars. Stay out of their sight to cool off; stop next to one and you pay a fine.',
    touch: 'Five deliveries make a run for the scoreboard. Mind the police: knocking people over, ramming and taking cars light up the badges and bring patrol cars. Stay out of their sight to cool off; stop next to one and you pay a fine.',
    done: () => false,
  },
];
/** which step of the tour is showing; -1: none */
let step = -1;
/** seconds the last step has been up */
let lastFor = 0;
/** seconds with no package anywhere to point at */
let noTarget = 0;

function endTour(): void {
  step = -1;
  $('coach').hidden = true;
  try {
    localStorage.setItem(COACHED, '1');
  } catch {
    /* it will show again next time */
  }
}

function tour(h: Hud, dt: number): void {
  if (step < 0) return;
  while (step < TOUR.length - 1 && TOUR[step].done(h)) {
    // the package ran out of time: back to fetching one
    if (step === 2 && h.run?.n === 1) {
      step = 1;
      break;
    }
    step++;
  }
  const last = step === TOUR.length - 1;
  // a place with hardly a street to drive on has no deliveries: say so and stop
  noTarget = step === 1 && !h.target && !h.job ? noTarget + dt : 0;
  if (noTarget > 12) {
    toast('No deliveries around here: too few streets. Try another place from the menu.', 'info');
    return endTour();
  }
  if (last) {
    lastFor += dt;
    if (lastFor > 14) return endTour();
  }
  $('coach').hidden = false;
  put('coach-n', `${step + 1} of ${TOUR.length}`);
  const touch = document.body.classList.contains('touch');
  // out of the car in the middle of it all: the next thing is to get back into one
  const onFoot = h.carHp === null && step > 0 && !last;
  put('coach-text', onFoot ? (touch ? 'You are on foot. Walk up to a car and tap <b>In / out</b>. A parked one is free to take.' : 'You are on foot. Walk up to a car and press <kbd>E</kbd>. A parked one is free to take.') : touch ? TOUR[step].touch : TOUR[step].keys);
  put('coach-skip', last ? 'Got it' : 'Skip the tour');
}
$('coach-skip').addEventListener('click', endTour);

/** "52.5, 13.4" typed straight in. */
function parseLatLon(q: string): LngLat | null {
  const m = q.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

async function search(q: string): Promise<void> {
  const typed = parseLatLon(q);
  if (typed) return go(typed);
  if (busy) return;
  status.className = 'status';
  status.textContent = '';
  working('Searching');
  const found = await findPlace(q);
  if (found === 'none' || found === 'silent') {
    working(null);
    status.className = 'status error';
    status.textContent = found === 'none' ? 'Nothing found by that name. Check the spelling, or add the country.' : 'The place search isn’t answering right now. Try a city button, a big city by name, or type lat, lon.';
    return;
  }
  await go(found.at, found.name);
}

// ------------------------------------------------------------------ scoreboard

/** the run that has just ended, while its result is on screen */
let fresh: Score | null = null;

function drawBoard(): void {
  const list = scores().slice(0, 10);
  const board = $('board');
  board.replaceChildren();
  $('board-empty').hidden = list.length > 0;
  for (const s of list) {
    const li = document.createElement('li');
    if (fresh && s.at === fresh.at) li.className = 'mine';
    const who = document.createElement('span');
    who.textContent = s.name || 'No name';
    if (!s.name) who.className = 'anon';
    const where = document.createElement('small');
    where.textContent = `${s.place} · ${fmtTime(s.seconds)}`;
    const what = document.createElement('b');
    what.textContent = fmtMoney(s.score);
    li.append(who, where, what);
    board.append(li);
  }
}

/** Show the scoreboard over whatever is on screen; with a run that has just ended, its result too. */
function showBoard(run: Score | null): void {
  fresh = run;
  $('result-title').textContent = run ? 'Run complete' : 'Scoreboard';
  $('result-run').hidden = !run;
  if (run) {
    $('result-score').textContent = fmtMoney(run.score);
    $('result-line').textContent = `Five deliveries in ${fmtTime(run.seconds)} · ${run.place}`;
    $('result-form').hidden = false;
    $<HTMLInputElement>('result-name').value = lastName();
  }
  $('btn-newrun').hidden = !game?.world;
  $('btn-close').textContent = document.body.dataset.screen === 'play' ? 'Keep driving' : 'Close';
  drawBoard();
  $('result').hidden = false;
  playing = false;
  controls.enabled = false;
}

function closeBoard(): void {
  $('result').hidden = true;
  fresh = null;
  setScreen(document.body.dataset.screen === 'play' ? 'play' : 'start');
}

function runEnded(score: number, seconds: number): void {
  const run: Score = { name: '', score, seconds, place: placeName, at: Date.now() };
  addScore(run);
  showBoard(run);
}

$<HTMLFormElement>('result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>('result-name').value.trim().slice(0, 16);
  if (!fresh || !name) return;
  nameScore(fresh.at, name);
  $('result-form').hidden = true;
  drawBoard();
});
$('btn-newrun').addEventListener('click', () => {
  game?.newRun();
  $('result').hidden = true;
  fresh = null;
  setScreen('play');
  toast('New run: five deliveries', 'info');
});
$('btn-close').addEventListener('click', closeBoard);
$('btn-scores').addEventListener('click', () => showBoard(null));

// ------------------------------------------------------------------ screen

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtTime = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
const last: Record<string, string> = {};
function put(id: string, html: string): void {
  if (last[id] === html) return;
  last[id] = html;
  $(id).innerHTML = html;
}

function paint(h: Hud): void {
  put('cash', fmtMoney(h.cash));
  const heat = $('heat').children;
  for (let i = 0; i < heat.length; i++) heat[i].classList.toggle('on', i < h.heat);
  const health = $('health');
  health.style.width = `${h.health}%`;
  health.classList.toggle('low', h.health < 35);
  $('carbar').hidden = h.carHp === null;
  if (h.carHp !== null) {
    $('carhp').style.width = `${h.carHp}%`;
    $('carhp').classList.toggle('low', h.carHp < 35);
  }
  $('speed').hidden = h.carHp === null;
  if (h.carHp !== null) put('speed', `${Math.round(h.kmh)}<small>km/h</small>`);
  $('run').hidden = !h.run;
  if (h.run) put('run', `Run ${Math.min(h.run.n, h.run.of)}/${h.run.of} · ${fmtMoney(h.run.score)}`);
  $('job').hidden = !h.job;
  if (h.job) {
    $('job').classList.toggle('late', h.job.left < 10);
    put('job', `${h.run ? `Delivery ${h.run.n}/${h.run.of}` : 'Deliver'} · <b class="time">${fmtTime(h.job.left)}</b> · ${fmtM(h.job.metres)} · <b>${fmtMoney(h.job.pay)}</b>`);
  }
  $('hint').hidden = !h.hint;
  if (h.hint) put('hint', `<kbd>E</kbd>${h.hint}`);

  // the arrow: on the ring while it's in view, else at the edge of the screen pointing to it
  const arrow = $('arrow');
  arrow.hidden = !h.target;
  if (h.target) {
    const w = innerWidth;
    const hh = innerHeight;
    const { ndcX, ndcY } = h.target;
    const off = Math.max(Math.abs(ndcX), Math.abs(ndcY));
    arrow.className = h.target.kind;
    const margin = 46;
    if (off < 0.86) {
      arrow.style.transform = `translate(${((ndcX + 1) / 2) * w}px, ${((1 - ndcY) / 2) * hh - 46}px)`;
      arrow.style.setProperty('--rot', '180deg');
      arrow.style.setProperty('--ly', '-34px');
      put('arrow-m', '');
    } else {
      const k = Math.min((w / 2 - margin) / Math.abs(ndcX * w / 2 || 1e-6), (hh / 2 - margin) / Math.abs(ndcY * hh / 2 || 1e-6));
      let x = w / 2 + (ndcX * w / 2) * k;
      const y = hh / 2 - (ndcY * hh / 2) * k;
      // keep clear of the touch buttons in the bottom right corner
      if (document.body.classList.contains('touch') && y > hh - 260) x = Math.min(x, w - 150);
      arrow.style.transform = `translate(${x}px, ${y}px)`;
      arrow.style.setProperty('--rot', `${(Math.atan2(ndcX * w, ndcY * hh) * 180) / Math.PI}deg`);
      arrow.style.setProperty('--ly', y > hh / 2 ? '-30px' : '20px');
      put('arrow-m', fmtM(h.target.metres));
    }
  }
}

let before = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = before ? (now - before) / 1000 : 0;
  before = now;
  if (!game?.world || !playing) return;
  game.update(dt, controls.read());
  const h = game.hud();
  paint(h);
  tour(h, dt);
  minimap.draw(game);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => (before = 0));

// ------------------------------------------------------------------ start screen

const places = $('places');
const baked = parseLatLon(BAKED);
if (baked) {
  // the map of one district ships with the page: play there
  World.allowed = new Set(squaresAround(baked).map(areaKey));
  (window as unknown as { squares: LngLat[] }).squares = squaresAround(baked);
  $('search').hidden = true;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'primary';
  b.textContent = 'Play in Berlin';
  b.addEventListener('click', () => void go(baked, 'Berlin'));
  places.append(b);
  $('where').hidden = false;
} else {
  for (const [name, lat, lon] of PLACES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.addEventListener('click', () => void go({ lat, lon }, name));
    places.append(b);
  }
  if ('geolocation' in navigator) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Where I am';
    b.addEventListener('click', () => {
      status.className = 'status';
      status.textContent = 'Finding you…';
      navigator.geolocation.getCurrentPosition(
        (p) => void go({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => {
          status.className = 'status error';
          status.textContent = 'Your location isn’t available. Pick a city instead.';
        },
        { timeout: 10000 },
      );
    });
    places.append(b);
  }
  $<HTMLFormElement>('search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $<HTMLInputElement>('q').value.trim();
    if (q) void search(q);
  });
}
$('btn-menu').addEventListener('click', () => {
  save();
  setScreen('start');
});
$('btn-resume').addEventListener('click', () => setScreen('play'));
$('minimap').addEventListener('click', toggleRoute);
$('btn-anyway').addEventListener('click', begin);
addEventListener('pagehide', () => save());

// a place in the link starts there straight away: coordinates, or a name to look up
const linked = BAKED ? '' : decodeURIComponent(location.hash.slice(1)).replace(/[_+]/g, ' ').trim();
const fromLink = parseLatLon(linked);
if (fromLink) void go(fromLink);
else if (linked) {
  $<HTMLInputElement>('q').value = linked;
  void search(linked);
}
