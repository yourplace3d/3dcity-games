/**
 * The garage: where cars are kept (the owner, 28 November 2026; `docs/brainstorm-story.md`, section 19).
 * This file holds the rules alone, with no screen; `garageUi.ts` shows it.
 *
 * The owner's rules:
 * - "The saving of cars I would do only in the garage": a car is kept by driving it to a garage and
 *   parking it there.
 * - "Any car you can get hold of can be parked there": a car, a sports car, a van, a police car, a bus,
 *   however it was come by. A tram or a train cannot leave its rails, so it never gets there.
 * - "Instead of it being gone if it's not being parked there after a run": a car once parked stays the
 *   player's. Taken out and left anywhere, or wrecked, it is at the garage again.
 * - "A max capacity per city which later can be enlarged... three cars per garage first": three spots
 *   for each city, the same three at whichever garage of that city the player drives to.
 * - "And you can sell it if your spots is full": a kept car can be sold, which frees its spot.
 *
 * A city is what lies within `CITY_KM` of the garage where the first car there was parked: that place is
 * kept with each car of the city, so a city never splits or grows as cars come and go.
 *
 * Kept in the browser under `3da-garage`, so saving online carries it along.
 */

import { kmBetween } from './bank';
import type { CarKind } from './cars';

const STORE = '3da-garage';
/** cars a city's garages keep, for now */
export const SPOTS = 3;
/** garages this near the first car's garage are the same city's (km): as wide as a home town */
export const CITY_KM = 25;
/** the most cars kept in all: far more cities than anyone plays */
const CARS_MAX = 300;

/** The kinds of car a garage keeps: all but those on rails. */
export type KeptKind = Exclude<CarKind, 'tram' | 'train'>;
const KINDS: KeptKind[] = ['sedan', 'sport', 'van', 'police', 'bus'];
export const canKeep = (kind: CarKind): kind is KeptKind => (KINDS as CarKind[]).includes(kind);

/** A car as a garage keeps it: its kind and paint, and what makes it a make of its own. */
export interface Make {
  kind: KeptKind;
  /** its paint (#rrggbb) */
  colour: string;
  /** a top speed (m/s) and a pull (m/s²) of its own, where it is no ordinary car of its kind */
  top?: number;
  acc?: number;
  /** how much of a knock becomes damage, where it is not 1 */
  dent?: number;
}

export interface KeptCar extends Make {
  /** its number in the garage: never given twice */
  id: number;
  /** its city: where the garage stands in which the city's first car was parked */
  lat: number;
  lon: number;
  /** when it was parked (ms) */
  at: number;
}

export interface Garage {
  cars: KeptCar[];
  /** the next car's number */
  next: number;
}

export const none = (): Garage => ({ cars: [], next: 1 });

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function readGarage(raw: string | null): Garage {
  try {
    const k = JSON.parse(raw ?? 'null') as Partial<Garage> | null;
    if (!k || typeof k !== 'object' || !Array.isArray(k.cars)) return none();
    const cars: KeptCar[] = [];
    for (const c of k.cars as Array<Partial<KeptCar> | null>) {
      if (!c || !num(c.id) || c.id < 1 || !canKeep(c.kind as CarKind) || typeof c.colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.colour)) continue;
      if (!num(c.lat) || !num(c.lon) || Math.abs(c.lat) > 90 || Math.abs(c.lon) > 180 || cars.some((o) => o.id === c.id)) continue;
      cars.push({
        id: Math.floor(c.id),
        kind: c.kind as KeptKind,
        colour: c.colour.toLowerCase(),
        ...(num(c.top) && c.top > 0 && c.top < 100 ? { top: c.top } : {}),
        ...(num(c.acc) && c.acc > 0 && c.acc < 50 ? { acc: c.acc } : {}),
        ...(num(c.dent) && c.dent > 0 && c.dent < 10 ? { dent: c.dent } : {}),
        lat: c.lat,
        lon: c.lon,
        at: num(c.at) ? c.at : 0,
      });
    }
    const kept = cars.slice(-CARS_MAX);
    const next = Math.max(num(k.next) ? Math.floor(k.next) : 1, ...kept.map((c) => c.id + 1), 1);
    return { cars: kept, next };
  } catch {
    return none();
  }
}

export function loadGarage(): Garage {
  try {
    return readGarage(localStorage.getItem(STORE));
  } catch {
    return none();
  }
}

export function storeGarage(g: Garage): void {
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: 1, ...g }));
  } catch {
    /* private window: for this visit only */
  }
}

/**
 * The city a garage at this place belongs to, as the place its cars are kept under: that of the first car
 * kept within `CITY_KM`, or, where none is, the garage's own place.
 */
export function cityOf(g: Garage, lat: number, lon: number): [number, number] {
  const first = g.cars.find((c) => kmBetween(c.lat, c.lon, lat, lon) <= CITY_KM);
  return first ? [first.lat, first.lon] : [lat, lon];
}

/** The cars kept in the city of a garage at this place, in the order they were parked. */
export function carsAt(g: Garage, lat: number, lon: number): KeptCar[] {
  const [a, b] = cityOf(g, lat, lon);
  return g.cars.filter((c) => c.lat === a && c.lon === b);
}

/** Spots still free in the city of a garage at this place. */
export const freeSpots = (g: Garage, lat: number, lon: number): number => Math.max(0, SPOTS - carsAt(g, lat, lon).length);

/** Park a car at a garage at this place: kept from now on. Null where the city's spots are full. */
export function park(g: Garage, make: Make, lat: number, lon: number, now: number): { garage: Garage; car: KeptCar } | null {
  if (!freeSpots(g, lat, lon) || g.cars.length >= CARS_MAX) return null;
  const [a, b] = cityOf(g, lat, lon);
  const car: KeptCar = {
    id: g.next,
    kind: make.kind,
    colour: make.colour.toLowerCase(),
    ...(make.top ? { top: make.top } : {}),
    ...(make.acc ? { acc: make.acc } : {}),
    ...(make.dent && make.dent !== 1 ? { dent: make.dent } : {}),
    lat: a,
    lon: b,
    at: now,
  };
  return { garage: { cars: [...g.cars, car], next: g.next + 1 }, car };
}

/**
 * What a kept car sells for (estimates, to tune from play). Little on purpose: no job pays more than $300
 * (`JOB_MAX`; the owner: "with rents there's already too much money involved"), and taking a car to sell
 * it must never be the better job. A police car or a bus sells for no more than an ordinary car, so that
 * taking one from its driver earns nothing extra.
 */
const PRICE: Record<KeptKind, number> = { sedan: 100, van: 120, sport: 200, police: 100, bus: 100 };
export const priceOf = (c: Make): number => PRICE[c.kind];

/** Sell a kept car: its spot is free again. Null where there is no such car. */
export function sell(g: Garage, id: number): { garage: Garage; price: number } | null {
  const car = g.cars.find((c) => c.id === id);
  if (!car) return null;
  return { garage: { ...g, cars: g.cars.filter((c) => c !== car) }, price: priceOf(car) };
}
