import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

function memoryIndexedDB() {
  const values = new Map<string, unknown>();
  const request = (result: unknown) => {
    const r = { result, onsuccess: null as (() => void) | null };
    queueMicrotask(() => r.onsuccess?.());
    return r;
  };
  const store = {
    get: (key: string) => request(values.get(key)),
    put: (value: unknown, key: string) => { values.set(key, value); return request(key); },
    clear: () => { values.clear(); return request(undefined); },
  };
  return { open: () => request({ transaction: () => ({ objectStore: () => store }) }) };
}

describe('map tile cache failures', () => {
  it('uses IndexedDB when Cache Storage exists but is refused, and clears that fallback', async () => {
    vi.stubGlobal('caches', { open: vi.fn().mockRejectedValue(new Error('Storage denied')), delete: vi.fn() });
    vi.stubGlobal('indexedDB', memoryIndexedDB());
    const network = vi.fn(async () => new Response('tile', { headers: { 'content-type': 'application/octet-stream' } }));
    vi.stubGlobal('fetch', network);
    const { mapFetch, clearMapCache } = await import('../src/geo/mapCache');
    expect(await (await mapFetch('https://example.test/tile')).text()).toBe('tile');
    expect(await (await mapFetch('https://example.test/tile')).text()).toBe('tile');
    expect(network).toHaveBeenCalledTimes(1);
    await clearMapCache();
    await mapFetch('https://example.test/tile');
    expect(network).toHaveBeenCalledTimes(2);
  });

  it('continues loading from the network when IndexedDB opening is blocked', async () => {
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('indexedDB', { open: () => {
      const r = { onblocked: null as (() => void) | null };
      queueMicrotask(() => r.onblocked?.());
      return r;
    } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('tile')));
    const { mapFetch } = await import('../src/geo/mapCache');
    const result = await Promise.race([
      mapFetch('https://example.test/tile').then((r) => r.text()),
      new Promise((resolve) => setTimeout(() => resolve('stuck opening storage'), 100)),
    ]);
    expect(result).toBe('tile');
  });

  it('rejects an already cancelled request even if its tile is cached', async () => {
    vi.stubGlobal('caches', { open: async () => ({ match: async () => new Response('tile') }) });
    const { mapFetch } = await import('../src/geo/mapCache');
    await expect(mapFetch('https://example.test/tile', { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects cancellation while looking up a cached tile', async () => {
    const controller = new AbortController();
    vi.stubGlobal('caches', { open: async () => ({ match: async () => {
      controller.abort();
      return new Response('tile');
    } }) });
    const { mapFetch } = await import('../src/geo/mapCache');
    await expect(mapFetch('https://example.test/tile', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
