import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { browserLang, lang, T } from '../src/i18n';
import { en } from '../src/lang/en';
import { de } from '../src/lang/de';

describe('languages', () => {
  it('runs the tests in English', () => {
    expect(lang).toBe('en');
    expect(T).toBe(en);
  });

  it('takes the browser’s first language the game has', () => {
    expect(browserLang(['de-DE', 'en'])).toBe('de');
    expect(browserLang(['fr-FR', 'de-AT'])).toBe('de');
    expect(browserLang(['fr-FR'])).toBeNull();
    expect(browserLang(undefined)).toBeNull();
  });

  it('has every English text in German, of the same kind', () => {
    for (const k of Object.keys(en) as Array<keyof typeof en>) {
      expect(typeof de[k], k).toBe(typeof en[k]);
      if (typeof en[k] === 'string') expect((de[k] as string).length, k).toBeGreaterThan(0);
    }
  });

  it('keeps the marks of a text with markup', () => {
    const marks = (s: string) => (s.match(/<\/?[a-z]+/g) ?? []).sort().join(' ');
    for (const k of Object.keys(en) as Array<keyof typeof en>) {
      const e = en[k];
      if (typeof e === 'string') expect(marks(de[k] as string), k).toBe(marks(e));
    }
  });

  it('knows every text the page asks for', () => {
    const keys = [...html.matchAll(/data-th?="([^"]+)"/g)].map((m) => m[1]);
    for (const m of html.matchAll(/data-ta="([^"]+)"/g)) for (const pair of m[1].split(';')) keys.push(pair.split(':')[1]);
    expect(keys.length).toBeGreaterThan(80);
    for (const k of keys) expect(typeof (en as Record<string, unknown>)[k], k).toBe('string');
  });
});
