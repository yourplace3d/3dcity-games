import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CODE = 'a'.repeat(40);
const AT = '2026-11-16T12:00:00.000Z';
let data: Map<string, string>;

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 });
}

beforeEach(() => {
  vi.resetModules();
  data = new Map([
    ['3da-save-code', CODE], ['3da-save-name', 'Player'], ['3da-save-at', AT],
    ['drive-it-3d', JSON.stringify({ cash: 10 })],
  ]);
  vi.stubGlobal('localStorage', {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal('window', { setTimeout });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('online saving', () => {
  it('keeps a change made during an upload marked as unsaved', async () => {
    let finish!: (res: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const cloud = await import('../src/cloud');
    data.set('drive-it-3d', JSON.stringify({ cash: 20 }));
    const sent = cloud.push();
    data.set('drive-it-3d', JSON.stringify({ cash: 30 }));
    finish(response('2026-11-17T10:00:00.000Z'));
    expect(await sent).toBe(true);
    expect(data.get('3da-save-dirty')).toBe('1');
  });

  it('sends consecutive snapshots in order, including a change while the first upload runs', async () => {
    let firstDone!: (res: Response) => void;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { firstDone = resolve; }))
      .mockResolvedValue(response('2026-11-17T10:00:01.000Z'));
    vi.stubGlobal('fetch', fetch);
    const cloud = await import('../src/cloud');
    data.set('drive-it-3d', JSON.stringify({ cash: 20 }));
    const first = cloud.push();
    data.set('drive-it-3d', JSON.stringify({ cash: 30 }));
    const second = cloud.push();
    expect(fetch).toHaveBeenCalledTimes(1);
    firstDone(response('2026-11-17T10:00:00.000Z'));
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body).data['drive-it-3d']).toBe(JSON.stringify({ cash: 30 }));
    expect(data.has('3da-save-dirty')).toBe(false);
    expect(data.get('3da-save-at')).toBe('2026-11-17T10:00:01.000Z');
  });

  it('finishes an upload before deleting the save and blocks new uploads during deletion', async () => {
    let finish!: (res: Response) => void;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
      .mockResolvedValue(response(null));
    vi.stubGlobal('fetch', fetch);
    const cloud = await import('../src/cloud');
    data.set('drive-it-3d', JSON.stringify({ cash: 20 }));
    const upload = cloud.push();
    const deletion = cloud.stopSaving();
    expect(await cloud.push()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(response('2026-11-17T10:00:00.000Z'));
    await upload;
    expect(await deletion).toBe(true);
    expect(fetch.mock.calls.map((args) => String(args[0]).split('/').pop())).toEqual(['save_put', 'save_delete']);
    expect(data.has('3da-save-code')).toBe(false);
    expect(data.has('3da-save-at')).toBe(false);
    expect(data.get('drive-it-3d')).toBe(JSON.stringify({ cash: 20 }));
  });

  it('marks a save larger than the upload limit as unsaved', async () => {
    const cloud = await import('../src/cloud');
    data.set('3da-addon', 'x'.repeat(120000));
    expect(await cloud.push()).toBe(false);
    expect(data.get('3da-save-dirty')).toBe('1');
  });

  it('retains changes during a failed deletion and resumes saving afterwards', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout });
    let rejectDelete!: (error: Error) => void;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((_, reject) => { rejectDelete = reject; }))
      .mockResolvedValue(response('2026-11-17T10:00:00.000Z'));
    vi.stubGlobal('fetch', fetch);
    const cloud = await import('../src/cloud');
    const deletion = cloud.stopSaving();
    data.set('drive-it-3d', JSON.stringify({ cash: 30 }));
    cloud.changed();
    expect(data.get('3da-save-dirty')).toBe('1');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    rejectDelete(new Error('offline'));
    expect(await deletion).toBe(false);
    expect(data.get('3da-save-dirty')).toBe('1');
    expect(cloud.savingOn()).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toMatch(/save_put$/);
    expect(JSON.parse(fetch.mock.calls[1][1].body).data['drive-it-3d']).toBe(JSON.stringify({ cash: 30 }));
    expect(data.has('3da-save-dirty')).toBe(false);
  });

  it('preserves the current game and save code if a linked save does not fit in local storage', async () => {
    const original = new Map(data);
    const imported = 'b'.repeat(40);
    vi.stubGlobal('location', { search: `?save=${imported}`, pathname: '/', hash: '' });
    vi.stubGlobal('history', { replaceState: vi.fn() });
    localStorage.setItem = (key: string, value: string) => {
      if (value.length > 100) throw new DOMException('Full', 'QuotaExceededError');
      data.set(key, value);
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      name: 'Other player', updated_at: '2026-11-17T10:00:00.000Z',
      data: { 'drive-it-3d': JSON.stringify({ cash: 1000 }), '3da-homes': 'x'.repeat(200) },
    })));
    const cloud = await import('../src/cloud');
    expect(await cloud.arrive(() => true)).toBe('ok');
    expect(data).toEqual(original);
  });

  it('imports a linked save and preserves private keys and unrelated storage', async () => {
    const imported = 'b'.repeat(40);
    data.set('3da-full-key', 'private');
    data.set('other-app', 'keep');
    vi.stubGlobal('location', { search: `?save=${imported}`, pathname: '/', hash: '' });
    vi.stubGlobal('history', { replaceState: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      name: 'Other player', updated_at: '2026-11-17T10:00:00.000Z',
      data: { 'drive-it-3d': JSON.stringify({ cash: 1000 }), '3da-full-key': 'replace', '3da-save-code': 'replace', 'other-app': 'replace' },
    })));
    const cloud = await import('../src/cloud');
    expect(await cloud.arrive(() => true)).toBe('reload');
    expect(data.get('drive-it-3d')).toBe(JSON.stringify({ cash: 1000 }));
    expect(data.get('3da-save-code')).toBe(imported);
    expect(data.get('3da-full-key')).toBe('private');
    expect(data.get('other-app')).toBe('keep');
    expect(data.has('3da-save-dirty')).toBe(false);
  });
});
