/**
 * The game's languages (the owner, 28 November 2026: German first, more to follow).
 *
 * Every text a player reads comes from one table per language: `lang/en.ts` is the English, and each other
 * language is a table of the same shape (`lang/de.ts`), so a text missing in German fails the type check.
 * A text with numbers or names in it is a small function, so each language builds its own sentence.
 *
 * Which language: the one picked in the game (kept as `3da-lang`), else the browser's (German for any
 * `de-…`), else English. Tests always run in English, whatever the machine's language.
 * The page's own texts in `index.html` carry `data-t` (text), `data-th` (text with markup) or `data-ta`
 * ("attribute:key;…") and are filled in by `applyPage()` before anything else runs.
 */

import { en, type Texts } from './lang/en';
import { de } from './lang/de';

export type Lang = 'en' | 'de';
/** each language by its own name, for the switch */
export const LANGS: Record<Lang, string> = { en: 'English', de: 'Deutsch' };
const TABLES: Record<Lang, Texts> = { en, de };
const KEPT = '3da-lang';

function isLang(l: unknown): l is Lang {
  return typeof l === 'string' && l in TABLES;
}

/** The language picked in the game, if one was. */
export function picked(): Lang | null {
  try {
    const l = localStorage.getItem(KEPT);
    return isLang(l) ? l : null;
  } catch {
    return null;
  }
}

/** The browser's first language the game has, if any. */
export function browserLang(list: readonly string[] | undefined): Lang | null {
  for (const tag of list ?? []) {
    const l = tag.toLowerCase().split('-')[0];
    if (isLang(l)) return l;
  }
  return null;
}

function detect(): Lang {
  if (import.meta.env?.MODE === 'test') return 'en';
  const nav = typeof navigator === 'undefined' ? undefined : navigator.languages?.length ? navigator.languages : [navigator.language];
  return picked() ?? browserLang(nav) ?? 'en';
}

/** the language the game speaks now */
export const lang: Lang = detect();
/** the texts in that language */
export const T: Texts = TABLES[lang];

/** Keeps a language and starts the game again in it. */
export function setLang(l: Lang): void {
  try {
    localStorage.setItem(KEPT, l);
  } catch {
    /* private window: the change lasts for this visit only */
  }
  location.reload();
}

/** A text of the table by its key, for the page's own texts. */
function look(key: string): string | null {
  const v = (T as unknown as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : null;
}

/** Fills in the texts of `index.html` (and any part of the page added with the same marks). */
export function applyPage(root: ParentNode = document): void {
  if (root === document) {
    document.documentElement.lang = lang;
    document.title = T.pageTitle;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-t]')) {
    const s = look(el.dataset.t!);
    if (s !== null) el.textContent = s;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-th]')) {
    const s = look(el.dataset.th!);
    if (s !== null) el.innerHTML = s;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-ta]')) {
    for (const pair of el.dataset.ta!.split(';')) {
      const [attr, key] = pair.split(':');
      const s = key ? look(key.trim()) : null;
      if (attr && s !== null) el.setAttribute(attr.trim(), s);
    }
  }
}

/** Money as the language writes it: "$1,250" or "1.250 $". */
export function money(n: number): string {
  const v = Math.round(n);
  return lang === 'de' ? `${v.toLocaleString('de-DE')} $` : `$${v.toLocaleString('en-US')}`;
}

/** A whole number with the language's grouping. */
export function num(n: number): string {
  return Math.round(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
}

/** A distance: "350 m", "1.2 km" (German "1,2 km"). */
export function metres(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  const km = (m / 1000).toFixed(1);
  return `${lang === 'de' ? km.replace('.', ',') : km} km`;
}
