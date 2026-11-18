import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireRadio } from '../src/radio';

class Element extends EventTarget {
  hidden = false;
  textContent = '';
  classList = { toggle: vi.fn() };
  blur = vi.fn();
}
class AudioStub extends EventTarget {
  preload = '';
  src = '';
  get currentSrc(): string { return this.src; }
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  removeAttribute(): void { this.src = ''; }
}
let audio: AudioStub;
let button: Element;
let doc: EventTarget & { hidden: boolean };
let inCar: boolean;
let say = vi.fn<(text: string, kind?: 'good' | 'bad' | 'info') => void>();
let fetchMock: ReturnType<typeof vi.fn>;
const stations = (tag: string) => [1, 2, 3].map((i) => ({ name: `${tag} ${i}`, url_resolved: `https://radio.test/${tag}/${i}` }));
const reply = (tag: string) => new Response(JSON.stringify(stations(tag)));
const deferred = () => {
  let resolve!: (res: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
};
async function settle(): Promise<void> { await vi.advanceTimersByTimeAsync(0); }
function click(): void { button.dispatchEvent(new Event('click')); }

beforeEach(() => {
  vi.useFakeTimers();
  audio = new AudioStub();
  button = new Element();
  const name = new Element();
  const next = new Element();
  const bar = Object.assign(new Element(), { querySelector: (selector: string) => selector === '.name' ? name : next });
  doc = Object.assign(new EventTarget(), { hidden: false, body: new Element(), createElement: () => ({ canPlayType: () => '' }) });
  const data = new Map([['3da-radio', '1']]);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { setTimeout });
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  vi.stubGlobal('Audio', class { constructor() { return audio; } });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  say = vi.fn();
  inCar = true;
  wireRadio(button as unknown as HTMLButtonElement, bar as unknown as HTMLElement, () => ({ lat: 52, lon: 13 }), () => inCar, say);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('car radio lifecycle', () => {
  it('does not start a station after the player exits during the directory request', async () => {
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);
    click();
    inCar = false;
    await vi.advanceTimersByTimeAsync(400);
    pending.resolve(reply('old'));
    await settle();
    expect(audio.src).not.toMatch(/^https:/);
    inCar = true;
    await vi.advanceTimersByTimeAsync(400);
    expect(audio.src).toBe('https://radio.test/old/1');
  });

  it('ignores the old station list after switching off and on again', async () => {
    const old = deferred();
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce(reply('new'));
    click();
    click();
    click();
    await settle();
    expect(audio.src).toBe('https://radio.test/new/1');
    old.resolve(reply('old'));
    await settle();
    expect(audio.src).toBe('https://radio.test/new/1');
  });

  it('does not switch a newer radio session off when an older directory request fails', async () => {
    const old = deferred();
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce(reply('new')).mockResolvedValue(new Response('', { status: 503 }));
    click(); click(); click();
    await settle();
    old.resolve(new Response('', { status: 503 }));
    await settle();
    expect(say).not.toHaveBeenCalled();
    expect(audio.src).toBe('https://radio.test/new/1');
  });

  it('stays silent when the directory resolves while hidden and resumes when visible', async () => {
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);
    click();
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    const calls = audio.play.mock.calls.length;
    pending.resolve(reply('town'));
    await vi.advanceTimersByTimeAsync(20000);
    expect(audio.play).toHaveBeenCalledTimes(calls);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(audio.src).toBe('https://radio.test/town/1');
    expect(audio.play).toHaveBeenCalledTimes(calls + 1);
  });
});
