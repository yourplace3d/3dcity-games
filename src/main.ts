/**
 * Drive it 3D: the screens around the game. Pick a place, then the loop runs: read the keys or
 * the touch stick, step the game, draw, and keep the numbers on screen up to date.
 */

import { Game, MAX_CASH, RUN_JOBS, type Course, type Hud } from './game/game';
import { linkHome, packChallenge, readChallenge, type Challenge } from './challenge';
import { cameByVideo, countCity, countMade, countOpened, countPlay, countTime, countVisit, playingAt } from './linkCount';
import { arrive as cloudArrive, changed, savedName, savingOn } from './cloud';
import { loadHomes, type Home } from './game/homes';
import { loadReno, type Reno } from './game/renovation';
import { loadSaved } from './game/bank';
import { drawHomes, homeTowns, isCoords } from './homesList';
import { wireCloud } from './cloudUi';
import { Sound } from './sound';
import { addonHost } from './addon';
import { HomesUi } from './homesUi';
import { arriveLine, PartyUi } from './partyUi';
import { StoryUi } from './storyUi';
import { menuLine as discordLine } from './discord';
import { readParty, type SentParty } from './game/party';
import { drawTrophies, Trophies, type TrophyId } from './trophies';
import { flatsFree, FLAT_POINTS, HOUSE_POINTS, loadPoints, POINTS_MAX } from './game/homePoints';
import { fullNote } from './full';
import { wireRadio } from './radio';
import { keepClear } from './clearOf';
import { RING, serviceIcon, type ServiceKind } from './game/services';
import { Controls } from './game/input';
import { Minimap } from './game/minimap';
import { areaKey, squaresAround, World } from './game/world';
import { findPlace, nearCity, placeAt, placeFromHash } from './places';
import { readPlayerSave } from './playerSave';
import { newRound, packGuess, played, points, readGuess, type Round, type SentGuess } from './guess';
import { addScore, keepName, lastName, nameScore, scores, type Score } from './scores';
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
// the legends on the page in the colours of the rings in the game
for (const [name, colour] of [['cyan', RING.plain], ['ring-fuel', RING.supply], ['ring-fire', RING.rush], ['ring-police', RING.clean], ['ring-party', RING.party], ['ring-home', RING.home]]) document.documentElement.style.setProperty(`--${name}`, colour);
const small = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
addEventListener('pointerdown', (e) => document.body.classList.toggle('touch', e.pointerType === 'touch'), true);

let game: Game | null = null;
let homes: HomesUi | null = null;
/** parties at the player's homes (`partyUi.ts`) */
let party: PartyUi | null = null;
/** the story (`storyUi.ts`): its chapters, the people's messages, the Story tab */
let story: StoryUi | null = null;
/** a friend's party from the link the page was opened with, until it starts */
let linkParty: SentParty | null = null;
/** the party of the link, for the line under the place's name, for as long as its place is played */
let partyShown: SentParty | null = null;
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
/** The cards of the stations' jobs: what each asks of the player. */
const JOB_CARDS = {
  supply: { title: 'Supply run', text: 'A heavy load: slow uphill and slow to stop. More pay for a car without a new dent.', rule: 'More pay for a car without a new dent.' },
  rush: { title: 'Rush job', text: 'A short clock, and every second left over pays three times.', rule: 'Every second left over pays three times.' },
  clean: { title: 'Clean run', text: 'Pays well, but break the law on the way and the job is gone.', rule: 'Break the law on the way and the job is gone.' },
} as const;

/** things done in the game, kept with the day (`trophies.ts`) */
const trophies = new Trophies();
trophies.onStored = () => changed();
trophies.onEarned = (names) =>
  toast(names.length === 1 ? `Trophy: ${names[0]}` : `${names.length} trophies: ${names.join(', ')}`, 'good', 8000, secret ? undefined : () => setPause(true, 'trophies'));
/** the big map is up and the game waits behind it */
let mapOpen = false;
/** the game waits behind the menu (`setPause`) */
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
  if (open && (!game?.world || !playing || paused || guessing || welcoming)) return;
  mapOpen = open;
  $('bigmap').hidden = !open;
  controls.enabled = playing && !open && !paused && !guessing && !welcoming;
  // a home shown from the side menu blinks on the map; the line under the place says so
  if (!open) bigmap.spot = null;
  const spot = open ? bigmap.spot : null;
  // the arrow stops pointing 40 m from the home (`HomesUi.missionTick`)
  const near = !!spot && !!game && Math.hypot(spot.x - game.pos()[0], spot.y - game.pos()[1]) < 40;
  $('bigmap-note').textContent = spot ? (near ? 'your home blinks · you are right beside it' : 'your home blinks · the arrow shows the way when you close this') : '1.5 km across · north is up · the game waits';
  if (open) {
    $('bigmap-place').textContent = secret ? 'Where am I?' : placeName;
    lineButton();
  }
}

const controls = new Controls($('pad'), $('knob'), $('btn-action'), $('btn-brake'));

function load(): { cash: number; delivered: number; at?: LngLat } {
  try {
    return readPlayerSave(localStorage.getItem(SAVE));
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

/**
 * A line over the game that leads somewhere (the menu) can be clicked with a mouse. On touch screens the
 * lines take no taps, as the steering pad lies under them, so such a line also pulses the house button,
 * and the button then does what the oldest such line still showing would do: the one the player has had
 * longest to read. Both ways stay open, as a tablet with a trackpad goes from one to the other.
 */
const asks: Array<{ tap: () => void; until: number; el: HTMLElement }> = [];
let askT = 0;
function askedNow(): typeof asks {
  const now = performance.now();
  // gone: shown long enough, clicked, or pushed out by newer lines
  for (let i = asks.length - 1; i >= 0; i--) if (asks[i].until <= now || !asks[i].el.isConnected) asks.splice(i, 1);
  return asks;
}
function nudgeButton(): void {
  const b = $('btn-estate');
  clearTimeout(askT);
  const left = askedNow();
  if (!left.length) {
    b.classList.remove('nudge');
    return;
  }
  askT = window.setTimeout(nudgeButton, Math.min(...left.map((a) => a.until)) - performance.now() + 20);
}
function toast(text: string, kind: 'good' | 'bad' | 'info' = 'info', ms = 3300, tap?: () => void): void {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  showEl(el, ms, tap);
}
/** A line over the game made elsewhere (the story's messages), shown as the lines are. */
function showEl(el: HTMLElement, ms: number, tap?: () => void, nudge = true): void {
  el.classList.add('toast');
  if (tap) el.classList.add('tap');
  if (tap) {
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.addEventListener('click', () => {
      el.remove();
      nudgeButton();
      tap();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      el.click();
    });
    // a line reached through the house button (on a touch screen) makes it pulse; the story's lines are not
    if (nudge) {
      asks.push({ tap, until: performance.now() + ms, el });
      // the pulse starts again for each new line
      const b = $('btn-estate');
      b.classList.remove('nudge');
      void b.offsetWidth;
      b.classList.add('nudge');
    }
  }
  // it fades over the time it is shown, a long message as well as a short one
  el.style.animationDuration = `${ms}ms`;
  const box = $('toasts');
  box.append(el);
  // three at most: the oldest goes first, but a line that can be tapped stays while others can go
  while (box.children.length > 3) ([...box.children].find((c) => c !== el && !c.classList.contains('tap')) ?? box.firstElementChild)!.remove();
  if (tap && nudge) nudgeButton();
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
  homesButtons();
}

/** Load a place and start playing in it. `here`: the place is where the visitor is ("Where I am"), which is never counted. */
async function go(at: LngLat, name?: string, sent: Challenge | null = null, here = false): Promise<void> {
  if (busy) return;
  busy = true;
  // a friend's party from the link is for its own place only: going anywhere else drops it, and the link
  if (linkParty && (Math.abs(at.lat - linkParty.home.lat) > 1e-6 || Math.abs(at.lon - linkParty.home.lon) > 1e-6)) {
    linkParty = null;
    partyClosed();
  }
  partyShown = linkParty;
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
      // a station's job: a card, and the player takes it or not
      game.onOffer = (kind, special, answer) => {
        const job = JOB_CARDS[kind as keyof typeof JOB_CARDS];
        if (!job) return answer(true);
        missionCard(
          job.title,
          `${special ? `${special}. ${job.rule}` : job.text} While you are on it there are no other jobs and nothing to buy: only this delivery, until it is done or the job is gone.`,
          'Take the job',
          'Not now',
          answer,
          'Open job',
        );
      };
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
        runEnded(score, seconds);
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
      party = new PartyUi({ game, homes: () => homes, toast, card: missionCard, cover, place: () => placeName, name: lastName, keepName, closed: partyClosed, save: () => save(), started: runOver });
      (window as unknown as { party: PartyUi }).party = party;
      const p = party;
      homes = new HomesUi({
        game,
        toast,
        save: () => save(),
        place: () => placeName,
        firstHome: welcomeHome,
        card: missionCard,
        openHomes: () => setPause(true, 'estate'),
        quiet: () => !!secret,
        blocked: () => !playing || menuOpen || mapOpen || welcoming || guessing || !$('result').hidden || !$('thin').hidden,
        party: { can: (h) => !secret && p.can(h), label: (h) => p.label(h), tag: () => p.tag(), offer: (h) => p.offer(h) },
        kicker: (what) => story?.kicker(what),
        people: {
          note: (who, from, text, strip) => story?.note(who, from, text, strip),
          record: (text) => story?.record(text),
          officer: () => story?.officer() ?? '',
          names: () => story?.peopleNames() ?? [],
        },
      });
      (window as unknown as { homes: HomesUi }).homes = homes;
      story = new StoryUi({
        game,
        homes: () => homes,
        // on a touch screen the lines take no taps, and the house button keeps leading to the real estate
        show: (el, ms, tap) => showEl(el, ms, document.body.classList.contains('touch') ? undefined : tap, false),
        openStory: () => setPause(true, 'story'),
        // a card, the menu, the map, the result, the tour: the messages wait
        blocked: () => !playing || menuOpen || mapOpen || welcoming || guessing || !$('result').hidden || !$('thin').hidden || step >= 0,
        quiet: storyQuiet,
        goHome,
        closeMenu: () => setPause(false),
        stored: () => changed(),
        card: missionCard,
      });
      (window as unknown as { story: StoryUi }).story = story;
      // a car to look for: the note on the open jobs goes, as there are none meanwhile
      {
        const g = game;
        g.ticks.push(() => {
          if (g.find && !$('openjobs').hidden) openJobs(false);
        });
      }
      // trophies: what happens in play, and now and then what the player has
      {
        const g = game;
        g.events.push((e) => {
          const ids: TrophyId[] = [];
          if (e.kind === 'lost') ids.push('lost');
          // a run a friend sent can have another number of deliveries
          if (e.kind === 'run' && g.run.of === RUN_JOBS) ids.push(...(e.fined ? (['run'] as const) : (['run', 'clean'] as const)));
          if (e.kind === 'delivered' && e.job === 'rush' && e.left >= 30) ids.push('rush');
          if (ids.length) trophies.give(ids);
        });
        let every = 0;
        g.ticks.push((dt) => {
          every -= dt;
          if (every > 0 || !homes) return;
          every = 1;
          const mine = homes.mine();
          const towns = homeTowns(mine.homes, mine.reno);
          trophies.check({
            car: !!g.car,
            delivered: g.delivered,
            homes: mine.homes.length,
            saved: mine.saved,
            building: mine.homes.some((h) => h.kind === 'building'),
            painted: mine.homes.some((h) => !!h.colour),
            towns: towns.length,
            rentPerDay: towns.reduce((n, t) => n + t.rent, 0),
            story: !!story?.done(8),
          });
        });
      }
      addonHost({ game, toast, api: 2 });
      // a tester's key was in play: say how it went
      void fullNote.then((n) => n && toast(n.text, n.kind));
    }
    await game.start(at);
    // a new place: the story's visit begins again (its first seconds, its line)
    story?.arrived();
    // a place played, for the trophies of places; not one a Where am I? round put the player in
    if (!dropping) trophies.visit(at.lat, at.lon);
    // which city is played; not one a Where am I? round put the player in, nor the place "Where I am" found
    if (!BAKED && !dropping && !here) countCity(at);
    // a run a friend sent is a run, whatever the start screen is set to; a friend's party starts once the place is shown
    if (linkParty) game.openPlay();
    else if (sent || mode === 'run') game.newRun(sent?.course ?? null);
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
    if (!BAKED) history.replaceState(null, '', dropping ? withoutChallenge() : `${sent || linkParty ? location.search : withoutChallenge()}#${at.lat.toFixed(5)},${at.lon.toFixed(5)}`);
    $('btn-menu').blur();
    status.textContent = '';
    // little on the map here: say so, and let them choose
    const thin = game.world.thin && !dropping;
    $('thin').hidden = !thin;
    if (thin) {
      $<HTMLAnchorElement>('thin-map').href = `https://www.openstreetmap.org/#map=16/${at.lat.toFixed(5)}/${at.lon.toFixed(5)}`;
      $('btn-resume').hidden = true;
      // seen at once on any screen: the keyboard away, and the search field with the box under it at the top
      (document.activeElement as HTMLElement | null)?.blur();
      requestAnimationFrame(() => $('search').scrollIntoView({ block: 'start' }));
      return;
    }
    begin();
  } catch (err) {
    console.warn(err);
    // the friend's party waits for its place: a retry of the same place still brings it, any other place drops it
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
    : partyShown
    ? arriveLine(partyShown)
    : rival
    ? `${rival.name || 'Someone'} made ${fmtMoney(rival.score)} here in ${fmtTime(rival.seconds)}. Same ${deliveries(rival.course.legs.length)}: beat it.`
    : game?.run.over
      ? 'Open jobs: look for the pump, the flame and the badge'
      : `${cap(deliveries(RUN_JOBS))} make a run`;
  const el = $('arrive');
  el.classList.toggle('sent', !!rival || !!partyShown || (!!secret && !!guessRival));
  el.hidden = true;
  void el.offsetWidth;
  el.hidden = false;
  clearTimeout(arriveT);
  arriveT = window.setTimeout(() => (el.hidden = true), rival || partyShown || (secret && guessRival) ? 6000 : 3200);
}
let arriveT = 0;

/** The link's query without a sent run in it, for when the player goes on to something else. */
function withoutChallenge(): string {
  const q = new URLSearchParams(location.search);
  q.delete('c');
  q.delete('g');
  q.delete('p');
  const text = q.toString().replace(/=(?=&|$)/g, '');
  return location.pathname + (text ? `?${text}` : '');
}

function begin(): void {
  $('thin').hidden = true;
  setScreen('play');
  if (placeKnown) arrive();
  // a friend's party from the link: its card, then the party. Not the tour of the deliveries, which says
  // nothing true of a party: a new player is told how to take a car once the party starts (`runOver`)
  if (linkParty && party) {
    const s = linkParty;
    linkParty = null;
    party.startSent(s);
    carHint = !coached();
    return;
  }
  if (rival && coached()) return;
  if (secret) {
    // someone who came by a friend's link may never have played: say how to get going, once the sign has been read
    setTimeout(() => playing && secret && !game?.car && toast(document.body.classList.contains('touch') ? 'Walk to a car and tap Get in' : 'Walk to a car and press E', 'info'), guessRival ? 6200 : 3400);
    return;
  }
  // open jobs from the start: say where they are, once the place's name has been read
  if (game?.run.over && coached()) {
    setTimeout(() => playing && game?.run.over && openJobs(true), 3600);
    return;
  }
  if (coached()) toast(document.body.classList.contains('touch') ? 'Walk to a car and tap Get in' : 'Walk to a car and press E', 'info');
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
function welcomeHome(what: string, rent: string, worn: boolean): void {
  openSaving();
  welcoming = true;
  controls.enabled = false;
  if (game) game.held = true;
  $('firsthome-what').textContent = worn
    ? `It's yours: ${what}. But the colours on its walls are worn down, and it pays no rent until it is repaired: then ${rent} each day you come back to the game. Look out for the fuel, fire and police stations: their rings flash green now, and any of their jobs starts the repairs.`
    : `It's yours: ${what}. It pays ${rent} rent each day you come back to the game.`;
  const saving = savingOn();
  $('firsthome-save').textContent = saving
    ? `Your game is saved online as ${savedName()}, and your home with it.`
    : 'From now on you can save your game online: give it a name and go on with it on another device. Your home stays yours.';
  $('btn-firsthome-save').hidden = saving || !savingOpen;
  $('btn-firsthome-go').textContent = saving ? 'Go on' : 'Later';
  $('firsthome').hidden = false;
}
/** A card over the game that waits for a yes or a no (the homes' mission). */
let missionAnswer: ((yes: boolean) => void) | null = null;
function missionCard(title: string, text: string, yes: string, no: string, answer: (yes: boolean) => void, kicker = 'Private mission open now', later = ''): void {
  welcoming = true;
  $('mission-kicker').textContent = kicker;
  $('mission').dataset.kind = kicker === 'Party' || kicker === 'Invitation' ? 'party' : '';
  controls.enabled = false;
  // the game waits while the card is read: a package's clock too
  if (game) game.held = true;
  $('mission-title').textContent = title;
  $('mission-text').textContent = text;
  $('btn-mission-yes').textContent = yes;
  $('btn-mission-no').textContent = no;
  $('btn-mission-no').hidden = !no;
  // a third button, which answers nothing: the card comes again another time
  $('btn-mission-later').textContent = later;
  $('btn-mission-later').hidden = !later;
  missionAnswer = answer;
  $('mission').hidden = false;
}
function closeMission(yes: boolean | null): void {
  $('mission').hidden = true;
  welcoming = false;
  if (game) game.held = false;
  controls.enabled = playing && !paused;
  before = 0;
  const answer = missionAnswer;
  missionAnswer = null;
  if (yes !== null) answer?.(yes);
}
$('btn-mission-yes').addEventListener('click', () => closeMission(true));
$('btn-mission-no').addEventListener('click', () => closeMission(false));
$('btn-mission-later').addEventListener('click', () => closeMission(null));
/** The game waits behind a card of its own (a party's end), or goes on. */
function cover(on: boolean): void {
  welcoming = on;
  if (game) game.held = on;
  controls.enabled = playing && !paused && !on;
  before = 0;
}
/** a new player came by a party's link: how to take a car is said as the party starts */
let carHint = false;
/** A party has started: a run a friend sent is over, and leaves the address, so a reload does not bring it back. */
function runOver(): void {
  rival = null;
  if (carHint) {
    carHint = false;
    setTimeout(() => playing && !game?.car && toast(document.body.classList.contains('touch') ? 'Walk to a car and tap Get in' : 'Walk to a car and press E', 'info'), 600);
  }
  if (BAKED || !new URLSearchParams(location.search).has('c')) return;
  const q = new URLSearchParams(location.search);
  q.delete('c');
  const text = q.toString().replace(/=(?=&|$)/g, '');
  history.replaceState(null, '', location.pathname + (text ? `?${text}` : '') + location.hash);
}
/** A party is over and its card closed: a friend's party leaves the address, so a reload is not the party again. */
function partyClosed(): void {
  if (!BAKED && new URLSearchParams(location.search).has('p')) history.replaceState(null, '', withoutChallenge() + location.hash);
}
function closeWelcome(): void {
  $('firsthome').hidden = true;
  welcoming = false;
  if (game) game.held = false;
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
const wrongNames = new Set<string>();
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
    wrongNames.clear();
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
    b.disabled = wrongNames.has(name);
    b.classList.toggle('wrong', b.disabled);
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
    wrongNames.add(name);
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
  if (name === round.city) trophies.give(['guessed']);
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
    touch: 'Drag anywhere on the left half of the screen to walk. Step up to the car beside you and tap <b>Get in</b>.',
    done: (h) => h.carHp !== null,
  },
  {
    keys: 'Drive with the same keys, <kbd>Space</kbd> is the handbrake. Follow the arrow to a <b class="c">turquoise ring</b> and drive through it to pick up a package. At a station’s ring (orange, red or blue), stop: a card shows the job.',
    touch: 'Drag to steer and drive, hold the red <b>Brake</b> pedal to stop. Follow the arrow to a <b class="c">turquoise ring</b> and drive through it to pick up a package. At a station’s ring (orange, red or blue), stop: a card shows the job.',
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
  put('coach-text', onFoot ? (touch ? 'You are on foot. Walk up to a car and tap <b>Get in</b>. A parked one is free to take.' : 'You are on foot. Walk up to a car and press <kbd>E</kbd>. A parked one is free to take.') : touch ? TOUR[step].touch : TOUR[step].keys);
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
  busy = true;
  status.className = 'status';
  status.textContent = '';
  working('Searching');
  const found = await findPlace(q);
  busy = false;
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
  // while a car is looked for there are no jobs to point at
  if (show && game?.find) return;
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
  const ended = game?.run;
  const run: Score = { name: '', score, seconds, place: placeName, at: Date.now(), jobs: game?.run.of ?? RUN_JOBS };
  const course = game ? { start: game.course.start, legs: [...game.course.legs] } : null;
  addScore(run);
  if (!BAKED) countPlay('run');
  // Save the completed run now, but let the final delivery's message be read. A new
  // run or a city/menu change during that delay must not receive the old result.
  const showResult = (): void => {
    if (!playing || busy || game?.run !== ended) return;
    if (paused || mapOpen || guessing || welcoming) {
      setTimeout(showResult, 100);
      return;
    }
    freshCourse = course;
    showBoard(run);
    homes?.offer($('result-home'));
  };
  setTimeout(showResult, 1400);
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

const escHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The line over the game while a customer's car is looked for: the step the player is at, and how far. */
function findLine(f: NonNullable<Hud['find']>, car: string): string {
  const what = escHtml(car || 'the customer’s car');
  const far = f.metres === null ? '' : ` · ${fmtM(f.metres)}`;
  if (f.stage === 'search') return `Find ${what} · <b class="find">orange circle</b>${far}`;
  if (f.stage === 'look') return `Look around the circle for ${what}`;
  if (f.stage === 'seen') return `There it is: get in${far}`;
  return `Drive it back to the pump · <b>yellow ring</b>${far}`;
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
  $('job').hidden = !h.job && !h.find;
  if (!h.job && h.find) {
    // looking for a customer's car: what to do now, always in sight (the owner, 27 November 2026: "one must
    // be able to read the task somewhere"; the cards and toasts that said it were gone after a few seconds)
    $('job').classList.remove('late');
    $('job').dataset.kind = 'find';
    put('job', findLine(h.find, story?.soughtCar() ?? ''));
  } else if (h.job) {
    $('job').classList.toggle('late', h.job.left < 10);
    $('job').dataset.kind = h.job.party ? 'party' : h.job.kind;
    if (h.job.party) put('job', `${party?.hudLabel() ?? 'Party'} · <b class="time">${fmtTime(h.job.left)}</b> · ${fmtM(h.job.metres)}`);
    else {
      const what = { plain: 'Delivery', supply: 'Supply run', rush: 'Rush job', clean: 'Clean run' }[h.job.kind];
      put('job', `${h.run ? `${what} ${h.run.n}/${h.run.of}` : what} · <b class="time">${fmtTime(h.job.left)}</b> · ${fmtM(h.job.metres)} · <b>${fmtMoney(h.job.pay)}</b>`);
    }
  }
  $('hint').hidden = !h.hint;
  if (h.hint) put('hint', `<kbd>E</kbd>${h.hint}`);
  touchButtons(h);

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
    // in the colour of the ring it points to: each station its own, a plain package turquoise
    if (arrow.dataset.ring !== h.target.colour) {
      arrow.dataset.ring = h.target.colour;
      arrow.style.setProperty('--ring', h.target.colour);
    }
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

/**
 * The two touch buttons follow what you're doing: the brake pedal only in a car, and the other
 * button says what a press would do (get in, get out, take the subway, an add-on's thing). On foot
 * with nothing in reach it goes away, since a press would do nothing.
 */
let touchSeen = '';
function touchButtons(h: Hud): void {
  const inCar = h.carHp !== null;
  // the game's own "wrecked" says why, not what the press does: it gets you out
  const said = h.hint && h.hint !== 'wrecked' ? h.hint : '';
  const label = said ? said[0].toUpperCase() + said.slice(1) : inCar ? 'Get out' : '';
  const mode = !label ? 'in' : inCar && !said ? 'out' : /^(get in|take this (car|bus))$/.test(said) ? 'in' : 'other';
  const seen = `${inCar}|${label}|${mode}`;
  if (seen === touchSeen) return;
  touchSeen = seen;
  const brake = $('btn-brake');
  if (!inCar && !brake.classList.contains('off')) controls.releaseBrake();
  brake.classList.toggle('off', !inCar);
  const act = $('btn-action');
  act.classList.toggle('off', !label);
  act.dataset.mode = mode;
  if (label) {
    put('action-label', label);
    act.setAttribute('aria-label', label);
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
  estateButton();
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
        (p) => void go({ lat: p.coords.latitude, lon: p.coords.longitude }, undefined, null, true),
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

type MenuTab = 'game' | 'story' | 'estate' | 'trophies';
/** the menu is open, over the game or over the start screen */
let menuOpen = false;

/**
 * The menu over the game (☰, P or Esc), and the game waits behind it. Four tabs: paused (what is being
 * played, and changing it), the story (`storyUi.ts`), the player's real estate, and their trophies. Over the
 * start screen it opens without the first; while a city is guessed, only the first, as the homes would give
 * the city away. The story's tab shows once a place has been played on this page, and not while the story
 * is quiet (`storyQuiet`).
 */
function setPause(on: boolean, tab: MenuTab = 'game'): void {
  if (on && playing && (mapOpen || welcoming || guessing || !$('result').hidden || !$('guess').hidden)) return;
  if (on && !playing && tab === 'game') return;
  if (on && secret) tab = 'game';
  paused = on && playing;
  menuOpen = on;
  $('pause').hidden = !on;
  controls.enabled = playing && !on;
  before = 0;
  if (!on) return;
  $('tab-game').hidden = !playing;
  $('tab-estate').hidden = $('tab-trophies').hidden = !!secret;
  $('tab-story').hidden = !story || storyQuiet();
  if (tab === 'story' && $('tab-story').hidden) tab = playing ? 'game' : 'estate';
  const tabs: Array<[MenuTab, string]> = [['game', 'game'], ['story', 'story'], ['estate', 'estate'], ['trophies', 'trophies']];
  for (const [t, id] of tabs) {
    $(`tab-${id}`).setAttribute('aria-selected', String(t === tab));
    $(`pane-${id}`).hidden = t !== tab;
  }
  if (tab === 'trophies') drawTrophies($('trophies-list'), $('trophies-line'), trophies);
  if (tab === 'story') story?.draw($('pane-story'), playing);
  if (tab === 'estate') drawEstate();
  if (tab !== 'game') return;
  const jobs = !!game?.run.over;
  $('btn-switch').hidden = !!secret;
  if (secret) {
    $('pause-line').textContent = 'You are guessing a city. The points wait while you are here.';
    return;
  }
  if (game?.party && party) {
    $('pause-line').textContent = party.pauseLine();
    $('btn-switch').textContent = 'Call off the party';
    return;
  }
  if (game?.find) {
    const car = story?.soughtCar() || 'the customer’s car';
    $('pause-line').textContent = `You are looking for a customer’s car. Find ${car} in the orange circle on the little map, get in, and drive it back to the yellow ring at the pump.`;
    $('btn-switch').textContent = 'Stop looking';
    return;
  }
  $('pause-line').textContent = jobs ? 'You are doing open jobs.' : rival ? `You are on the run ${rival.name || 'someone'} sent you.` : 'You are on a run of three deliveries.';
  $('btn-switch').textContent = jobs ? 'Start a run of three' : 'Do open jobs instead';
}
$('btn-menu').addEventListener('click', () => {
  $('btn-menu').blur();
  setPause(true);
});
$('btn-menu-close').addEventListener('click', () => setPause(false));
$('tab-game').addEventListener('click', () => setPause(true, 'game'));
$('tab-story').addEventListener('click', () => setPause(true, 'story'));
$('tab-estate').addEventListener('click', () => setPause(true, 'estate'));
$('tab-trophies').addEventListener('click', () => setPause(true, 'trophies'));
$('btn-continue').addEventListener('click', () => setPause(false));
// the Discord, on the menu's first tab: only once the owner has set an invite (`discord.ts`)
discordLine($('discord-menu'));
discordLine($('discord-start'), 'start');
$('pause').addEventListener('click', (e) => e.target === e.currentTarget && setPause(false));
$('btn-switch').addEventListener('click', () => {
  if (!game) return;
  if (game.party) {
    setPause(false);
    party?.callOff();
    return;
  }
  if (game.find) {
    setPause(false);
    game.stopFind('dropped');
    return;
  }
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
  if (menuOpen) setPause(false);
  else if (playing) setPause(true);
});
// the game does not run on while its tab is out of sight
document.addEventListener('visibilitychange', () => document.hidden && !menuOpen && setPause(true));
setMode(mode);
$('mode-run').addEventListener('click', () => setMode('run'));
$('mode-jobs').addEventListener('click', () => setMode('jobs'));
$('mode-guess').addEventListener('click', () => setMode('guess'));
$('btn-drop').addEventListener('click', () => void drop());

// ------------------------------------------------------------------ the player's homes, wherever they are

/** What the player owns: the game's own while it runs, else what the browser keeps. */
function owned(): { homes: Home[]; reno: Reno | null; saved: number } {
  if (homes) return homes.mine();
  const h = loadHomes();
  return { homes: h.homes, reno: loadReno(h.homes.length > 0), saved: loadSaved() };
}

/** The start screen's way to the real estate and trophies: once there is something in them, and never while a city is guessed. */
function homesButtons(): void {
  const n = owned().homes.length;
  $('btn-homes').hidden = (!n && !trophies.count()) || !!secret;
  $('btn-homes').textContent = n ? `Real estate (${n}) & trophies` : 'Trophies';
}

/** The ring of home points: on the house button, and bigger at the top of the side menu. */
function ring(points: number): string {
  const fill = Math.min(points, HOUSE_POINTS) / HOUSE_POINTS;
  // no fill at all at 0: a round end alone would draw a dot
  return `<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="track" cx="22" cy="22" r="18.5"/>${fill > 0 ? `<circle class="fill" cx="22" cy="22" r="18.5" pathLength="100" stroke-dasharray="${Math.round(fill * 100)} 100"/>` : ''}<path class="house" d="M22 11.5l10 9.2h-3V31H15V20.7h-3z"/></svg>`;
}

let buttonShows = '';
/** The house button: the ring fills with home points toward a house; the number is the flats they buy now. */
function estateButton(): void {
  const b = $('btn-estate');
  const hide = !game?.world || !!secret;
  const points = homes ? homes.pointsNow() : loadPoints();
  const n = owned().homes.length;
  const day = homes?.dailyNow() ?? null;
  const shows = `${hide} ${points} ${n} ${day}`;
  if (shows === buttonShows) return;
  buttonShows = shows;
  b.hidden = hide;
  b.classList.toggle('full', points >= HOUSE_POINTS);
  const fill = b.querySelector<SVGElement>('.fill')!;
  fill.setAttribute('stroke-dasharray', `${Math.round((Math.min(points, HOUSE_POINTS) / HOUSE_POINTS) * 100)} 100`);
  // at 0 a round end alone would draw a dot
  fill.style.visibility = points > 0 ? '' : 'hidden';
  // the flats the points buy, and the day's free one once it is there
  const free = n ? flatsFree(points) + (day === 'ready' ? 1 : 0) : 0;
  $('estate-free').hidden = !free;
  $('estate-free').textContent = String(free);
  b.setAttribute('aria-label', `Real estate and trophies: ${points} home ${points === 1 ? 'point' : 'points'}${free ? `, you may buy ${free} ${free === 1 ? 'flat' : 'flats'} now` : ''}`);
}

/**
 * The menu's real estate: the home points that say how many more homes may be bought, and the
 * player's homes by town. A new place is not a new game, so this says what the player owns and where,
 * and leads there: a home in the part of town being played is shown on the big map, and the arrow then
 * points the way.
 */
function drawEstate(): void {
  const mine = owned();
  const towns = homeTowns(mine.homes, mine.reno);
  // what is open at a home, and the rent waiting there
  for (const t of towns) for (const l of t.homes) l.note = homes?.eventNote(l.home) || l.note;
  const n = mine.homes.length;
  const points = homes ? homes.pointsNow() : loadPoints();
  const day = homes?.dailyNow() ?? null;
  const free = flatsFree(points) + (day === 'ready' ? 1 : 0);
  const box = $('estate-points');
  box.classList.toggle('full', points >= HOUSE_POINTS);
  box.innerHTML = ring(points);
  const text = document.createElement('div');
  const big = document.createElement('b');
  big.textContent = `${points} home ${points === 1 ? 'point' : 'points'}`;
  const small = document.createElement('small');
  const houses = !!homes?.housesOpen();
  const house = !houses ? '' : points >= HOUSE_POINTS || day === 'ready' ? ', or a house' : `; a house at ${HOUSE_POINTS} points`;
  small.textContent = n
    ? `${free ? `You may buy ${free} ${free === 1 ? 'flat' : 'flats'} now${house}` : `A flat takes ${FLAT_POINTS}, a house ${HOUSE_POINTS}`}. ${homes?.dailyLine() ?? ''} One point for each delivery, up to ${POINTS_MAX}. A whole building takes ${FLAT_POINTS} for each flat.`
    : `One point for each delivery. Your first home takes none: after two deliveries you'll be shown one.`;
  text.append(big, small);
  box.append(text);
  // rent that waits at a home with something open is not paid each day
  const rent = homes ? homes.rentPaying() : towns.reduce((s, t) => s + t.rent, 0);
  const plate = towns.find((t) => t.plate)?.place ?? 'your home town';
  const who = n === 1 ? 'Your home pays' : `Your ${n} homes${towns.length > 1 ? `, in ${towns.length} towns,` : ''} pay`;
  const bank = mine.saved ? `, and ${fmtMoney(mine.saved)} in the bank in ${plate}` : '';
  $('btn-bank-way').hidden = !playing || !homes?.hasBanks();
  $('homes-line').textContent = n ? `${who} ${rent ? `${fmtMoney(rent)} rent each day you come back` : 'no rent yet'}. You carry ${fmtMoney(game ? game.cash : load().cash)}${bank}.` : 'No homes yet.';
  drawHomes($('homes-list'), towns, {
    party: (h) => (playing && !secret && party?.can(h) ? 'Party' : null),
    throwParty: (h) => {
      setPause(false);
      setScreen('play');
      party?.offer(h);
    },
    here: (h) => !secret && !!homes?.isHere(h),
    show: (h) => {
      setPause(false);
      setScreen('play');
      // the big map, with the home blinking; the arrow points the way once it is closed
      const at = homes?.spotOf(h);
      if (!homes?.showWay(h) || !at) return;
      bigmap.spot = at;
      showMap(true);
    },
    go: (t, h) => {
      setPause(false);
      save();
      setScreen('start');
      void go({ lat: h.lat, lon: h.lon }, isCoords(t.place) ? undefined : t.place);
    },
  });
}
$('btn-estate').addEventListener('click', () => {
  const b = $('btn-estate');
  b.blur();
  // a line showing asked for it: where that line leads (the trophies, for a new one)
  const go = document.body.classList.contains('touch') ? (askedNow()[0]?.tap ?? null) : null;
  asks.length = 0;
  nudgeButton();
  if (go) go();
  else setPause(true, 'estate');
});
/** No story now: a city being guessed, a friend's run from a link, or a friend's party from a link while it is on. */
function storyQuiet(): boolean {
  return !!secret || !!rival || !!linkParty || (!!partyShown && !!game?.party);
}

/** The story's way home: the town of the first home, beside it. */
function goHome(): void {
  setPause(false);
  // the home town's place: the first home's, as the banks go by
  const at = homes?.homeTownAt();
  const place = homes?.homeTownName() ?? '';
  if (!at) return;
  save();
  setScreen('start');
  void go(at, isCoords(place) ? undefined : place);
}

/** The way to the nearest bank: from the bank line in the money box, or from the real estate. */
function bankWay(): void {
  if (!homes || !playing) return;
  if (menuOpen) setPause(false);
  if (mapOpen || welcoming || guessing) return;
  homes.wayToBank();
}
$('saved').addEventListener('click', () => {
  $('saved').blur();
  bankWay();
});
$('saved').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  // the key is the bank line's, not the game's (Space is the handbrake, Enter the action), and focus goes back to the game
  e.preventDefault();
  e.stopPropagation();
  $('saved').blur();
  if (!e.repeat) bankWay();
});
$('btn-bank-way').addEventListener('click', bankWay);
$('btn-homes').addEventListener('click', () => setPause(true, owned().homes.length ? 'estate' : 'trophies'));

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
// a player who owns homes sees so on the start screen
homesButtons();

// a place in the link starts there straight away: coordinates, or a name to look up
const linked = BAKED ? '' : placeFromHash(location.hash);
const fromLink = parseLatLon(linked);
const code = BAKED ? null : new URLSearchParams(location.search).get('c');
const sentRun = code ? readChallenge(code) : null;
if (!BAKED) cameByVideo(new URLSearchParams(location.search));
if (!BAKED) countVisit(new URLSearchParams(location.search));
if (!BAKED) countTime(() => playedS);
if (sentRun) countOpened(sentRun.course.start);
// a friend's party: not counted, as the owner asked (23 November): "we do not reward or count the actual played links yet"
const sentParty = BAKED || sentRun ? null : readParty(new URLSearchParams(location.search).get('p') ?? '');
const sentGuess = BAKED || sentRun || sentParty ? null : readGuess(new URLSearchParams(location.search).get('g') ?? '');
if (sentGuess) countOpened(sentGuess.round.at);
if (sentRun) void go(sentRun.course.start, sentRun.place || undefined, sentRun);
else if (sentParty) {
  linkParty = sentParty;
  void go(sentParty.home, sentParty.place || undefined);
} else if (sentGuess) void drop(sentGuess);
else if (fromLink) void go(fromLink);
else if (linked) {
  $<HTMLInputElement>('q').value = linked;
  void search(linked);
}

// a trial (`?try=radio`): a car radio with stations of the town. Kept a trial on purpose: see radio.ts
wireRadio($<HTMLButtonElement>('btn-radio'), $('radio-bar'), () => (game?.world ? game.world.centre : null), () => playing && !!game?.car, toast, () => !!secret);
// its bar and a building's panel kept clear of the little map and of each other (the panel for everyone)
keepClear($('radio-bar'), $('forsale'), $('minimap'));
