import { describe, expect, it } from 'vitest';
import { kerbSpot } from '../src/game/stopShapes';

// a street 12 m wide running east along y = 0
const road: [number, number] = [10, 0];
const east: [number, number] = [1, 0];

describe('bus stop placement', () => {
  it('moves a stop mapped on the centre line to the kerb on the side traffic keeps to', () => {
    expect(kerbSpot(10, 0, road, east, 12, false)).toEqual({ x: 10, y: -6, side: -1 });
    expect(kerbSpot(10, 0, road, east, 12, true)).toEqual({ x: 10, y: 6, side: 1 });
  });

  it('moves a stop mapped in a lane out to the kerb on that side', () => {
    expect(kerbSpot(10, 3, road, east, 12, false)).toEqual({ x: 10, y: 6, side: 1 });
    expect(kerbSpot(10, -4, road, east, 12, true)).toEqual({ x: 10, y: -6, side: -1 });
  });

  it('leaves a stop already on the pavement where it is', () => {
    expect(kerbSpot(10, 9, road, east, 12, false)).toEqual({ x: 10, y: 9, side: 1 });
  });

  it('keeps the stop where it is along the street', () => {
    const s = kerbSpot(14, 2, road, east, 8, false);
    expect(s.x).toBeCloseTo(14);
    expect(s.y).toBeCloseTo(4);
  });
});
