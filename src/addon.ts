/**
 * The place where extra features plug into the game. The free game is whole without any; an
 * add-on is a separate file that the game loads when it is given its address, and that then adds
 * to the running game through the few openings `Game` offers (`actions`, `hints`, `ticks`, `held`,
 * `place`, `remove`, `seat`, `ring`), those of `World` (`buildings`, `mark`) and through what the
 * game already shows of itself.
 *
 * Who is given an address is decided elsewhere: the game only loads what it is handed. On its own
 * it loads nothing, except on the developer's machine, where `?addon=<address>` names one to try.
 */

import type { Game } from './game/game';

/** What an add-on is handed when it is installed. */
export interface AddonHost {
  /** the running game */
  game: Game;
  /** a short message at the top of the screen */
  toast: (text: string, kind?: 'good' | 'bad' | 'info') => void;
  /** grows when what is offered here changes in a way an add-on has to know about */
  api: 2;
}

/** An add-on file's default export. */
export type AddonInstall = (host: AddonHost) => void | Promise<void>;

let host: AddonHost | null = null;
const wanted: string[] = [];
const loaded = new Set<string>();

async function install(url: string): Promise<void> {
  if (!host || loaded.has(url)) return;
  loaded.add(url);
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { default?: AddonInstall };
    if (typeof mod.default !== 'function') throw new Error('an add-on must export a function as its default');
    await mod.default(host);
  } catch (err) {
    // the game goes on without it
    loaded.delete(url);
    console.warn('add-on not loaded', url, err);
    throw err;
  }
}

/**
 * Load an add-on from an address and let it install itself. Safe to call before a city is loaded
 * (it waits for the game) and more than once with the same address (the second call does nothing).
 */
export async function loadAddon(url: string): Promise<void> {
  if (!host) {
    if (!wanted.includes(url)) wanted.push(url);
    return;
  }
  await install(url);
}

/** The game exists now: install what was asked for while there was none. */
export function addonHost(h: AddonHost): void {
  host = h;
  for (const url of wanted.splice(0)) void install(url).catch(() => undefined);
}

(window as unknown as { loadAddon: typeof loadAddon }).loadAddon = loadAddon;

// on the developer's own machine only: an add-on to try, named in the link. Inside an app the page
// is at `localhost` too, under an address of the app's own (not http): there the link names nothing.
if (['http:', 'https:'].includes(location.protocol) && ['localhost', '127.0.0.1'].includes(location.hostname)) {
  const url = new URLSearchParams(location.search).get('addon');
  if (url) void loadAddon(new URL(url, location.href).href);
}
