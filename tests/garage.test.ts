import { describe, expect, it } from 'vitest';
import { BUS_PAINTS, canKeep, carsAt, cityOf, CITY_KM, freeSpots, giveUp, none, PAINT_COST, park, priceOf, readGarage, repaint, sell, sellable, SPOTS, type Garage, type Make } from '../src/game/garage';
import { Car } from '../src/game/cars';
import { JOB_MAX } from '../src/game/services';
import { en } from '../src/lang/en';
import { de } from '../src/lang/de';
import { kmBetween } from '../src/game/bank';

// two garages in Nuremberg, a few km apart; one in Munich
const NUE: [number, number] = [49.4521, 11.0767];
const NUE2: [number, number] = [49.4301, 11.1202];
const MUC: [number, number] = [48.1372, 11.5755];
const red: Make = { kind: 'sedan', colour: '#c8362e' };
const quick: Make = { kind: 'sport', colour: '#2f6fb5' };
const van: Make = { kind: 'van', colour: '#e8e6df' };

/** Park these, one after another, at a place. */
function parked(g: Garage, makes: Make[], at: [number, number], now = 1000): Garage {
  for (const m of makes) {
    const r = park(g, m, at[0], at[1], now);
    if (!r) throw new Error('full');
    g = r.garage;
  }
  return g;
}

describe('which cars a garage keeps', () => {
  it('any car one can get hold of, and nothing on rails', () => {
    for (const kind of ['sedan', 'sport', 'van', 'police', 'bus'] as const) expect(canKeep(kind)).toBe(true);
    expect(canKeep('tram')).toBe(false);
    expect(canKeep('train')).toBe(false);
  });

  it('in words, in both languages', () => {
    expect(en.garageCar('sport')).toBe('Sports car');
    expect(en.garagePark('police')).toBe('Park this police car here');
    // German has its own sentence for each: der Sportwagen, das Auto
    expect(de.garageCar('sport')).toBe('Sportwagen');
    expect(de.garagePark('sport')).toBe('Diesen Sportwagen hier abstellen');
    expect(de.garagePark('sedan')).toBe('Dieses Auto hier abstellen');
    expect(de.garageMine('bus')).toMatch(/^Dieser Bus steht/);
  });
});

describe('parking', () => {
  it('keeps the car: its kind, its paint, and what makes it a make of its own', () => {
    const r = park(none(), { kind: 'sport', colour: '#E0569B', top: 44, acc: 13, dent: 1.5 }, NUE[0], NUE[1], 1234)!;
    expect(r.car).toEqual({ id: 1, kind: 'sport', colour: '#e0569b', top: 44, acc: 13, dent: 1.5, lat: NUE[0], lon: NUE[1], at: 1234 });
    expect(r.garage.cars).toEqual([r.car]);
    // an ordinary car has none of that to keep
    expect(park(none(), { ...red, dent: 1 }, NUE[0], NUE[1], 1)!.car).toEqual({ id: 1, kind: 'sedan', colour: '#c8362e', lat: NUE[0], lon: NUE[1], at: 1 });
  });

  it('three spots, and the fourth car finds none', () => {
    expect(SPOTS).toBe(3);
    const g = parked(none(), [red, quick, van], NUE);
    expect(carsAt(g, NUE[0], NUE[1]).map((c) => c.kind)).toEqual(['sedan', 'sport', 'van']);
    expect(freeSpots(g, NUE[0], NUE[1])).toBe(0);
    expect(park(g, red, NUE[0], NUE[1], 2)).toBeNull();
  });

  it('never gives a number twice, though a car was sold in between', () => {
    let g = parked(none(), [red, quick], NUE);
    g = sell(g, 2)!.garage;
    const r = park(g, van, NUE[0], NUE[1], 5)!;
    expect(r.car.id).toBe(3);
    expect(r.garage.cars.map((c) => c.id)).toEqual([1, 3]);
  });
});

describe('a city', () => {
  it('is the same three spots at whichever of its garages one drives to', () => {
    expect(kmBetween(...NUE, ...NUE2)).toBeLessThan(CITY_KM);
    let g = parked(none(), [red, quick], NUE);
    // seen from the other garage, and the third car parked there is kept under the city's place
    expect(carsAt(g, NUE2[0], NUE2[1]).map((c) => c.id)).toEqual([1, 2]);
    expect(freeSpots(g, NUE2[0], NUE2[1])).toBe(1);
    const r = park(g, van, NUE2[0], NUE2[1], 9)!;
    g = r.garage;
    expect([r.car.lat, r.car.lon]).toEqual(NUE);
    expect(carsAt(g, NUE[0], NUE[1])).toHaveLength(3);
    expect(park(g, red, NUE2[0], NUE2[1], 10)).toBeNull();
  });

  it('has spots of its own: full in Nuremberg, free in Munich', () => {
    expect(kmBetween(...NUE, ...MUC)).toBeGreaterThan(CITY_KM);
    let g = parked(none(), [red, quick, van], NUE);
    expect(freeSpots(g, MUC[0], MUC[1])).toBe(3);
    expect(carsAt(g, MUC[0], MUC[1])).toEqual([]);
    g = parked(g, [red], MUC);
    expect(carsAt(g, MUC[0], MUC[1]).map((c) => c.id)).toEqual([4]);
    expect(carsAt(g, NUE[0], NUE[1]).map((c) => c.id)).toEqual([1, 2, 3]);
    expect(cityOf(g, MUC[0] + 0.01, MUC[1])).toEqual(MUC);
  });

  it('with no car yet is the garage’s own place', () => {
    expect(cityOf(none(), NUE2[0], NUE2[1])).toEqual(NUE2);
  });
});

describe('selling', () => {
  it('frees the spot and pays the car’s price', () => {
    const g = parked(none(), [red, quick, van], NUE);
    const r = sell(g, 2)!;
    expect(r.price).toBe(priceOf(quick));
    expect(r.garage.cars.map((c) => c.id)).toEqual([1, 3]);
    expect(freeSpots(r.garage, NUE[0], NUE[1])).toBe(1);
    expect(park(r.garage, red, NUE[0], NUE[1], 3)).not.toBeNull();
    // no such car
    expect(sell(g, 99)).toBeNull();
  });

  it('pays less than a job done well, whatever the car: taking cars to sell them is not the better job', () => {
    for (const kind of ['sedan', 'sport', 'van', 'bus'] as const) {
      expect(priceOf({ kind, colour: '#000000' })).toBeGreaterThan(0);
      expect(priceOf({ kind, colour: '#000000' })).toBeLessThan(JOB_MAX);
    }
  });

  it('a police car is not sold (the owner: "Police cars don’t sell"): it can only be given up, for nothing', () => {
    const cop: Make = { kind: 'police', colour: '#c8362e' };
    expect(sellable(cop)).toBe('no');
    const g = parked(none(), [red, cop, van], NUE);
    expect(sell(g, 2)).toBeNull();
    expect(freeSpots(g, NUE[0], NUE[1])).toBe(0);
    const after = giveUp(g, 2)!;
    expect(after.cars.map((c) => c.id)).toEqual([1, 3]);
    expect(freeSpots(after, NUE[0], NUE[1])).toBe(1);
    expect(giveUp(g, 99)).toBeNull();
  });

  it('a bus is sold once it has new paint (the owner: "buses can but need new paint")', () => {
    const bus: Make = { kind: 'bus', colour: '#8a8f96' };
    expect(sellable(bus)).toBe('paint');
    expect(sellable(red)).toBe('yes');
    let g = parked(none(), [red, bus], NUE);
    expect(sell(g, 2)).toBeNull();
    const r = repaint(g, 2, () => 0)!;
    g = r.garage;
    expect(r.car).toMatchObject({ id: 2, kind: 'bus', painted: true, colour: BUS_PAINTS[0] });
    expect(sellable(r.car)).toBe('yes');
    // painted again: another paint than the one it has
    expect(repaint(g, 2, () => 0)!.car.colour).toBe(BUS_PAINTS[1]);
    for (const p of BUS_PAINTS) expect(p).not.toBe('#e8b923');
    const sold = sell(g, 2)!;
    expect(sold.price).toBe(priceOf(bus));
    // after its paint, a bus brings no more than an ordinary car: taking one from its driver earns nothing extra
    expect(sold.price - PAINT_COST).toBeLessThanOrEqual(priceOf(red));
    // only a bus is painted
    expect(repaint(g, 1)).toBeNull();
    expect(repaint(g, 99)).toBeNull();
  });

  it('a painted bus is kept painted, and shows its paint on the street', () => {
    const g = repaint(parked(none(), [{ kind: 'bus', colour: '#8a8f96' }], NUE), 1, () => 0)!.garage;
    expect(readGarage(JSON.stringify({ v: 1, ...g })).cars[0]).toMatchObject({ painted: true, colour: BUS_PAINTS[0] });
    // paint is a bus's alone: a car kept as painted is read as the car it is
    expect(readGarage(JSON.stringify({ v: 1, next: 2, cars: [{ id: 1, kind: 'sedan', colour: '#c8362e', lat: 1, lon: 1, at: 1, painted: true }] })).cars[0].painted).toBeUndefined();
    const body = (c: Car) => (c.mesh.children[0] as unknown as { material: { color: { getHexString: () => string } } }).material.color.getHexString();
    expect(body(new Car('bus', BUS_PAINTS[0], undefined, true))).toBe(BUS_PAINTS[0].slice(1));
    // a bus of the town is yellow, whatever colour it was given
    expect(body(new Car('bus', BUS_PAINTS[0]))).toBe('e8b923');
  });
});

describe('what is kept in the browser', () => {
  it('is read back as it was', () => {
    const g = parked(parked(none(), [red, { kind: 'sport', colour: '#e0569b', top: 44 }], NUE), [van], MUC);
    expect(readGarage(JSON.stringify({ v: 1, ...g }))).toEqual(g);
  });

  it('nothing, or nonsense, is an empty garage', () => {
    expect(readGarage(null)).toEqual(none());
    expect(readGarage('{')).toEqual(none());
    expect(readGarage('{"cars":7}')).toEqual(none());
  });

  it('leaves out what is no car of the garage’s, and never gives a kept number again', () => {
    const car = { id: 4, kind: 'sedan', colour: '#c8362e', lat: 49.45, lon: 11.08, at: 5 };
    const g = readGarage(
      JSON.stringify({
        v: 1,
        next: 2,
        cars: [car, { ...car, id: 5, kind: 'tram' }, { ...car, id: 6, colour: 'red' }, { ...car, id: 7, lat: 'north' }, { ...car, id: 4, kind: 'van' }, null, { ...car, id: 8, top: -3, dent: 'soft' }],
      }),
    );
    expect(g.cars).toEqual([car, { ...car, id: 8 }]);
    expect(g.next).toBe(9);
  });
});
