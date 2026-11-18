/**
 * A tester's way to the extras that are not public yet. The game opened with a private key in its
 * address (`?full=<key>`) asks a gate for an add-on and loads it (`addon.ts`). The browser keeps
 * the key, so later visits need no key in the address; `?full=off` forgets it.
 *
 * Without a key nothing here contacts anyone: a player's browser makes no request to the gate.
 * The key is taken out of the address at once, so that it does not travel in a link someone copies.
 * Inside an app nothing happens: an app must not fetch program code.
 */

import { loadAddon } from './addon';

const GATE = 'https://lecaoamodyjubwuvhpcq.supabase.co/functions/v1/addon-key';
const KEPT = '3da-full-key';

/** What to tell the player once the game is up, if anything. */
export interface FullNote {
  text: string;
  kind: 'good' | 'bad';
}

function kept(): string | null {
  try {
    return localStorage.getItem(KEPT);
  } catch {
    return null;
  }
}

function keep(key: string | null): void {
  try {
    if (key) localStorage.setItem(KEPT, key);
    else localStorage.removeItem(KEPT);
  } catch {
    /* no store: the key then works for this visit only */
  }
}

async function ask(): Promise<FullNote | null> {
  if (!/^https?:$/.test(location.protocol)) return null;
  const params = new URLSearchParams(location.search);
  const given = params.get('full');
  let key = kept();
  if (given !== null) {
    params.delete('full');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
    if (given === 'off') {
      keep(null);
      return key ? { text: 'Extras off: the key is forgotten', kind: 'good' } : null;
    }
    if (given.length >= 24) {
      key = given;
      keep(key);
    }
  }
  if (!key) return null;
  try {
    const res = await fetch(GATE, { headers: { 'x-full-key': key }, cache: 'no-store' });
    if (res.status === 401) {
      keep(null);
      return { text: 'Extras: the key was not accepted', kind: 'bad' };
    }
    if (!res.ok) return { text: 'Extras could not be loaded', kind: 'bad' };
    const version = res.headers.get('x-addon-version');
    const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }));
    await loadAddon(url);
    return { text: version ? `Extras on (test version ${version})` : 'Extras on', kind: 'good' };
  } catch {
    return { text: 'Extras could not be loaded', kind: 'bad' };
  }
}

/** Settles when the gate has answered; null when no key is in play. */
export const fullNote: Promise<FullNote | null> = ask();
