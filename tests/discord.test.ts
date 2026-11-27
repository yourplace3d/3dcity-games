import { describe, expect, it } from 'vitest';
import { cardDue, click, INVITE, inviting, isInvite } from '../src/discord';

const fresh = () => ({ card: false, counted: [] as string[] });
const done = (upTo: number) => (n: number) => n <= upTo;
const LINK = 'https://discord.gg/abc123';

describe('the Discord invite', () => {
  it('shows nothing until a real invite is set', () => {
    expect(INVITE === '' || isInvite(INVITE)).toBe(true);
    expect(inviting('')).toBe(false);
    expect(inviting('https://example.com/abc')).toBe(false);
    expect(inviting('http://discord.gg/abc')).toBe(false);
    expect(inviting(LINK)).toBe(true);
    expect(inviting('https://discord.com/invite/abc-123')).toBe(true);
  });
  it('shows nothing in a baked build', () => {
    expect(inviting(LINK, '2026-11-01')).toBe(false);
  });
  it('shows the card once, after its chapter', () => {
    expect(cardDue(done(1), fresh(), LINK, 2)).toBe(false);
    expect(cardDue(done(2), fresh(), LINK, 2)).toBe(true);
    expect(cardDue(done(5), fresh(), LINK, 3)).toBe(true);
    expect(cardDue(done(5), { card: true, counted: [] }, LINK, 2)).toBe(false);
    expect(cardDue(done(5), fresh(), '', 2)).toBe(false);
  });
  it('counts a click once for each place', () => {
    const a = click(fresh(), '2');
    expect(a.count).toBe(true);
    expect(click(a.seen, '2').count).toBe(false);
    const b = click(a.seen, 'menu');
    expect(b.count).toBe(true);
    expect(b.seen.counted).toEqual(['2', 'menu']);
  });
});
