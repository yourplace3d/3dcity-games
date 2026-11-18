/**
 * What the game counts. Each count is a word and a number per day; nothing about the player.
 *
 * Links (`count_link_at`): challenge links made, challenge links opened, and visitors who arrive by
 * the link under a video (`?ref=youtube`). Each says which part of the map the run is in, as a square
 * of one degree, roughly 100 km across. The line under the challenge button and the README say so.
 *
 * Play (`count_play`): a visit, once a day for each browser: "new" the first time, "back" after that,
 * with where it came from in one word (direct, youtube, search, challenge, link); a run of three
 * finished; a home bought (flat, house or building); rent collected on a return. Whether a browser
 * was here before is a date kept in it (`3da-visit-day`); that date is never sent.
 *
 * What is sent is one word ("made", "opened" or "youtube") and that square, for example "53,10".
 * Not the link, not a name, not the street or the town. The tally is a number per day, word and
 * square. Nothing is kept in the player's browser for it, so a link opened twice is counted twice.
 * Like any request, it reaches the server from the sender's internet address, which the tally does
 * not keep. Where the visitor is plays no part: the square is the place on the map being played.
 */

const TALLY = 'https://lecaoamodyjubwuvhpcq.supabase.co/rest/v1/rpc/count_link_at';
const PLAY = 'https://lecaoamodyjubwuvhpcq.supabase.co/rest/v1/rpc/count_play';

/** Tests are not counted: a browser driven by a program, a page from this computer, or a test build. */
const quiet = (): boolean => typeof navigator === 'undefined' || navigator.webdriver || !!import.meta.env.VITE_TESTING || ['localhost', '127.0.0.1'].includes(location.hostname);
// the store's publishable key: meant to be public, it lets a browser add one to the tally and nothing else
const KEY = 'sb_publishable__R5VVIzkFXK-ozBm18IYjg_UTw7guWe';

interface Place {
  lat: number;
  lon: number;
}

/** The one-degree square a place lies in, named by its south-west corner: Hamburg is "53,9". */
export function square(at: Place): string {
  return `${Math.floor(at.lat)},${Math.floor(at.lon)}`;
}

function count(kind: 'made' | 'opened' | 'youtube', at?: Place): void {
  if (quiet()) return;
  // nothing waits for this and nothing depends on it
  void fetch(TALLY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ kind, cell: at ? square(at) : '' }),
    keepalive: true,
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}

/**
 * Links posted in public are opened by machines as well: the checkers of the site they are posted
 * on load the page, run it, and leave. They do not touch it. So an opened link and an arrival are
 * counted only once the visitor has touched, clicked or pressed a key.
 */
const person = new Promise<void>((seen) => {
  const on = (e: Event): void => {
    if (!e.isTrusted) return;
    for (const k of ['pointerdown', 'keydown', 'touchstart']) removeEventListener(k, on, true);
    seen();
  };
  // (outside a browser, as in the tests, nobody touches anything)
  if (typeof addEventListener === 'function') for (const k of ['pointerdown', 'keydown', 'touchstart']) addEventListener(k, on, true);
});

// for as long as the page is open: a second press on the button for the same run is the same link
const made = new Set<string>();

/** A link was made for a run that starts at this place. Once for each different link while the page is open. */
export function countMade(code: string, at: Place): void {
  if (made.has(code)) return;
  made.add(code);
  count('made', at);
}

/** The game was opened by a challenge link for a run that starts at this place. */
export function countOpened(at: Place): void {
  void person.then(() => count('opened', at));
}

let arriving = false;
let played: Place | undefined;

/**
 * The game was opened by the link under a video. It is counted once, when the visitor first
 * touches the page: with the square of the place they are playing, or without one if they have
 * not played anywhere yet.
 */
export function cameByVideo(query: URLSearchParams): void {
  if (query.get('ref') !== 'youtube') return;
  arriving = true;
  void person.then(() => {
    // a moment, so that a place chosen by this very touch is known
    setTimeout(() => {
      arriving = false;
      count('youtube', played);
    }, 4000);
  });
}

/** A place is being loaded to play in: where a visitor from the video link is counted. */
export function playingAt(at: Place): void {
  if (arriving) played = at;
}

// ---------------------------------------------------------------- play

function send(kind: string, detail = ''): void {
  if (quiet()) return;
  // nothing waits for this and nothing depends on it
  void fetch(PLAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ kind, detail }),
    keepalive: true,
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}

/** Where a visit came from, in one word. Nothing more of the address that sent it is kept. */
export function visitSource(query: URLSearchParams, referrer: string, here: string): string {
  if (query.get('ref') === 'youtube') return 'youtube';
  if (query.has('c')) return 'challenge';
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname : '';
  } catch {
    /* not an address */
  }
  if (!host || host === here) return 'direct';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
  if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|ecosia\.org|search\.yahoo\.com|startpage\.com|qwant\.com|search\.brave\.com)$/.test(host)) return 'search';
  return 'link';
}

/** The day on this device, as YYYY-MM-DD. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A visit: counted once a day for each browser, once someone touches the page. "back" where this
 * browser was here on an earlier day (or has a game saved from before visits were counted).
 */
export function countVisit(query: URLSearchParams): void {
  const from = visitSource(query, document.referrer, location.hostname);
  // read as the page opens: the game saves its first state right after, which would look like an earlier visit
  let last: string | null = null;
  let before = false;
  try {
    last = localStorage.getItem('3da-visit-day');
    before = !!last || !!localStorage.getItem('drive-it-3d');
  } catch {
    return; // no store in this browser: not counted
  }
  void person.then(() => {
    try {
      const day = today();
      if (last === day || localStorage.getItem('3da-visit-day') === day) return;
      localStorage.setItem('3da-visit-day', day);
      send(before ? 'back' : 'new', from);
    } catch {
      /* not counted */
    }
  });
}

/**
 * Something in play: a run started (its first package on board) or finished, a home bought, rent
 * collected on a return, a round of Where am I? begun.
 */
export function countPlay(kind: 'start' | 'run' | 'home' | 'rent' | 'guess', detail = ''): void {
  send(kind, detail);
}

/** How long a visit played, as one of four spans: what is sent is the span, not the time. */
export function timeSpan(seconds: number): string {
  return seconds < 60 ? 'under1' : seconds < 300 ? '1to5' : seconds < 1200 ? '5to20' : 'over20';
}

/**
 * The time played in this visit, counted once when the page is first hidden or closed (a later
 * return to the same page is not counted again). `seconds` gives the time spent driving or walking.
 */
export function countTime(seconds: () => number): void {
  let touched = false;
  let sent = false;
  void person.then(() => (touched = true));
  const leave = (): void => {
    if (sent || !touched) return;
    sent = true;
    send('time', timeSpan(seconds()));
  };
  if (typeof addEventListener === 'function') {
    addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && leave());
  }
}
