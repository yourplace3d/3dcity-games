import { afterEach, describe, expect, it, vi } from 'vitest';
import { addScore, nameScore, scores, type Score } from '../src/scores';

const good: Score = { name: 'Player', score: 700, seconds: 100, place: 'Berlin', jobs: 3, at: 10 };
function storage(list: unknown[]): Map<string, string> {
  const data = new Map([['3da-scores', JSON.stringify(list)]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  return data;
}
afterEach(() => vi.unstubAllGlobals());

describe('scoreboard storage', () => {
  it('ignores corrupt entries instead of displaying invalid times and names', () => {
    const old = { ...good, at: 11, jobs: undefined };
    storage([good, old, null, { score: 99 }, { ...good, seconds: 'slow' }, { ...good, name: {} }, { ...good, score: -1 }, { ...good, jobs: 0 }]);
    expect(scores()).toEqual([good, old]);
  });

  it('still sorts scores by points then time and renames the selected run', () => {
    const data = storage([good]);
    addScore({ ...good, at: 12, seconds: 90 });
    nameScore(12, 'New name');
    expect(scores().map(({ name, at }) => ({ name, at }))).toEqual([{ name: 'New name', at: 12 }, { name: 'Player', at: 10 }]);
    expect(data.get('3da-name')).toBe('New name');
  });
});
