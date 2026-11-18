import { describe, expect, it } from 'vitest';
import { timeSpan, visitSource } from '../src/linkCount';

const q = (s: string) => new URLSearchParams(s);

describe('where a visit came from', () => {
  it('reads the video link and challenge links first', () => {
    expect(visitSource(q('?ref=youtube'), 'https://mindmacher.com/3da/', 'yourplace3d.github.io')).toBe('youtube');
    expect(visitSource(q('?c=abc'), 'https://web.whatsapp.com/', 'yourplace3d.github.io')).toBe('challenge');
  });
  it('sorts the sending site into one word', () => {
    expect(visitSource(q(''), '', 'x.io')).toBe('direct');
    expect(visitSource(q(''), 'https://x.io/other', 'x.io')).toBe('direct');
    expect(visitSource(q(''), 'https://www.google.de/', 'x.io')).toBe('search');
    expect(visitSource(q(''), 'https://duckduckgo.com/', 'x.io')).toBe('search');
    expect(visitSource(q(''), 'https://m.youtube.com/watch', 'x.io')).toBe('youtube');
    expect(visitSource(q(''), 'https://www.reddit.com/r/x', 'x.io')).toBe('link');
    expect(visitSource(q(''), 'not an address', 'x.io')).toBe('direct');
  });
});

describe('time played', () => {
  it('is sent as one of four spans', () => {
    expect([0, 59, 60, 299, 300, 1199, 1200, 9000].map(timeSpan)).toEqual(['under1', 'under1', '1to5', '1to5', '5to20', '5to20', 'over20', 'over20']);
  });
});
