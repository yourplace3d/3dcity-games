import { describe, expect, it } from 'vitest';
import { canBuy, packHomes, readHomes, type Homes } from '../src/game/homes';

const flat = (i: number, colour?: string): Homes['homes'][number] => ({ id: String(i), lat: 49.45, lon: 11.08, kind: 'flat', paid: 700, rent: 168, street: 'Lindenstraße', place: 'Nuremberg', at: 86400000 * 20000, ...(colour ? { colour } : {}) });
const own = (n: number): Homes => ({ v: 1, homes: Array.from({ length: n }, (_, i) => flat(i)), paidDay: '2026-11-17' });

describe('homes, step by step', () => {
  it('sells flats first, then houses, then whole buildings', () => {
    expect(canBuy(own(0), 'flat')).toBe(true);
    expect(canBuy(own(0), 'house')).toBe(false);
    expect(canBuy(own(2), 'house')).toBe(false);
    expect(canBuy(own(3), 'house')).toBe(true);
    expect(canBuy(own(5), 'building')).toBe(false);
    expect(canBuy(own(6), 'building')).toBe(true);
  });

  it('keeps a painted colour, and reads homes kept before colours', () => {
    const h: Homes = { v: 1, homes: [flat(1, '#c9714a'), flat(2)], paidDay: '2026-11-17' };
    const back = readHomes(packHomes(h));
    expect(back.homes[0].colour).toBe('#c9714a');
    expect(back.homes[1].colour).toBeUndefined();
    expect(readHomes(packHomes({ ...h, homes: [{ ...flat(3), colour: 'red; x' }] })).homes[0].colour).toBeUndefined();
    // the older way of keeping homes carries the colour too
    expect(readHomes(JSON.stringify({ v: 1, homes: [flat(4, '#c9714a')], paidDay: '2026-11-17' })).homes[0].colour).toBe('#c9714a');
  });
});
