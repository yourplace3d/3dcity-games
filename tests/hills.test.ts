import { describe, expect, it } from 'vitest';
import { Car } from '../src/game/cars';
import type { World } from '../src/game/world';

/** A world that is one long slope rising along x: `grade` metres up for each metre along. */
const slope = (grade: number) =>
  ({
    half: 5000,
    groundY: (x: number) => x * grade,
    inWater: () => false,
    solids: { push: () => null },
  }) as unknown as World;

/** Drive a car uphill for some seconds; how far it got, and how fast it went at the end. */
function climb(kind: 'sedan' | 'van', heavy: boolean, throttle: number, grade: number, seconds = 20): { metres: number; speed: number } {
  const car = new Car(kind, '#888888');
  car.driver = 'player';
  car.heavy = heavy;
  car.th = 0;
  car.controls.throttle = throttle;
  const world = slope(grade);
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) car.step(dt, world);
  return { metres: car.x, speed: car.vx };
}

describe('hills', () => {
  it('a steep street with a heavy load and half the throttle: slow, but never stuck (Salvador, 23 November)', () => {
    for (const kind of ['sedan', 'van'] as const) {
      const r = climb(kind, true, 0.5, 0.3);
      expect(r.metres).toBeGreaterThan(20);
      expect(r.speed).toBeGreaterThan(1);
    }
  });

  it('still harder uphill: the same car is much slower up a steep street than on the flat', () => {
    const up = climb('sedan', false, 1, 0.3, 10);
    const flat = climb('sedan', false, 1, 0, 10);
    expect(up.metres).toBeLessThan(flat.metres * 0.6);
  });

  it('with the foot off, a car standing on a hill stays where it is', () => {
    const r = climb('sedan', false, 0, 0.3, 5);
    expect(Math.abs(r.metres)).toBeLessThan(0.01);
  });
});
