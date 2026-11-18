/**
 * Drive it 3D: the screens around the game. Pick a place, then the loop runs: read the keys or
 * the touch stick, step the game, draw, and keep the numbers on screen up to date.
 */

import { Game, MAX_CASH, RUN_JOBS, type Course, type Hud } from './game/game';
import { linkHome, packChallenge, readChallenge, type Challenge } from './challenge';
import { cameByVideo, countMade, countOpened, countPlay, countTime, countVisit, playingAt } from './linkCount';
import { arrive as cloudArrive, changed, savedName, savingOn } from './cloud';
import { loadHomes } from './game/homes';
import { wireCloud } from './cloudUi';
import { Sound } from './sound';
import { addonHost } from './addon';
import { HomesUi } from './homesUi';
import { fullNote } from './full';
import { wireRadio } from './radio';
import { serviceIcon, type ServiceKind } from './game/services';
import { Controls } from './game/input';
import { Minimap } from './game/minimap';
import { areaKey, squaresAround, World } from './game/world';
import { findPlace, nearCity, placeAt } from './places';
import { newRound, packGuess, played, points, readGuess, type Round, type SentGuess } from './guess';
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
let homes: HomesUi | null = null;
const sound = new Sound();
let playing = false;
let busy = false;
/** what to call the place being played on the scoreboard */
let placeName = '';
/** the run someone sent that is being played: its name, score and time are the ones to beat */
let rival: Challenge | null = null;
/** the place has a name to announce, not only coordinates */
let placeKnown = false;
/** the name has been shown since this place was loaded */
let arrived = false;
const COUNT = ['no', 'one', 'two', 'three', 'four', 'five'];
/** "three deliveries", for a run of that many */
const deliveries = (n: number) => `${COUNT[n] ?? n} ${n === 1 ? 'delivery' : 'deliveries'}`;
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const minimap = new Minimap($<HTMLCanvasElement>('minimap'));
const bigmap = new Minimap($<HTMLCanvasElement>('bigmap-canvas'), true);
/** the big map is up and the game waits behind it */
let mapOpen = false;
/** the game waits behind the pause card */
let paused = false;
const MODE = '3da-mode';
/** what the start screen is set to: a run of three to compare, or open jobs */
let mode: 'run' | 'jobs' | 'guess' = ((): 'run' | 'jobs' => {
  try {
    return localStorage.getItem(MODE) === 'jobs' ? 'jobs' : 'run';
  } catch {
    return 'run';
  }
})();
function setMode(m: 'run' | 'jobs' | 'guess'): void {
  mode = m;
  try {
    // a city to guess is chosen each time: a plain link on a later visit must not start one
    if (m !== 'guess') localStorage.setItem(MODE, m);
  } catch {
    /* it lasts as long as the page */
  }
  $('mode-run').setAttribute('aria-pressed', String(m === 'run'));
  $('mode-jobs').setAttribute('aria-pressed', String(m === 'jobs'));
  $('mode-guess').setAttribute('aria-pressed', String(m === 'guess'));
  // a city to guess is not one the player picks
  $('btn-drop').hidden = m !== 'guess';
  $('search').hidden = m === 'guess' || !!BAKED;
  $('places').hidden = m === 'guess';
}
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

/**
 * A frame-rate readout for finding out how a device copes: add `?fps` to the link to show it,
 * `?fps=off` to put it away. Remembered, so it also shows in the game opened from a home screen.
 */
const showFps = ((): boolean => {
  const KEY = 'drive-it-3d-fps';
  try {
    const asked = new URLSearchParams(location.search).get('fps');
    if (asked !== null) localStorage.setItem(KEY, asked === 'off' || asked === '0' ? '0' : '1');
    return localStorage.getItem(KEY) === '1';
  } catch {
    return new URLSearchParams(location.search).has('fps');
  }
})();
const meter = { t: 0, n: 0, worst: 0 };

function fpsReadout(dt: number): void {
  if (!game || dt <= 0) return;
  meter.t += dt;
  meter.n++;
  meter.worst = Math.max(meter.worst, dt);
  if (meter.t < 0.5) return;
  const d = game.drawn();
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  $('fps').textContent = `${Math.round(meter.n / meter.t)} fps · slowest frame ${Math.round(meter.worst * 1000)} ms\n${d.width}×${d.height} px · detail ${Math.round((d.ratio / d.fullRatio) * 100)}%\n${k(d.triangles)} triangles · ${d.calls} draws`;
  meter.t = meter.n = meter.worst = 0;
}

function toggleRoute(): void {
  if (!game || !playing) return;
  game.showRoute = !game.showRoute;
  routeLine(game.showRoute);
  lineButton();
  if (!mapOpen) toast(game.showRoute ? 'Route line on' : 'Route line off', 'info');
}

function lineButton(): void {
  const b = $('btn-line');
  b.textContent = `Line on the road: ${game?.showRoute ? 'on' : 'off'}`;
  b.setAttribute('aria-pressed', String(!!game?.showRoute));
}

/**
 * The big map: the whole loaded square with you, the rings and the way to the next one. Players
 * couldn't tell where they were from the little map alone, least of all on a phone. The game
 * waits while it is open, so there is time to look.
 */
function showMap(open: boolean): void {
  if (open && (!game?.world || !playing)) return;
  mapOpen = open;
  $('bigmap').hidden = !open;
  controls.enabled = playing && !open;
  if (open) {
    $('bigmap-place').textContent = secret ? 'Where am I?' : placeName;
    lineButton();
  }
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
    changed();
  } catch {
    /* private window: play without saving */
  }
}

function toast(text: string, kind: 'good' | 'bad' | 'info' = 'info', ms = 3300): void {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  // it fades over the time it is shown, a long message as well as a short one
  el.style.animationDuration = `${ms}ms`;
  const box = $('toasts');
  box.append(el);
  while (box.children.length > 3) box.firstElementChild!.remove();
  setTimeout(() => el.remove(), ms);
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
  if (!playing) showMap(false);
  $('btn-resume').hidden = !game?.world;
}

async function go(at: LngLat, name?: string, sent: Challenge | null = null): Promise<void> {
  if (busy) return;
  busy = true;
  if (!dropping) endGuess();
  playingAt(at);
  status.className = 'status';
  status.textContent = '';
  working(dropping ? 'Putting you down somewhere' : name ? `Loading ${name}` : 'Loading the streets');
  try {
    if (!game) {
      game = new Game(canvas, small);
      const saved = load();
      game.cash = saved.cash;
      // test builds only: `?try=rich` (VITE_TESTING=1), or every start (VITE_TESTING=rich), begins with the
      // most cash there is, to try buying homes
      if (import.meta.env.VITE_TESTING === 'rich' || (import.meta.env.VITE_TESTING && new URLSearchParams(location.search).get('try')?.split(',').includes('rich'))) game.cash = MAX_CASH;
      game.delivered = saved.delivered;
      game.onToast = toast;
      game.onFlash = (t) => flash(t);
      game.onRide = (t) => flash(t, true);
      game.onSquare = (s) => ($('next').hidden = s !== 'loading');
      game.onSave = () => save();
      game.onSound = (what, strength) => sound.play(what, strength);
      // let the last delivery's message be read before the result covers it
      // a run is counted as started when its first package is on board
      {
        const g = game;
        let counted: unknown = null;
        g.ticks.push(() => {
          if (BAKED || g.run.over || !g.job || counted === g.run) return;
          counted = g.run;
          countPlay('start');
        });
      }
      game.onRunEnd = (score, seconds) => {
        // up over the town while the result is read
        game!.overview();
        setTimeout(() => runEnded(score, seconds), 1400);
      };
      controls.onAction = () => {
        const before = game!.car;
        game!.action();
        if (game!.car !== before) sound.play('door');
      };
      controls.onReset = () => game!.reset();
      controls.onRoute = toggleRoute;
      controls.onMap = () => showMap(true);
      game.showRoute = routeLine();
      (window as unknown as { game: Game }).game = game;
      homes = new HomesUi({ game, toast, save: () => save(), place: () => placeName, firstHome: welcomeHome });
      (window as unknown as { homes: HomesUi }).homes = homes;
      addonHost({ game, toast, api: 2 });
      // a tester's key was in play: say how it went
      void fullNote.then((n) => n && toast(n.text, n.kind));
    }
    await game.start(at);
    // a run a friend sent is a run, whatever the start screen is set to
    if (sent || mode === 'run') game.newRun(sent?.course ?? null);
    else game.openPlay();
    rival = sent;
    const known = name ?? nearCity(at);
    placeName = known ?? `${at.lat.toFixed(2)}, ${at.lon.toFixed(2)}`;
    placeKnown = !!known;
    // a link with nothing but coordinates: ask which town this is, for the sign and the board
    if (!known && !BAKED) {
      const here = game.world;
      void placeAt(at).then((town) => {
        if (!town || game?.world !== here || placeKnown) return;
        placeName = town;
        placeKnown = true;
        if (playing && !arrived) arrive();
      });
    }
    arrived = false;
    save(at);
    // the address would give a city to guess away
    if (!BAKED) history.replaceState(null, '', dropping ? withoutChallenge() : `${sent ? location.search : withoutChallenge()}#${at.lat.toFixed(5)},${at.lon.toFixed(5)}`);
    $('btn-menu').blur();
    status.textContent = '';
    // little on the map here: say so, and let them choose
    const thin = game.world.thin && !dropping;
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

/** The name of the place across the screen as the game starts there; with a run someone sent, what there is to beat. */
function arrive(): void {
  arrived = true;
  $('arrive-place').textContent = secret ? 'Where am I?' : placeName;
  $('arrive-line').textContent = secret
    ? guessRival
      ? `${guessRival.name || 'Someone'} ${guessRival.points ? `knew this city after ${secs(guessRival.seconds)}: ${guessRival.points} points` : 'did not get this city'}. Same place, same four names: beat it.`
      : 'Drive around and look. Tap “Guess the city” when you know: the sooner, the more points.'
    : rival
    ? `${rival.name || 'Someone'} made ${fmtMoney(rival.score)} here in ${fmtTime(rival.seconds)}. Same ${deliveries(rival.course.legs.length)}: beat it.`
    : game?.run.over
      ? 'Open jobs: look for the pump, the flame and the badge'
      : `${cap(deliveries(RUN_JOBS))} make a run`;
  const el = $('arrive');
  el.classList.toggle('sent', !!rival || (!!secret && !!guessRival));
  el.hidden = true;
  void el.offsetWidth;
  el.hidden = false;
  clearTimeout(arriveT);
  arriveT = window.setTimeout(() => (el.hidden = true), rival || (secret && guessRival) ? 6000 : 3200);
}
let arriveT = 0;

/** The link's query without a sent run in it, for when the player goes on to something else. */
function withoutChallenge(): string {
  const q = new URLSearchParams(location.search);
  q.delete('c');
  q.delete('g');
  const text = q.toString().replace(/=(?=&|$)/g, '');
  return location.pathname + (text ? `?${text}` : '');
}

function begin(): void {
  $('thin').hidden = true;
  setScreen('play');
  if (placeKnown) arrive();
  if (rival && coached()) return;
  if (secret) {
    // someone who came by a friend's link may never have played: say how to get going, once the sign has been read
    setTimeout(() => playing && secret && !game?.car && toast(document.body.classList.contains('touch') ? 'Walk to a car and tap In / out' : 'Walk to a car and press E', 'info'), guessRival ? 6200 : 3400);
    return;
  }
  // open jobs from the start: say where they are, once the place's name has been read
  if (game?.run.over && coached()) {
    setTimeout(() => playing && game?.run.over && openJobs(true), 3600);
    return;
  }
  if (coached()) toast(document.body.classList.contains('touch') ? 'Walk to a car and tap In / out' : 'Walk to a car and press E', 'info');
  else if (step < 0) step = 0;
}

// ------------------------------------------------------------------ where am I?

/** the city being guessed: its name is kept off the screen until it is picked */
let secret: Round | null = null;
/** a city to guess is being loaded */
let dropping = false;
/** the card with the four names is up and the game waits behind it */
let guessing = false;

/** The first home is bought: a card says what it brings, and that the game can now be saved online. The game waits. */
let welcoming = false;
function welcomeHome(what: string, rent: string): void {
  openSaving();
  welcoming = true;
  controls.enabled = false;
  $('firsthome-what').textContent = `It's yours: ${what}. It pays ${rent} rent each day you come back to the game.`;
  const saving = savingOn();
  $('firsthome-save').textContent = saving
    ? `Your game is saved online as ${savedName()}, and your home with it.`
    : 'From now on you can save your game online: give it a name and go on with it on another device. Your home stays yours.';
  $('btn-firsthome-save').hidden = saving || !savingOpen;
  $('btn-firsthome-go').textContent = saving ? 'Go on' : 'Later';
  $('firsthome').hidden = false;
}
function closeWelcome(): void {
  $('firsthome').hidden = true;
  welcoming = false;
  controls.enabled = playing && !paused;
  before = 0;
}
$('btn-firsthome-go').addEventListener('click', closeWelcome);
$('btn-firsthome-save').addEventListener('click', () => {
  closeWelcome();
  save();
  setScreen('start');
  const box = $('account');
  box.scrollIntoView({ block: 'center' });
  box.querySelector('input')?.focus();
});
/** how long the player has looked around (s), and the wrong names picked */
let lookedS = 0;
let wrongPicks = 0;
/** the guess someone sent that is being played: theirs is the one to beat */
let guessRival: SentGuess | null = null;
/** the city just guessed, to send on */
let justGuessed: SentGuess | null = null;
const secs = (s: number): string => (s < 60 ? `${Math.round(s)} seconds` : fmtTime(s));
/** this visit: cities guessed and the points they made */
const tally = { cities: 0, points: 0 };

function endGuess(): void {
  secret = null;
  guessing = false;
  minimap.secret = bigmap.secret = false;
  document.body.classList.remove('secret');
  $('btn-guess').hidden = true;
  $('guess').hidden = true;
}

/** Put the player down in a city they are not told; one that doesn't load or has little on the map is passed over. */
async function drop(sent: SentGuess | null = null): Promise<void> {
  if (busy) return;
  const failed: string[] = [];
  guessRival = sent;
  if (sent) setMode('guess');
  for (let tries = 0; tries < (sent ? 1 : 4); tries++) {
    const round = sent?.round ?? newRound(failed);
    dropping = true;
    secret = round;
    lookedS = 0;
    wrongPicks = 0;
    try {
      await go(round.at);
    } finally {
      dropping = false;
    }
    if (playing && game?.world && (sent || !game.world.thin)) {
      played(round.city);
      if (!BAKED) countPlay('guess');
      minimap.secret = bigmap.secret = true;
      document.body.classList.add('secret');
      $('btn-guess').hidden = false;
      // it is a button: it says so by moving a little, while the sign is up and just after
      $('btn-guess').classList.remove('nudge');
      void $('btn-guess').offsetWidth;
      $('btn-guess').classList.add('nudge');
      status.textContent = '';
      return;
    }
    failed.push(round.city);
    setScreen('start');
  }
  endGuess();
  guessRival = null;
  status.className = 'status error';
  status.textContent = navigator.onLine === false ? 'You seem to be offline.' : sent ? 'The city in this link didn’t load. Open the link again in a moment.' : 'No city would load just now. Try again in a moment.';
}

function tallyLine(): string {
  return tally.cities ? `This visit: ${tally.cities} ${tally.cities === 1 ? 'city' : 'cities'}, ${tally.points.toLocaleString('en')} points.` : '';
}

/** The four names, to pick one. The game and the points wait while they are up. */
function askGuess(): void {
  if (!secret || !playing || mapOpen || paused) return;
  guessing = true;
  controls.enabled = false;
  $('guess-title').textContent = 'Which city is this?';
  $('guess-score').textContent = `${points(lookedS, wrongPicks)} points`;
  $('guess-line').textContent = `${guessRival ? `${guessRival.name || 'Your friend'} made ${guessRival.points}. ` : ''}A wrong pick costs 250 points and takes that name away.`;
  $('guess-after').hidden = true;
  $('guess-before').hidden = false;
  $('guess-tally').textContent = tallyLine();
  const box = $('guess-options');
  box.replaceChildren();
  for (const name of secret.options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.addEventListener('click', () => pick(name, b));
    box.append(b);
  }
  $('guess').hidden = false;
}

function pick(name: string, b: HTMLButtonElement): void {
  const round = secret;
  if (!round || b.disabled) return;
  const buttons = [...$('guess-options').querySelectorAll('button')];
  if (name !== round.city) {
    wrongPicks++;
    b.disabled = true;
    b.classList.add('wrong');
    sound.play('late');
    // one name left: that is no guess any more
    const open = buttons.filter((o) => !o.disabled);
    if (open.length > 1) {
      $('guess-score').textContent = `${points(lookedS, wrongPicks)} points`;
      $('guess-line').textContent = `Not ${name}. Pick again, or look around some more.`;
      return;
    }
  }
  const got = name === round.city ? points(lookedS, wrongPicks) : 0;
  for (const o of buttons) {
    o.disabled = true;
    if (o.textContent === round.city) o.classList.add('right');
  }
  if (got) sound.play('run');
  tally.cities++;
  tally.points += got;
  // the name is out: the town is a town like any other from here on
  secret = null;
  minimap.secret = bigmap.secret = false;
  document.body.classList.remove('secret');
  $('btn-guess').hidden = true;
  placeName = round.city;
  placeKnown = true;
  if (!BAKED) history.replaceState(null, '', `${withoutChallenge()}#${round.at.lat.toFixed(5)},${round.at.lon.toFixed(5)}`);
  $('guess-title').textContent = got ? `${round.city}. Right!` : `It is ${round.city}.`;
  $('guess-score').textContent = got ? `${got} points` : 'No points this time';
  const s = Math.round(lookedS);
  $('guess-line').textContent = got ? `After ${s < 60 ? `${s} seconds` : fmtTime(s)} of looking${wrongPicks ? ` and ${wrongPicks === 1 ? 'one wrong pick' : `${wrongPicks} wrong picks`}` : ''}.` : 'Three wrong picks leave only one name.';
  $('guess-tally').textContent = tallyLine();
  justGuessed = { name: '', points: got, seconds: s, wrong: wrongPicks, round };
  const theirs = guessRival;
  const who = theirs?.name || 'your friend';
  $('guess-rival').hidden = !theirs;
  if (theirs) $('guess-rival').textContent = got > theirs.points ? `You beat ${who}, who made ${theirs.points} after ${secs(theirs.seconds)}.` : got === theirs.points ? `Level with ${who}: ${theirs.points} each.` : `${cap(who)} stays ahead with ${theirs.points} after ${secs(theirs.seconds)}.`;
  $('btn-guess-send').textContent = theirs ? `Send yours back to ${who}` : 'Send it to a friend to guess';
  $('guess-note').textContent = 'Makes a link to send: the same place and the same four names, with your points to beat. The link doesn’t say which city it is.';
  $('guess-link').hidden = true;
  $<HTMLInputElement>('guess-name').value = lastName();
  guessRival = null;
  $('guess-before').hidden = true;
  $('guess-after').hidden = false;
}

function closeGuess(): void {
  guessing = false;
  $('guess').hidden = true;
  controls.enabled = playing;
  before = 0;
}
$('btn-guess').addEventListener('click', () => {
  askGuess();
  $('btn-guess').blur();
});
$('btn-guess-back').addEventListener('click', closeGuess);
$('btn-guess-send').addEventListener('click', async () => {
  if (!justGuessed) return;
  const g = { ...justGuessed, name: $<HTMLInputElement>('guess-name').value.trim().slice(0, 16) };
  const code = packGuess(g);
  countMade(code, g.round.at);
  // no place after the #: it would give the city away
  const url = `${linkHome(location)}?g=${code}`;
  const text = g.points ? `Where am I? I knew this city after ${secs(g.seconds)}: ${g.points} points. Can you beat that?` : 'Where am I? I didn’t get this city. Do you?';
  const theirs = 'Whoever opens it is put down where you were.';
  const box = $<HTMLInputElement>('guess-link');
  box.value = url;
  box.hidden = false;
  const note = $('guess-note');
  try {
    // a phone offers its own list of apps to send with
    if (document.body.classList.contains('touch') && navigator.share) {
      await navigator.share({ text, url });
      note.textContent = theirs;
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    note.textContent = `Link copied. ${theirs}`;
  } catch {
    box.select();
    note.textContent = `Copy this link and send it. ${theirs}`;
  }
});
$('guess-link').addEventListener('focus', (e) => (e.target as HTMLInputElement).select());
$('btn-guess-stay').addEventListener('click', () => {
  closeGuess();
  toast('Open jobs from the stations in town', 'info');
});
$('btn-guess-next').addEventListener('click', () => {
  closeGuess();
  save();
  setScreen('start');
  void drop();
});

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
    touch: 'Now take it to the <b class="y">yellow ring</b> before the clock at the top runs out. Time left over pays a bonus. Tap the little map for a big one.',
    done: (h) => h.job === null,
  },
  {
    keys: `${cap(deliveries(RUN_JOBS))} make a run for the scoreboard, and a run can be sent to a friend to beat. Mind the police: knocking people over, ramming and taking cars light up the badges and bring patrol cars. Stay out of their sight to cool off; stop next to one and you pay a fine.`,
    touch: `${cap(deliveries(RUN_JOBS))} make a run for the scoreboard, and a run can be sent to a friend to beat. Mind the police: knocking people over, ramming and taking cars light up the badges and bring patrol cars. Stay out of their sight to cool off; stop next to one and you pay a fine.`,
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
/** where that run went, to send to someone */
let freshCourse: Course | null = null;

function drawBoard(): void {
  // runs of another length (five, before runs were three) don't compare
  const list = scores().filter((s) => (s.jobs ?? 5) === RUN_JOBS || s.at === fresh?.at).slice(0, 10);
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
  $('result-home').hidden = true;
  const won = !!run && !!rival && (run.score > rival.score || (run.score === rival.score && run.seconds < rival.seconds));
  const them = rival?.name || 'The run you were sent';
  $('result-title').textContent = !run ? 'Scoreboard' : !rival ? 'Run complete' : won ? `You beat ${rival.name || 'the run you were sent'}` : `${them} stays ahead`;
  $('result-run').hidden = !run;
  if (run) {
    $('result-score').textContent = fmtMoney(run.score);
    $('result-line').textContent = `${cap(deliveries(run.jobs ?? RUN_JOBS))} in ${fmtTime(run.seconds)} · ${run.place}`;
    $('result-rival').hidden = !rival;
    if (rival) $('result-rival').textContent = `${them}: ${fmtMoney(rival.score)} in ${fmtTime(rival.seconds)}`;
    const can = !!freshCourse && freshCourse.legs.length === (run.jobs ?? RUN_JOBS) && !BAKED;
    $('challenge').hidden = !can;
    $('btn-challenge').textContent = rival ? `Send your run back to ${rival.name || 'them'}` : 'Challenge a friend to beat this';
    $('challenge-link').hidden = true;
    $('challenge-note').textContent = `Makes a link to send: the same ${deliveries(run.jobs ?? RUN_JOBS)}, with your score to beat.`;
    $('result-form').hidden = false;
    $<HTMLInputElement>('result-name').value = lastName();
  }
  $('btn-newrun').hidden = !game?.world;
  $('btn-close').textContent = document.body.dataset.screen !== 'play' ? 'Close' : run ? 'Continue with open jobs' : 'Keep driving';
  drawBoard();
  $('result').hidden = false;
  playing = false;
  controls.enabled = false;
}

/** How to find the open jobs: shown as a run's result is left behind, until it is tapped away or a while has passed. */
let openJobsT = 0;
function openJobs(show: boolean): void {
  clearTimeout(openJobsT);
  $('openjobs').hidden = !show;
  if (show) openJobsT = window.setTimeout(() => openJobs(false), 16000);
}
$('btn-openjobs').addEventListener('click', () => openJobs(false));

function closeBoard(): void {
  game?.comeDown();
  // from a run's result on into the open jobs: say where they are
  if (fresh && document.body.dataset.screen === 'play') openJobs(true);
  $('result').hidden = true;
  fresh = null;
  setScreen(document.body.dataset.screen === 'play' ? 'play' : 'start');
}

function runEnded(score: number, seconds: number): void {
  const run: Score = { name: '', score, seconds, place: placeName, at: Date.now(), jobs: game?.run.of ?? RUN_JOBS };
  freshCourse = game ? { start: game.course.start, legs: [...game.course.legs] } : null;
  addScore(run);
  if (!BAKED) countPlay('run');
  showBoard(run);
  // a home for the cash just made, near where the run ended
  homes?.offer($('result-home'));
}

$<HTMLFormElement>('result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>('result-name').value.trim().slice(0, 16);
  if (!fresh || !name) return;
  nameScore(fresh.at, name);
  $('result-form').hidden = true;
  drawBoard();
});
$('btn-challenge').addEventListener('click', async () => {
  if (!fresh || !freshCourse) return;
  const typed = $<HTMLInputElement>('result-name').value.trim().slice(0, 16);
  // a name written for the link goes on the board as well
  if (typed && !$('result-form').hidden) {
    nameScore(fresh.at, typed);
    fresh.name = typed;
    $('result-form').hidden = true;
    drawBoard();
  }
  const name = typed || fresh.name || lastName();
  const code = packChallenge({ name, score: fresh.score, seconds: fresh.seconds, place: fresh.place, course: freshCourse });
  const { start } = freshCourse;
  // the tally of links made and opened: the line under the button says so
  countMade(code, freshCourse.start);
  const url = `${linkHome(location)}?c=${code}#${start.lat.toFixed(5)},${start.lon.toFixed(5)}`;
  const text = `Beat my run in ${fresh.place}: ${fmtMoney(fresh.score)} in ${fmtTime(fresh.seconds)}, ${deliveries(freshCourse.legs.length)}.`;
  const theirs = `Whoever opens it plays your ${deliveries(freshCourse.legs.length)}.`;
  const box = $<HTMLInputElement>('challenge-link');
  box.value = url;
  box.hidden = false;
  const note = $('challenge-note');
  try {
    // a phone offers its own list of apps to send with
    if (document.body.classList.contains('touch') && navigator.share) {
      await navigator.share({ text, url });
      note.textContent = theirs;
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    note.textContent = `Link copied. ${theirs}`;
  } catch {
    box.select();
    note.textContent = `Copy this link and send it. ${theirs}`;
  }
});
$('challenge-link').addEventListener('focus', (e) => (e.target as HTMLInputElement).select());
$('btn-newrun').addEventListener('click', () => {
  openJobs(false);
  rival = null;
  if (!BAKED) history.replaceState(null, '', withoutChallenge() + location.hash);
  game?.newRun();
  $('result').hidden = true;
  fresh = null;
  setScreen('play');
  toast(`New run: ${deliveries(RUN_JOBS)}`, 'info');
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
  if (h.run) put('run', `Run ${Math.min(h.run.n, h.run.of)}/${h.run.of} · ${fmtMoney(h.run.score)}${rival ? ` <small>to beat ${fmtMoney(rival.score)}</small>` : ''}`);
  $('job').hidden = !h.job;
  if (h.job) {
    $('job').classList.toggle('late', h.job.left < 10);
    const what = { plain: 'Delivery', supply: 'Supply run', rush: 'Rush job', clean: 'Clean run' }[h.job.kind];
    $('job').dataset.kind = h.job.kind;
    put('job', `${h.run ? `${what} ${h.run.n}/${h.run.of}` : what} · <b class="time">${fmtTime(h.job.left)}</b> · ${fmtM(h.job.metres)} · <b>${fmtMoney(h.job.pay)}</b>`);
  }
  $('hint').hidden = !h.hint;
  if (h.hint) put('hint', `<kbd>E</kbd>${h.hint}`);

  // names over the well-known sights in the picture
  const box = $('sights');
  while (box.children.length < h.sights.length) box.append(document.createElement('div'));
  for (let i = 0; i < box.children.length; i++) {
    const el = box.children[i] as HTMLElement;
    // a sight's name would give the city away
    const s = secret ? undefined : h.sights[i];
    el.hidden = !s;
    if (!s) continue;
    const text = s.metres === null ? s.name : `${s.name} · ${fmtM(s.metres)}`;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('far', s.metres !== null);
    el.style.transform = `translate(${((s.ndcX + 1) / 2) * innerWidth}px, ${((1 - s.ndcY) / 2) * innerHeight}px) translate(-50%, ${s.metres === null ? -100 : -50}%)`;
  }

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
/** time spent playing in this visit (driving or walking, not paused, not on a card), for the counter */
let playedS = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = before ? (now - before) / 1000 : 0;
  before = now;
  if (!game?.world || !playing || mapOpen || paused || guessing || welcoming) sound.hear(null);
  if (paused || guessing || welcoming) return;
  if (game?.world && playing && !mapOpen) playedS += Math.min(dt, 1);
  if (!game?.world || !playing) {
    // behind the result of a run the camera goes on rising
    if (game?.world && fresh && !$('result').hidden) {
      game.watch(dt);
      paint(game.hud());
    }
    return;
  }
  if (mapOpen) {
    bigmap.draw(game);
    return;
  }
  game.tune(dt);
  game.update(dt, controls.read());
  if (secret) {
    // a frame that took long (the next streets arriving) is not time spent looking
    lookedS += Math.min(dt, 0.25);
    put('btn-guess', `<span>Guess the city<b>${points(lookedS, wrongPicks)}</b></span><small>tap when you know</small>`);
  }
  sound.hear(game.ears());
  if (showFps) fpsReadout(dt);
  const h = game.hud();
  paint(h);
  tour(h, dt);
  minimap.draw(game);
}
$('fps').hidden = !showFps;
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
// the map's key shows the same symbols the map does
for (const el of document.querySelectorAll<HTMLElement>('#bigmap-key .ico, #openjobs .ico')) el.style.backgroundImage = `url(${serviceIcon(el.dataset.kind as ServiceKind, !!el.dataset.invented).toDataURL()})`;
// ------------------------------------------------------------------ pause, and what to play

/** Hold the game, or let it go on. The card also lets the player change what they are playing. */
function setPause(on: boolean): void {
  if (on && (!playing || mapOpen || welcoming || !$('result').hidden || !$('guess').hidden)) return;
  paused = on;
  $('pause').hidden = !on;
  controls.enabled = playing && !on;
  if (!on) return;
  const jobs = !!game?.run.over;
  $('btn-switch').hidden = !!secret;
  if (secret) {
    $('pause-line').textContent = 'You are guessing a city. The points wait while you are here.';
    return;
  }
  $('pause-line').textContent = jobs ? 'You are doing open jobs.' : rival ? `You are on the run ${rival.name || 'someone'} sent you.` : 'You are on a run of three deliveries.';
  $('btn-switch').textContent = jobs ? 'Start a run of three' : 'Do open jobs instead';
}
$('btn-pause').addEventListener('click', () => {
  setPause(true);
  $('btn-pause').blur();
});
$('btn-continue').addEventListener('click', () => setPause(false));
$('pause').addEventListener('click', (e) => e.target === e.currentTarget && setPause(false));
$('btn-switch').addEventListener('click', () => {
  if (!game) return;
  const toJobs = !game.run.over;
  setPause(false);
  rival = null;
  if (!BAKED) history.replaceState(null, '', withoutChallenge() + location.hash);
  setMode(toJobs ? 'jobs' : 'run');
  if (toJobs) {
    game.openPlay();
    openJobs(true);
  } else {
    openJobs(false);
    game.newRun();
    toast(`New run: ${deliveries(RUN_JOBS)}`, 'info');
  }
});
$('btn-city').addEventListener('click', () => {
  setPause(false);
  save();
  setScreen('start');
});
addEventListener('keydown', (e) => {
  if (e.repeat || (e.code !== 'KeyP' && e.code !== 'Escape') || (e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
  // Esc closes the map first; that is handled where the map is
  if (mapOpen) return;
  if (paused) setPause(false);
  else if (playing) setPause(true);
});
// the game does not run on while its tab is out of sight
document.addEventListener('visibilitychange', () => document.hidden && setPause(true));
setMode(mode);
$('mode-run').addEventListener('click', () => setMode('run'));
$('mode-jobs').addEventListener('click', () => setMode('jobs'));
$('mode-guess').addEventListener('click', () => setMode('guess'));
$('btn-drop').addEventListener('click', () => void drop());

const soundButton = (): void => {
  $('btn-sound').classList.toggle('off', !sound.on);
  $('btn-sound').setAttribute('aria-label', sound.on ? 'Sound is on: turn it off' : 'Sound is off: turn it on');
};
soundButton();
$('btn-sound').addEventListener('click', () => {
  sound.toggle();
  soundButton();
  $('btn-sound').blur();
  // a note at once, so that the tap itself tells whether sound works on this device
  if (sound.on) setTimeout(() => sound.play('pickup'), 120);
});
(window as unknown as { sound: Sound }).sound = sound;
$('btn-menu').addEventListener('click', () => {
  save();
  setScreen('start');
});
$('btn-resume').addEventListener('click', () => setScreen('play'));
// The little map can be put in any corner: press it and drag. A short tap still opens the big map.
{
  const mini = $('minimap');
  const KEPT = '3da-minimap-corner';
  const CORNERS = ['tl', 'tr', 'bl', 'br'];
  try {
    const c = localStorage.getItem(KEPT);
    if (c && CORNERS.includes(c)) mini.dataset.corner = c;
  } catch {
    /* no store: it starts where it always did */
  }
  let from: { x: number; y: number; left: number; top: number } | null = null;
  let dragging = false;
  let dragged = false;
  mini.addEventListener('pointerdown', (e) => {
    const box = mini.getBoundingClientRect();
    const home = (mini.offsetParent ?? document.body).getBoundingClientRect();
    from = { x: e.clientX, y: e.clientY, left: box.left - home.left, top: box.top - home.top };
    dragging = false;
    mini.setPointerCapture(e.pointerId);
  });
  mini.addEventListener('pointermove', (e) => {
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (!dragging && Math.hypot(dx, dy) < 12) return;
    dragging = true;
    mini.classList.add('moving');
    mini.style.left = `${from.left + dx}px`;
    mini.style.top = `${from.top + dy}px`;
    mini.style.right = 'auto';
    mini.style.bottom = 'auto';
  });
  const drop = (): void => {
    if (!from) return;
    from = null;
    if (!dragging) return;
    dragging = false;
    dragged = true;
    // the corner its middle is nearest to
    const box = mini.getBoundingClientRect();
    const corner = (box.top + box.height / 2 < innerHeight / 2 ? 't' : 'b') + (box.left + box.width / 2 < innerWidth / 2 ? 'l' : 'r');
    mini.classList.remove('moving');
    mini.style.left = mini.style.top = mini.style.right = mini.style.bottom = '';
    mini.dataset.corner = corner;
    try {
      localStorage.setItem(KEPT, corner);
    } catch {
      /* it stays there for this visit */
    }
  };
  mini.addEventListener('pointerup', drop);
  mini.addEventListener('pointercancel', drop);
  mini.addEventListener('click', () => {
    // the press that ended a drag is not a tap
    if (dragged) {
      dragged = false;
      return;
    }
    showMap(true);
  });
}
$('bigmap-canvas').addEventListener('click', () => showMap(false));
$('btn-map-close').addEventListener('click', () => showMap(false));
$('btn-line').addEventListener('click', toggleRoute);
// a tap beside the card closes it too
$('bigmap').addEventListener('click', (e) => e.target === e.currentTarget && showMap(false));
addEventListener('keydown', (e) => {
  // the press that opened the map was handled by the controls already
  if (!mapOpen || e.defaultPrevented || e.repeat || !['Escape', 'KeyM', 'KeyG'].includes(e.code)) return;
  e.preventDefault();
  if (e.code === 'KeyG') toggleRoute();
  else showMap(false);
});
$('btn-anyway').addEventListener('click', begin);
addEventListener('pagehide', () => save());

// saving online, for a player who enters a name; without one none of it contacts anyone.
// It opens with the first home bought (or for a player already saving); a link to a saved game works
// for everyone. `?try=nosaving` in the address hides it in that browser, until `?try=saving`.
let savingOpen = false;
function openSaving(): void {
  if (BAKED || !savingTrial || savingOpen) return;
  savingOpen = true;
  wireCloud($('account'), linkHome(location), lastName);
}
const savingTrial = ((): boolean => {
  try {
    const tries = (new URLSearchParams(location.search).get('try') ?? '').split(',');
    if (tries.includes('saving')) localStorage.removeItem('3da-no-saving');
    if (tries.includes('nosaving')) localStorage.setItem('3da-no-saving', '1');
    localStorage.removeItem('3da-try-saving');
    return localStorage.getItem('3da-no-saving') !== '1';
  } catch {
    return true;
  }
})();
if (!BAKED && savingTrial) {
  // a game saved on another device comes first: it replaces what this browser has, then the page starts again
  if ((await cloudArrive((name) => confirm(`Replace the game on this device with ${name}'s saved game? The game and scoreboard here would be lost.`))) === 'reload') location.reload();
  if (savingOn() || loadHomes().homes.length) openSaving();
}

// a place in the link starts there straight away: coordinates, or a name to look up
const linked = BAKED ? '' : decodeURIComponent(location.hash.slice(1)).replace(/[_+]/g, ' ').trim();
const fromLink = parseLatLon(linked);
const code = BAKED ? null : new URLSearchParams(location.search).get('c');
const sentRun = code ? readChallenge(code) : null;
if (!BAKED) cameByVideo(new URLSearchParams(location.search));
if (!BAKED) countVisit(new URLSearchParams(location.search));
if (!BAKED) countTime(() => playedS);
if (sentRun) countOpened(sentRun.course.start);
const sentGuess = BAKED || sentRun ? null : readGuess(new URLSearchParams(location.search).get('g') ?? '');
if (sentGuess) countOpened(sentGuess.round.at);
if (sentRun) void go(sentRun.course.start, sentRun.place || undefined, sentRun);
else if (sentGuess) void drop(sentGuess);
else if (fromLink) void go(fromLink);
else if (linked) {
  $<HTMLInputElement>('q').value = linked;
  void search(linked);
}

// a trial (`?try=radio`): a car radio with stations of the town
wireRadio($<HTMLButtonElement>('btn-radio'), $('radio-bar'), () => (game?.world ? game.world.centre : null), () => playing && !!game?.car, toast, () => !!secret);
