import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTiles, tileBounds, tilesForSquare } from '../src/geo/tiles';
import { makeProjector } from '../src/geo/projection';

vi.mock('../src/geo/cache', () => ({ cacheGet: async () => null, cacheSet: async () => {} }));
vi.mock('../src/geo/mapCache', () => ({ BAKED: '', mapFetch: (url: string, init: RequestInit) => fetch(url, init) }));
afterEach(() => vi.unstubAllGlobals());

describe('tiles across the date line', () => {
  it('requests wrapped tile columns while preserving local geometry on both sides', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/planet')) return new Response(JSON.stringify({ tiles: ['https://example.test/{z}/{x}/{y}.pbf'] }));
      urls.push(url);
      return new Response(null, { status: 204 });
    }));
    for (const lon of [-179.999, 179.999]) {
      const center = { lon, lat: 0 };
      const refs = tilesForSquare(center, 1500, 14);
      expect(refs.some((r) => r.x < 0 || r.x >= 2 ** r.z)).toBe(true);
      const loaded = await fetchTiles(refs);
      expect(loaded.map(({ x }) => x)).toEqual(refs.map(({ x }) => x));
      for (const r of loaded) {
        const [west, , east] = tileBounds(r, makeProjector(center));
        expect(west).toBeLessThan(east);
        expect(Math.abs(west)).toBeLessThan(5000);
        expect(Math.abs(east)).toBeLessThan(5000);
      }
    }
    expect(urls.some((url) => url.includes('/14/0/'))).toBe(true);
    expect(urls.some((url) => url.includes('/14/16383/'))).toBe(true);
    expect(urls.every((url) => {
      const x = Number(url.split('/').at(-2));
      return x >= 0 && x < 16384;
    })).toBe(true);
  });
});
