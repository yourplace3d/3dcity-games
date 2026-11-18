import { describe, expect, it } from 'vitest';
import { homePlate, inPlate, kmBetween, payFrom, readSaved } from '../src/game/bank';
import type { Homes } from '../src/game/homes';

const home = (lat: number, lon: number, place: string, at: number): Homes['homes'][number] => ({ id: '', lat, lon, kind: 'flat', paid: 700, rent: 168, street: '', place, at });

describe('bank', () => {
  it('has no home plate before the first home, and then the town of the first home', () => {
    expect(homePlate({ v: 1, homes: [], paidDay: '' })).toBeNull();
    const plate = homePlate({ v: 1, homes: [home(48.87, 2.29, 'Paris', 200), home(49.45, 11.08, 'Nuremberg', 100)], paidDay: '' });
    expect(plate?.place).toBe('Nuremberg');
  });

  it('reaches across a town and not to the next city', () => {
    expect(kmBetween(52.52, 13.405, 48.137, 11.575)).toBeGreaterThan(500);
    const plate = { lat: 49.45, lon: 11.08, place: 'Nuremberg' };
    expect(inPlate(plate, 49.47, 11.0)).toBe(true); // Fürth's edge
    expect(inPlate(plate, 49.89, 10.89)).toBe(false); // Bamberg
    expect(inPlate(null, 49.45, 11.08)).toBe(false);
  });

  it('pays from cash first, and from savings only in the home plate', () => {
    expect(payFrom(500, 800, 0, false)).toEqual({ cash: 500, saved: 0 });
    expect(payFrom(1000, 300, 900, true)).toEqual({ cash: 300, saved: 700 });
    expect(payFrom(1000, 300, 900, false)).toBeNull();
    expect(payFrom(1000, 300, 600, true)).toBeNull();
  });

  it('reads what is kept, and nothing odd', () => {
    expect(readSaved('{"v":1,"saved":4200}')).toBe(4200);
    expect(readSaved('{"saved":-5}')).toBe(0);
    expect(readSaved('nonsense')).toBe(0);
    expect(readSaved(null)).toBe(0);
  });
});
