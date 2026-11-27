/**
 * The game's Discord: a small server for story help, bugs and feedback (the owner's plan, 27 November 2026).
 * Two places invite to it, and nothing more: a small card after one chapter of the story, that can be closed
 * and blocks nothing, and a link on the menu's first tab. Nothing on the first screen.
 *
 * Nothing shows until `INVITE` holds a real invite (an address on discord.gg or discord.com/invite).
 *
 * A click on either is counted (`count_play`, kind "discord"): the detail is the chapter the card follows
 * ("1" to "8") or "menu". Once for each browser and each place, kept in this browser as `3da-discord`; not
 * from a test browser, a page on this computer or a baked build. Nothing about the player is sent, and the
 * invite opens in a new tab that is not told where it came from.
 */

import { countDiscord } from './linkCount';
import { BAKED } from './geo/mapCache';

/** The game's invite link, from the owner (27 November 2026). Empty: no card and no menu link. */
export const INVITE = 'https://discord.gg/7d5KXx856v';
/** The chapter after which the card shows: the owner's choice, 2 (more players) or 3 (the more invested). */
export const CARD_AFTER = 2;

const KEY = '3da-discord';

/** What this browser has done with the invite: whether the card has shown, and the places already counted. */
export interface DiscordSeen {
  card: boolean;
  counted: string[];
}

/** Whether an address is a Discord invite: only those are ever shown. */
export function isInvite(url: string): boolean {
  return /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+\/?$/.test(url);
}

/** Whether the game invites to the Discord at all: a real invite, and not a baked build. */
export function inviting(invite = INVITE, baked = BAKED): boolean {
  return isInvite(invite) && !baked;
}

/** The card is due: the game invites, the chapter it follows is done, and this browser has not had it. */
export function cardDue(done: (n: number) => boolean, seen: DiscordSeen, invite = INVITE, after = CARD_AFTER): boolean {
  return inviting(invite) && done(after) && !seen.card;
}

/** A click on the invite from `where`: what is kept after it, and whether it is counted (once a place). */
export function click(seen: DiscordSeen, where: string): { seen: DiscordSeen; count: boolean } {
  if (seen.counted.includes(where)) return { seen, count: false };
  return { seen: { ...seen, counted: [...seen.counted, where] }, count: true };
}

export function loadSeen(): DiscordSeen {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DiscordSeen>;
    return { card: !!s.card, counted: Array.isArray(s.counted) ? s.counted.filter((x) => typeof x === 'string') : [] };
  } catch {
    return { card: false, counted: [] };
  }
}

function storeSeen(s: DiscordSeen): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false; // no store in this browser
  }
}

/** A link to the invite, in a new tab; a click on it is counted under `where`. */
export function inviteLink(where: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = INVITE;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = text;
  a.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const r = click(loadSeen(), where);
    if (!r.count) return;
    // kept before it is sent: a browser with no store is not counted, as it could be counted again
    if (storeSeen(r.seen)) countDiscord(where);
  });
  return a;
}

/** The card after a chapter: what it says, the link, and a way to close it. `close` takes it off the screen. */
export function inviteCard(close: () => void): HTMLElement {
  storeSeen({ ...loadSeen(), card: true });
  const el = document.createElement('div');
  el.className = 'msg discord';
  el.dataset.who = 'game';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Discord');
  const from = document.createElement('small');
  from.className = 'from';
  from.textContent = '3DA on Discord';
  const text = document.createElement('span');
  text.className = 'text';
  text.textContent = 'Stuck on a chapter, or found a bug? A small Discord for story help and what you would change.';
  const row = document.createElement('span');
  row.className = 'row';
  const a = inviteLink(String(CARD_AFTER), 'Join the Discord');
  a.addEventListener('click', close);
  const no = document.createElement('button');
  no.type = 'button';
  no.textContent = 'Not now';
  no.addEventListener('click', close);
  row.append(a, no);
  el.append(from, text, row);
  return el;
}

/** The line on the menu's first tab: shown only when the game invites. */
export function menuLine(box: HTMLElement): void {
  if (!inviting()) return;
  box.replaceChildren('Story help, bugs, ideas: ', inviteLink('menu', '3DA on Discord'), ' (opens in a new tab).');
  box.hidden = false;
}
