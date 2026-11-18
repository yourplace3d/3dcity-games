import { describe, expect, it } from 'vitest';
import type { Home } from '../src/game/homes';
import { homeTowns, isCoords } from '../src/homesList';

const home = (place: string, lat: number, lon: number, kind: Home['kind'] = 'flat', street = '', rent = 168): Home => ({ id: '', lat, lon, kind, paid: 700, rent, street, place, at: 0 });

describe('the list of homes', () => {
  it('puts homes by town, the home plate first, each town in the order a home was first bought there', () => {
    const towns = homeTowns(
      [
        home('Nuremberg', 49.4521, 11.0767, 'flat', 'Königstraße'),
        home('Berlin', 52.5163, 13.3777, 'house', 'Unter den Linden', 400),
        // across Nuremberg, 6 km from the first: the same town
        home('Nuremberg', 49.4, 11.1, 'building', 'Allersberger Straße', 900),
        home('Berlin', 52.52, 13.405),
      ],
      null,
    );
    expect(towns.map((t) => [t.place, t.plate, t.homes.length, t.rent])).toEqual([
      ['Nuremberg', true, 2, 1068],
      ['Berlin', false, 2, 568],
    ]);
    expect(towns[0].homes.map((l) => l.what)).toEqual(['A flat on Königstraße', 'The whole building on Allersberger Straße']);
    expect(towns[1].homes[0].what).toBe('A house on Unter den Linden');
    expect(towns[1].homes[1].what).toBe('A flat');
  });

  it('says how far the repairs of the first home have got, and counts only the rent that comes in', () => {
    const first = home('Berlin', 52.5164, 13.408, 'flat', 'Mühlendamm', 144);
    const worn = homeTowns([first], { stage: 'flat', units: 4 })[0];
    expect(worn.rent).toBe(0);
    expect(worn.homes[0].note).toBe('Worn down: no rent until it is repaired');
    const building = { ...first, kind: 'building' as const, rent: 1392 };
    const half = homeTowns([building, home('Berlin', 52.53, 13.41)], { stage: 'rest', units: 4, fixed: 1 })[0];
    expect(half.homes[0].rent).toBe(696);
    expect(half.homes[0].note).toBe('2 of 4 flats repaired');
    // only the first home is the building being repaired
    expect(half.homes[1]).toMatchObject({ rent: 168, note: '' });
    expect(half.rent).toBe(864);
    expect(homeTowns([building], { stage: 'done' })[0].homes[0]).toMatchObject({ rent: 1392, note: '' });
  });

  it('names a town by a name rather than by coordinates, where it has one', () => {
    expect(isCoords('52.52, 13.40')).toBe(true);
    expect(isCoords('-33.87,151.21')).toBe(true);
    expect(isCoords('Berlin')).toBe(false);
    expect(homeTowns([home('52.52, 13.40', 52.52, 13.4), home('Berlin', 52.51, 13.39)], null)[0].place).toBe('Berlin');
    expect(homeTowns([home('', 48.137, 11.575)], null)[0].place).toBe('48.14, 11.57');
  });
});
