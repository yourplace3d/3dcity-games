/**
 * Saving a game on a server, for a player who has entered a name. Without one the game plays
 * exactly as before and none of this contacts anyone.
 *
 * There is no account, no email and no password. When a player turns saving on, the browser makes
 * a long random save code and keeps it. The saved game on the server belongs to whoever holds
 * that code (the server keeps only a fingerprint of it). A link with the code in it carries the
 * game to another device; anyone given that link has the game, so it is for the player alone.
 *
 * What is saved is what the game already keeps in this browser: cash, deliveries, the scoreboard,
 * settings, and what add-ons keep.
 */

const API = 'https://lecaoamodyjubwuvhpcq.supabase.co/rest/v1/rpc/';
// the store's publishable key: meant to be public; what it allows is only the functions called here
const KEY = 'sb_publishable__R5VVIzkFXK-ozBm18IYjg_UTw7guWe';

const CODE = '3da-save-code';
const NAME = '3da-save-name';
const STAMP = '3da-save-at';
/** Set while this browser has changes the server has not confirmed. */
const DIRTY = '3da-save-dirty';
/** Never sent: the save code itself, when it was last sent, and a tester's private key. */
const PRIVATE = new Set([CODE, STAMP, DIRTY, '3da-full-key']);
/** the most a saved game may hold (characters); the server takes up to 150,000 */
const LIMIT = 120000;

const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null): void => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* no store: saving cannot be turned on in this window */
  }
};

async function call<T>(fn: string, args: Record<string, unknown>, leaving = false, wait = 12000): Promise<T> {
  const res = await fetch(API + fn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(args),
    keepalive: leaving,
    ...(leaving ? {} : { signal: AbortSignal.timeout(wait) }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message ?? `error ${res.status}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** The name the player saves under, or '' when saving is off. */
export const savedName = (): string => (get(CODE) ? (get(NAME) ?? '') : '');
export const savingOn = (): boolean => !!get(CODE) && !!get(NAME);

/** A name as the server takes it: 1 to 16 characters. */
export const cleanName = (s: string): string => s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  let s = '';
  for (const b of bytes) s += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62];
  return s;
}

/** Everything the game keeps in this browser, apart from what must stay here. */
function gather(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if ((k.startsWith('3da-') || k === 'drive-it-3d') && !PRIVATE.has(k)) out[k] = localStorage.getItem(k) ?? '';
    }
  } catch {
    /* nothing to gather */
  }
  return out;
}

/** Whether the game here is small enough to save online. */
export const fitsOnline = (): boolean => JSON.stringify(gather()).length <= LIMIT;

// What was last sent, or found here at the start of the visit: an unchanged game is never sent again.
let last = get(CODE) && !get(DIRTY) ? JSON.stringify(gather()) : '';
let uploading: Promise<boolean> | null = null;
let stopping = false;

/** Send the game as it is now. Does nothing when saving is off or nothing changed. */
export async function push(leaving = false): Promise<boolean> {
  if (stopping) return false;
  // A slow older request must never overwrite a newer snapshot on the server.
  if (uploading) {
    await uploading;
    return push(leaving);
  }
  const sent = send(leaving);
  uploading = sent;
  try {
    return await sent;
  } finally {
    uploading = null;
  }
}

async function send(leaving: boolean): Promise<boolean> {
  const code = get(CODE);
  const name = get(NAME);
  if (!code || !name) return false;
  const data = gather();
  const text = JSON.stringify(data);
  if (text === last) return true;
  set(DIRTY, '1');
  if (text.length > LIMIT) return false;
  try {
    const at = await call<string>('save_put', { code, name, data }, leaving);
    // on a page that is going away the answer may never be read: the mark then stays for the next visit
    last = text;
    if (at) set(STAMP, at);
    set(DIRTY, JSON.stringify(gather()) === text ? null : '1');
    return true;
  } catch {
    return false;
  }
}

let timer = 0;
/** The game changed: send it soon. Cheap to call often. */
export function changed(): void {
  if (!savingOn()) return;
  if (JSON.stringify(gather()) === last) return;
  set(DIRTY, '1');
  if (stopping) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => void push(), 5000);
}

/** Turn saving on under this name. Resolves to whether the first save went through. */
export async function startSaving(name: string): Promise<boolean> {
  if (stopping) return false;
  const clean = cleanName(name);
  if (!clean) return false;
  if (!get(CODE)) set(CODE, newCode());
  set(NAME, clean);
  if (!get(CODE)) return false;
  last = '';
  return push();
}

interface Saved {
  name: string;
  data: Record<string, string>;
  updated_at: string;
}

const fetchSave = (code: string, wait?: number): Promise<Saved | null> => call<Saved | null>('save_get', { code }, false, wait);

/** Whether a saved game holds exactly what this browser has. */
const sameAsHere = (got: Saved): boolean => {
  const here = gather();
  const there = Object.fromEntries(Object.entries(got.data ?? {}).filter(([k]) => !PRIVATE.has(k)));
  const keys = new Set([...Object.keys(here), ...Object.keys(there)]);
  keys.delete(NAME);
  return [...keys].every((k) => here[k] === there[k]);
};

/** Put a saved game in place of this browser's, restoring it if the new copy does not fit. */
function apply(got: Saved, code: string): boolean {
  const ours = (k: string): boolean => (k.startsWith('3da-') || k === 'drive-it-3d') && k !== '3da-full-key';
  const before: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (ours(k)) before[k] = localStorage.getItem(k)!;
    }
  } catch {
    return false;
  }
  const replace = (data: Record<string, string>): void => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)!;
      if (ours(k)) localStorage.removeItem(k);
    }
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  };
  const incoming = Object.fromEntries(Object.entries(got.data ?? {}).filter(([k, v]) => ours(k) && !PRIVATE.has(k) && typeof v === 'string'));
  try {
    replace({ ...incoming, [CODE]: code, [NAME]: got.name, [STAMP]: got.updated_at });
  } catch {
    try {
      replace(before);
    } catch {
      /* Storage may have become unavailable altogether. Never report a completed import. */
    }
    return false;
  }
  last = JSON.stringify(gather());
  return true;
}

/** Whether this browser holds a game of its own that a saved one would replace. */
function hasGame(): boolean {
  return get('drive-it-3d') !== null || get('3da-scores') !== null || get(CODE) !== null;
}

/** The link that carries this game to another device. It is the key to the save: for the player alone. */
export function deviceLink(home: string): string {
  return `${home}?save=${get(CODE) ?? ''}`;
}

/** Stop saving and take the saved game off the server. */
export async function stopSaving(): Promise<boolean> {
  if (stopping) return false;
  const code = get(CODE);
  if (!code) return true;
  stopping = true;
  clearTimeout(timer);
  try {
    // Otherwise an upload still in flight can recreate the just-deleted save.
    if (uploading) await uploading;
    await call('save_delete', { code });
    set(CODE, null);
    set(NAME, null);
    set(STAMP, null);
    set(DIRTY, null);
    last = '';
    return true;
  } catch {
    return false;
  } finally {
    stopping = false;
    // A failed delete leaves saving enabled, including changes made while it was pending.
    if (savingOn()) changed();
  }
}

/**
 * At the start of a visit. A link from another device (`?save=<code>`) brings its game here, after
 * asking when this browser has a game of its own. A browser that saves first sends what the server
 * has not confirmed, and otherwise checks whether another device has played since. Resolves to
 * 'reload' when the game in this browser was replaced and the page should start again.
 */
export async function arrive(ask: (name: string) => boolean): Promise<'reload' | 'ok'> {
  const q = new URLSearchParams(location.search);
  const given = q.get('save');
  if (given !== null) {
    // out of the address at once, so that it does not travel in a link someone copies
    q.delete('save');
    const rest = q.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
    if (/^[A-Za-z0-9]{32,64}$/.test(given) && given !== get(CODE)) {
      try {
        const got = await fetchSave(given);
        if (got && (!hasGame() || ask(got.name))) {
          return apply(got, given) ? 'reload' : 'ok';
        }
      } catch {
        /* the game here stays as it is */
      }
    }
    return 'ok';
  }
  const code = get(CODE);
  if (!code || !get(NAME)) return 'ok';
  const dirty = !!get(DIRTY);
  try {
    // the game must not wait long for this: an invited player's run starts at once
    const got = await fetchSave(code, 2500);
    if (got && got.updated_at !== get(STAMP)) {
      if (sameAsHere(got)) {
        // the copy sent while leaving did arrive: only its time was never read
        set(STAMP, got.updated_at);
        set(DIRTY, null);
        last = JSON.stringify(gather());
        return 'ok';
      }
      if (Date.parse(got.updated_at) > Date.parse(get(STAMP) ?? '1970-01-01')) {
        // another device has played since: its game is the newer one and is taken, also over
        // changes here that were sent while leaving and that it was built on
        return apply(got, code) ? 'reload' : 'ok';
      }
    }
    // nobody else has written: what was played here and not yet confirmed is sent now
    if (dirty) {
      last = '';
      void push();
    }
  } catch {
    /* offline: play on with what is here; the mark stays and the game is sent later */
  }
  return 'ok';
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void push(true);
  });
}
