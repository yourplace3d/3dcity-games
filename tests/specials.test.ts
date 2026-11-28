import { describe, expect, it } from 'vitest';
import { Car, SPECS } from '../src/game/cars';
import { buy, delivered, freeSpots, makeOf, none, park, priceOf, readGarage, sell, sellable } from '../src/game/garage';
import { JOB_MAX } from '../src/game/services';
import { CARE_TOP, careCar, careLevel, carePay, careWay, isSpecial, resale, special, SPECIALS } from '../src/game/specials';
import { en } from '../src/lang/en';
import { de } from '../src/lang/de';

const NUE: [number, number] = [49.4521, 11.0767];

describe('the car delivery: a little harder each time, up to a limit', () => {
  it('one level for each delivery done well, and no further than the top', () => {
    expect(careLevel(0)).toBe(0);
    expect(careLevel(3)).toBe(3);
    expect(careLevel(CARE_TOP + 20)).toBe(CARE_TOP);
    expect(careLevel(-2)).toBe(0);
  });

  it('the way gets longer with the level, and stays within what a town’s square holds', () => {
    for (let l = 0; l < CARE_TOP; l++) {
      expect(careWay(l + 1)[0]).toBeGreaterThan(careWay(l)[0]);
      expect(careWay(l + 1)[1]).toBeGreaterThan(careWay(l)[1]);
      expect(careWay(l)[0]).toBeLessThan(careWay(l)[1]);
    }
    expect(careWay(0)[0]).toBeGreaterThanOrEqual(400);
    // the game takes no drop-off whose way by road is 2,400 m or more
    expect(careWay(CARE_TOP)[1]).toBeLessThan(1700);
    expect(careWay(CARE_TOP + 5)).toEqual(careWay(CARE_TOP));
  });

  it('the pay grows a little, and is never more than a job pays', () => {
    expect(carePay(0)).toBe(200);
    for (let l = 0; l <= CARE_TOP + 3; l++) {
      expect(carePay(l)).toBeLessThanOrEqual(JOB_MAX);
      expect(carePay(l + 1)).toBeGreaterThanOrEqual(carePay(l));
    }
    expect(carePay(CARE_TOP)).toBe(JOB_MAX);
  });

  it('the cars come in one by one: the convertible first, all three by the fourth level', () => {
    expect(careCar(0, () => 0.99).id).toBe('convertible');
    expect(careCar(1, () => 0.99).id).toBe('convertible');
    expect(new Set([0, 0.5, 0.99].map((r) => careCar(2, () => r).id))).toEqual(new Set(['convertible', 'limo']));
    expect(new Set([0, 0.4, 0.99].map((r) => careCar(CARE_TOP, () => r).id))).toEqual(new Set(['convertible', 'limo', 'coupe']));
  });
});

describe('special cars', () => {
  it('each has numbers of its own, a price, and words in both languages', () => {
    expect(SPECIALS.map((s) => s.id)).toEqual(['convertible', 'limo', 'coupe']);
    for (const s of SPECIALS) {
      expect(isSpecial(s.id)).toBe(true);
      expect(s.price).toBeGreaterThan(JOB_MAX);
      // sold again, it brings less than it cost
      expect(resale(s.id)).toBeLessThan(s.price);
      expect(resale(s.id)).toBeGreaterThan(0);
      expect(en.garageCar(s.id).length).toBeGreaterThan(3);
      expect(de.garageCar(s.id).length).toBeGreaterThan(3);
      expect(en.careStart(s.id)).toMatch(/^A[n]? .*for a customer/);
      expect(de.careStart(s.id)).toMatch(/^Ein[e]? .*für einen Kunden/);
    }
    expect(isSpecial('sedan')).toBe(false);
    expect(isSpecial(undefined)).toBe(false);
    expect(en.careDone('$200', 'limo')).toBe('Handed over without a dent: +$200. The limousine is for sale at the garages now.');
    expect(en.careDone('$200', null)).toBe('Handed over without a dent: +$200.');
    expect(de.careDone('200 $', 'limo')).toBe('Ohne Delle übergeben: +200 $. Die Limousine steht jetzt bei den Garagen zum Verkauf.');
  });

  it('look like no car in traffic, and drive as their numbers say', () => {
    const body = (c: Car) => (c.mesh.children[0] as unknown as { material: { color: { getHexString: () => string } } }).material.color.getHexString();
    for (const s of SPECIALS) {
      const c = new Car(s.kind, s.colour, { top: s.top, acc: s.acc, len: s.len }, s.look);
      expect(c.look).toBe(s.look);
      expect(c.spec.top).toBe(s.top);
      expect(body(c)).toBe(s.colour.slice(1));
      // built of other boxes than the ordinary car of its kind
      expect(c.mesh.children.length).not.toBe(new Car(s.kind, s.colour).mesh.children.length);
    }
    // the limousine is longer than a car, and bumps as long as it is
    const limo = special('limo');
    const long = new Car(limo.kind, limo.colour, { top: limo.top, acc: limo.acc, len: limo.len }, limo.look);
    expect(long.spec.len).toBe(6.2);
    expect(long.a).toBeGreaterThan(new Car('sedan').a);
    expect(SPECS.sedan.len).toBe(4.3);
    // the coupé is the fastest car there is
    expect(special('coupe').top).toBeGreaterThan(Math.max(SPECS.sport.top, SPECS.police.top));
    // the convertible dents most easily
    expect(special('convertible').dent).toBe(Math.max(...SPECIALS.map((s) => s.dent)));
  });
});

describe('the garage’s part of it', () => {
  it('a delivery done well is one more, and its car is for sale from then on, once', () => {
    let g = none();
    expect(g).toMatchObject({ done: 0, shown: [] });
    g = delivered(g, 'convertible');
    g = delivered(g, 'convertible');
    g = delivered(g, 'limo');
    expect(g.done).toBe(3);
    expect(g.shown).toEqual(['convertible', 'limo']);
  });

  it('a car is bought only once it has been delivered, and takes a spot like any kept car', () => {
    let g = none();
    expect(buy(g, 'convertible', NUE[0], NUE[1], 1)).toBeNull();
    g = delivered(g, 'convertible');
    const r = buy(g, 'convertible', NUE[0], NUE[1], 5)!;
    expect(r.car).toMatchObject({ id: 1, kind: 'sedan', special: 'convertible', colour: special('convertible').colour });
    g = r.garage;
    expect(g.done).toBe(1);
    expect(freeSpots(g, NUE[0], NUE[1])).toBe(2);
    // with the three spots taken, none can be bought
    g = park(g, { kind: 'van', colour: '#e8e6df' }, NUE[0], NUE[1], 6)!.garage;
    g = park(g, { kind: 'van', colour: '#e8e6df' }, NUE[0], NUE[1], 7)!.garage;
    expect(buy(g, 'convertible', NUE[0], NUE[1], 8)).toBeNull();
    // sold again: for less than it cost, and what was delivered stays for sale
    expect(sellable(r.car)).toBe('yes');
    expect(priceOf(r.car)).toBe(resale('convertible'));
    const sold = sell(g, 1)!;
    expect(sold.price).toBe(resale('convertible'));
    expect(sold.garage.shown).toEqual(['convertible']);
    expect(makeOf('limo')).toEqual({ kind: 'sedan', colour: special('limo').colour, special: 'limo' });
  });

  it('is kept in the browser with the rest, and nonsense is left out', () => {
    const g = buy(delivered(delivered(none(), 'coupe'), 'limo'), 'coupe', NUE[0], NUE[1], 9)!.garage;
    expect(readGarage(JSON.stringify({ v: 1, ...g }))).toEqual(g);
    const odd = readGarage(JSON.stringify({ v: 1, next: 2, done: -4, shown: ['coupe', 'tank', 'coupe', 7], cars: [{ id: 1, kind: 'sedan', colour: '#1f4d3a', special: 'coupe', lat: 1, lon: 1, at: 1 }] }));
    expect(odd.done).toBe(0);
    expect(odd.shown).toEqual(['coupe']);
    // a coupé drives as a sports car: kept as a car, it is no coupé
    expect(odd.cars[0].special).toBeUndefined();
    // a garage kept before the job existed
    expect(readGarage(JSON.stringify({ v: 1, next: 1, cars: [] }))).toEqual(none());
  });
});
