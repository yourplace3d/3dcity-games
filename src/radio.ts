/**
 * A car radio that plays real stations of the town you drive in. A trial: switched on with
 * `?try=radio` in the address and remembered by the browser until `?try=noradio`. Without it
 * there is no button, and nothing here contacts anyone.
 *
 * Which stations there are comes from Radio Browser (radio-browser.info), a directory kept by
 * volunteers: the game asks it for stations near the place, the most listened to first. What is
 * heard comes straight from each station's own public stream, unchanged; the game keeps and
 * passes on nothing. Pressing the button therefore contacts the directory and then the station.
 *
 * It is a car radio: it is heard while you sit in a car and falls silent when you get out.
 * Switched on, it stays on: it plays again in the next car, and on the next visit.
 *
 * Only streams at a secure address can play on this page, and a station that does not start
 * within a few seconds is skipped.
 */

const KEPT = '3da-radio';
/** whether the radio was left switched on: it then plays again in the next car, on the next visit too */
const LEFT_ON = '3da-radio-on';
/**
 * A moment of silence. A browser, the iPad's above all, lets a page start sound only in answer to
 * a tap or a key. The stations start later than that: after the list has arrived, or when you get
 * into a car. Playing this at the tap makes the player one the browser lets start by itself.
 */
const SILENCE =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
/** the directory's servers, tried in turn */
const SERVERS = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
const NEAR_M = 60_000;
const FAR_M = 300_000;
const START_WITHIN_MS = 9000;

interface Station {
  id: string;
  name: string;
  url: string;
}

/** Whether the trial is on in this browser. Reads the address once and remembers. */
export function radioOn(): boolean {
  try {
    const tries = (new URLSearchParams(location.search).get('try') ?? '').split(',');
    if (tries.includes('radio')) localStorage.setItem(KEPT, '1');
    if (tries.includes('noradio')) localStorage.removeItem(KEPT);
    return localStorage.getItem(KEPT) === '1';
  } catch {
    return false;
  }
}

async function ask(path: string): Promise<unknown> {
  let last: unknown = null;
  for (const server of SERVERS) {
    try {
      const res = await fetch(server + path, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.json();
      last = new Error(`the directory answered ${res.status}`);
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

/** Stations around a place that can play here, the most listened to first. */
async function stationsNear(lat: number, lon: number): Promise<Station[]> {
  const probe = document.createElement('audio');
  const hls = probe.canPlayType('application/vnd.apple.mpegurl') !== '';
  for (const reach of [NEAR_M, FAR_M]) {
    const list = (await ask(
      `/json/stations/search?geo_lat=${lat.toFixed(3)}&geo_long=${lon.toFixed(3)}&geo_distance=${reach}&hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=40`,
    )) as Array<Record<string, unknown>>;
    const seen = new Set<string>();
    const out: Station[] = [];
    for (const s of Array.isArray(list) ? list : []) {
      const url = String(s.url_resolved ?? '');
      const name = String(s.name ?? '').trim();
      if (!url.startsWith('https://') || !name || seen.has(name.toLowerCase())) continue;
      // a playlist stream plays only where the browser can read it by itself
      if (Number(s.hls) === 1 && !hls) continue;
      seen.add(name.toLowerCase());
      out.push({ id: String(s.stationuuid ?? ''), name: name.slice(0, 40), url });
    }
    if (out.length >= 3 || reach === FAR_M) return out;
  }
  return [];
}

/**
 * Put the radio's button and its bar to work. `place` gives where the player is on the earth
 * (null before a town is loaded); `inCar` says whether the player sits in a car right now: the
 * radio is a car radio and is heard nowhere else; `say` shows a short message.
 */
export function wireRadio(
  button: HTMLButtonElement,
  bar: HTMLElement,
  place: () => { lat: number; lon: number } | null,
  inCar: () => boolean,
  say: (text: string, kind?: 'good' | 'bad' | 'info') => void,
  /** true while the town is to be guessed: a station's name would give it away */
  secret: () => boolean = () => false,
): void {
  if (!radioOn()) return;
  button.hidden = false;
  const audio = new Audio();
  audio.preload = 'none';
  let stations: Station[] = [];
  let at = 0;
  let on = false;
  let askedFor: { lat: number; lon: number } | null = null;
  let giveUp = 0;
  let failed = 0;
  // A station lookup may outlive a switch off/on or a move to another town.
  let tuning = 0;
  /** on, but silent because you are not in a car */
  let waiting = false;
  const nameEl = bar.querySelector<HTMLElement>('.name')!;
  const nextEl = bar.querySelector<HTMLButtonElement>('.next')!;

  let primed = false;
  /** Called in answer to a tap or a key: from then on the browser lets the radio start by itself. */
  const prime = (): void => {
    if (primed) return;
    primed = true;
    audio.src = SILENCE;
    // refused (it was no tap after all): try again at the next one. Cut short by a station starting: fine.
    void audio.play().catch((err: unknown) => {
      if ((err as { name?: string })?.name === 'NotAllowedError') primed = false;
    });
  };
  const keep = (v: boolean): void => {
    try {
      if (v) localStorage.setItem(LEFT_ON, '1');
      else localStorage.removeItem(LEFT_ON);
    } catch {
      /* not remembered in a private window */
    }
  };

  const show = (text: string): void => {
    nameEl.textContent = text;
    bar.hidden = !on;
    button.classList.toggle('on', on);
    document.body.classList.toggle('radio-on', on);
  };

  function off(): void {
    tuning++;
    on = false;
    waiting = false;
    clearTimeout(giveUp);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    show('');
  }

  function wait(): void {
    waiting = true;
    clearTimeout(giveUp);
    audio.pause();
    if (!inCar()) show('The radio plays in a car');
  }

  function play(): void {
    clearTimeout(giveUp);
    if (!on) return;
    if (document.hidden || !inCar()) {
      wait();
      return;
    }
    waiting = false;
    if (!stations.length) {
      show('No station plays here');
      return;
    }
    const s = stations[at % stations.length];
    show(label());
    audio.src = s.url;
    void audio.play().catch(() => undefined);
    // a station that stays silent is skipped
    giveUp = window.setTimeout(skip, START_WITHIN_MS);
    // the directory asks to be told which stations are listened to
    if (s.id) void ask(`/json/url/${s.id}`).catch(() => undefined);
  }

  /** the station playing, by name, or only by number while the town is to be guessed */
  function label(): string {
    const s = stations[at % stations.length];
    return `${secret() ? 'Local radio' : s.name} · ${(at % stations.length) + 1} of ${stations.length}`;
  }

  function skip(): void {
    if (!on) return;
    if (document.hidden || !inCar()) {
      wait();
      return;
    }
    failed++;
    if (failed >= stations.length) {
      show('No station plays here');
      return;
    }
    at++;
    play();
  }

  audio.addEventListener('playing', () => {
    if (audio.currentSrc.startsWith('data:')) return;
    if (!on || document.hidden || !inCar()) {
      audio.pause();
      return;
    }
    clearTimeout(giveUp);
    failed = 0;
  });
  // the moment of silence is no station: nothing to skip when it ends or fails
  audio.addEventListener('error', () => on && !audio.currentSrc.startsWith('data:') && skip());

  async function turnOn(): Promise<void> {
    const p = place();
    if (!p) return;
    const request = ++tuning;
    on = true;
    if (document.hidden || !inCar()) {
      // switched on, and heard as soon as you sit in a car
      wait();
      return;
    }
    waiting = false;
    // a new town, new stations: asked again when you have come 30 km
    const far = !askedFor || Math.hypot(askedFor.lat - p.lat, (askedFor.lon - p.lon) * Math.cos((p.lat * Math.PI) / 180)) * 111 > 30;
    if (far) {
      show('Looking for stations…');
      try {
        const found = await stationsNear(p.lat, p.lon);
        if (request !== tuning || !on) return;
        stations = found;
        askedFor = p;
        at = 0;
      } catch {
        if (request !== tuning || !on) return;
        stations = [];
        on = false;
        show('');
        say('The radio could not reach the station list', 'bad');
        return;
      }
      if (!on) return;
    }
    failed = 0;
    play();
  }

  button.addEventListener('click', () => {
    button.blur();
    if (on) {
      off();
      keep(false);
    } else {
      prime();
      keep(true);
      void turnOn();
    }
  });
  // left on last time: on again, silent until you sit in a car. The first tap or key of the visit,
  // whatever it is for, is what lets it start then.
  let leftOn = false;
  try {
    leftOn = localStorage.getItem(LEFT_ON) === '1';
  } catch {
    /* off */
  }
  if (leftOn) {
    on = true;
    waiting = true;
    show('The radio plays in a car');
    const first = (): void => {
      removeEventListener('pointerdown', first, true);
      removeEventListener('keydown', first, true);
      if (on) prime();
    };
    addEventListener('pointerdown', first, true);
    addEventListener('keydown', first, true);
  }
  nextEl.addEventListener('click', () => {
    if (!on || waiting || !stations.length) return;
    failed = 0;
    at++;
    play();
  });
  // a car radio: it stops when you get out, and comes back when you get into a car again, with
  // the stations of the town you are in by then
  setInterval(() => {
    if (!on) return;
    // the name comes back once the town has been guessed
    if (!waiting && stations.length && nameEl.textContent?.includes(' of ')) {
      const text = label();
      if (nameEl.textContent !== text) nameEl.textContent = text;
    }
    const sitting = inCar() && !document.hidden;
    if (!sitting && !waiting) {
      wait();
    } else if (sitting && waiting) {
      void turnOn();
    }
  }, 400);
  // silent while the game is out of sight
  document.addEventListener('visibilitychange', () => {
    if (!on) return;
    if (document.hidden) wait();
    else void turnOn();
  });
}
