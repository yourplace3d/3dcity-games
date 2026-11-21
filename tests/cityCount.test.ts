import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sql from '../docs/supabase/play_counts.sql?raw';
import { cityOf } from '../src/linkCount';
import { CITY_LIST } from '../src/places';

/** The cities the database knows by name: the list inside `count_play` in docs/supabase/play_counts.sql. */
function cityNamesInSql(): string[] {
  const list = /array\[([^\]]*)\]/.exec(sql)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('the city a place is counted under', () => {
  it('is the well-known city the place lies in or beside', () => {
    expect(cityOf({ lat: 53.5511, lon: 9.9937 })).toBe('Hamburg');
    expect(cityOf({ lat: 52.45, lon: 13.3 })).toBe('Berlin'); // Dahlem, about 10 km from the centre
    expect(cityOf({ lat: 40.7, lon: -74.0 })).toBe('New York'); // the south end of Manhattan
    expect(cityOf({ lat: -23.55, lon: -46.63 })).toBe('São Paulo');
  });
  it('is the one-degree square anywhere else', () => {
    expect(cityOf({ lat: 49.2, lon: 10.1 })).toBe('49,10'); // the countryside west of Nuremberg
    expect(cityOf({ lat: 52.4, lon: 13.06 })).toBe('52,13'); // Potsdam is not Berlin
    expect(cityOf({ lat: -0.3, lon: -0.2 })).toBe('-1,-1');
  });
  it('is a name the database knows, for every city the game can name', () => {
    // a city added to places.ts but not to the function would be counted as "other" until it is
    expect(cityNamesInSql().sort()).toEqual(CITY_LIST.map((c) => c.name).sort());
  });
});

describe('counting a city', () => {
  let touch: ((e: { isTrusted: boolean }) => void) | undefined;
  let sent: Array<{ url: string; body: unknown }>;

  beforeEach(() => {
    vi.resetModules();
    sent = [];
    touch = undefined;
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('location', { hostname: 'yourplace3d.github.io' });
    vi.stubGlobal('addEventListener', (kind: string, fn: (e: { isTrusted: boolean }) => void) => {
      if (kind === 'pointerdown') touch = fn;
    });
    vi.stubGlobal('removeEventListener', () => undefined);
    vi.stubGlobal('fetch', vi.fn((url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return Promise.resolve(new Response(''));
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('sends the city or its square once for each city, and only after the page is touched', async () => {
    const { countCity } = await import('../src/linkCount');
    countCity({ lat: 53.55, lon: 9.99 }); // Hamburg, before anyone has touched the page
    await tick();
    expect(sent).toEqual([]);
    touch!({ isTrusted: true });
    await tick();
    countCity({ lat: 53.56, lon: 10.0 }); // Hamburg again: the same visit
    countCity({ lat: 49.2, lon: 10.1 }); // the countryside
    countCity({ lat: 52.52, lon: 13.4 }); // Berlin
    await tick();
    expect(sent.map((s) => s.body)).toEqual([
      { kind: 'city', detail: 'Hamburg' },
      { kind: 'city', detail: '49,10' },
      { kind: 'city', detail: 'Berlin' },
    ]);
    expect(sent.every((s) => s.url.endsWith('/rpc/count_play'))).toBe(true);
  });

  it('is not sent from a test browser', async () => {
    vi.stubGlobal('navigator', { webdriver: true });
    const { countCity } = await import('../src/linkCount');
    touch!({ isTrusted: true });
    countCity({ lat: 53.55, lon: 9.99 });
    await tick();
    expect(sent).toEqual([]);
  });
});
