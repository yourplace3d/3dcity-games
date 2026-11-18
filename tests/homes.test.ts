import { describe, expect, it } from 'vitest';
import { dayOf, findLots, packHomes, homesIn, lotKind, readHomes, rentDue, rentFor, roundPrice, type LotBuilding } from '../src/game/homes';

const box = (x: number, y: number, w: number, h: number, height: number, id: string): LotBuilding => ({
  poly: { outer: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], holes: [] },
  height,
  id,
});
const around = { areas: [], lines: [], keepClear: [], sights: [], streets: [{ name: 'Lindenstraße', pts: [[-300, 0], [300, 0]] as Array<[number, number]> }], half: 750 };

describe('homes', () => {
  it('splits buildings into flats, houses and what is not for sale', () => {
    expect(lotKind(20, 1)).toBeNull(); // a garage
    expect(lotKind(120, 2)).toEqual({ kind: 'house', units: 1 });
    expect(lotKind(2000, 1)).toBeNull(); // a hall
    expect(lotKind(300, 5)?.kind).toBe('flats');
    expect(lotKind(300, 5)?.units).toBe(17);
  });

  it('prices so that the cheapest flats cost about one run and dear spots cost more', () => {
    const b: LotBuilding[] = [];
    for (let i = 0; i < 40; i++) b.push(box(-200 + i * 12, 5, 10, 20, i % 2 ? 17 : 7, String(i)));
    const lots = findLots(b, around);
    const flats = lots.filter((l) => l.kind === 'flats').map((l) => l.price);
    expect(Math.min(...flats)).toBeGreaterThanOrEqual(600);
    expect(Math.min(...flats)).toBeLessThanOrEqual(800);
    expect(Math.max(...flats)).toBeGreaterThan(Math.min(...flats) * 2.5);
    expect(lots.every((l) => l.street === 'Lindenstraße')).toBe(true);
    // the whole building is its flats together
    for (const l of lots.filter((x) => x.kind === 'flats')) expect(l.whole).toBeGreaterThanOrEqual(l.price * l.units * 0.9);
  });

  it('keeps nothing for sale next to a sight or a school', () => {
    const lots = findLots([box(0, 10, 10, 20, 17, 'a'), box(200, 10, 10, 20, 17, 'b')], { ...around, keepClear: [[5, 20]] });
    expect(lots.map((l) => l.id)).toEqual(['b']);
  });

  it('rounds prices to two figures that matter', () => {
    expect(roundPrice(783)).toBe(780);
    expect(roundPrice(4321)).toBe(4300);
    expect(roundPrice(18420)).toBe(18000);
  });

  it('pays rent once for each day one comes back, however long one was away', () => {
    const monday = new Date(2026, 10, 16, 9).getTime();
    const h = readHomes(JSON.stringify({ v: 1, homes: [{ id: '1', lat: 0, lon: 0, kind: 'flat', paid: 700, rent: 0, street: '', place: '', at: 0 }], paidDay: dayOf(monday) }));
    expect(rentFor(700)).toBe(168);
    expect(h.homes[0].rent).toBe(168); // from the price, whatever was kept
    expect(rentDue(h, monday + 6 * 3600 * 1000)).toBe(0); // the same day
    expect(rentDue(h, new Date(2026, 10, 17, 0, 5).getTime())).toBe(168); // just after midnight
    expect(rentDue(h, new Date(2026, 10, 30).getTime())).toBe(168); // two weeks away: still one day
  });

  it('reads what an earlier version kept', () => {
    const h = readHomes(JSON.stringify({ v: 1, homes: [], paidUntil: new Date(2026, 10, 16, 12).getTime() }));
    expect(h.paidDay).toBe('2026-11-16');
  });

  it('finds each home as one building: its map number nearby, or where it stood when the map has redrawn it', () => {
    const h = readHomes(JSON.stringify({ v: 1, homes: [{ id: '7', lat: 0, lon: 0, kind: 'house', paid: 1, rent: 1, street: '', place: '', at: 0 }], paidDay: '2026-11-16' }));
    const local = (lon: number, lat: number): [number, number] => [lon, lat]; // the home stands at 0,0
    // a group of buildings sharing number 7: the nearest is the home, the others are not
    const group = [{ id: '7', x: 9, y: 0 }, { id: '7', x: 3, y: 0 }, { id: '7', x: 200, y: 0 }];
    expect([...homesIn(h, group, local).keys()]).toEqual([group[1]]);
    // redrawn under a new number: the building standing where it stood
    expect([...homesIn(h, [{ id: '8', x: 1, y: 1 }, { id: '9', x: 20, y: 0 }], local).keys()]).toEqual([{ id: '8', x: 1, y: 1 }]);
    // nothing near
    expect(homesIn(h, [{ id: '7', x: 50, y: 0 }], local).size).toBe(0);
  });

  it('keeps a thousand homes short enough for an online save, and reads them back', () => {
    const homes = Array.from({ length: 1000 }, (_, i) => ({ id: String(2980179962 + i), lat: 49.45095336 + i * 1e-4, lon: 11.07809990 - i * 1e-4, kind: (['flat', 'house', 'building'] as const)[i % 3], paid: 700 + i, rent: 0, street: `Street ${i % 40}`, place: i % 2 ? 'Nuremberg' : 'Berlin', at: 1794854100829 }));
    const text = packHomes({ v: 1, homes, paidDay: '2026-11-16' });
    expect(text.length).toBeLessThan(60000);
    const back = readHomes(text);
    expect(back.paidDay).toBe('2026-11-16');
    expect(back.homes).toHaveLength(1000);
    expect(back.homes[1]).toMatchObject({ id: '2980179963', kind: 'house', paid: 701, rent: rentFor(701), street: 'Street 1', place: 'Nuremberg' });
    expect(Math.abs(back.homes[1].lat - homes[1].lat)).toBeLessThan(1e-5);
  });
});
