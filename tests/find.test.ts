import { describe, expect, it } from 'vitest';
import { closeIn, describeCar, findPay, LOOKS, NEAR_M, SEE_M, seen, zoneAround, ZONE_MIN, ZONE_R } from '../src/game/find';
import { FIND_SCENE, findDue, none, offer, readStory, REGULARS, say, type Story } from '../src/game/story';

describe('the circle to search', () => {
  it('holds the car, never in its middle', () => {
    for (let k = 0; k < 200; k++) {
      const z = zoneAround([100, -50]);
      const d = Math.hypot(z.x - 100, z.y + 50);
      expect(z.r).toBe(ZONE_R);
      expect(d).toBeGreaterThanOrEqual(ZONE_R * 0.3 - 1e-9);
      expect(d).toBeLessThan(ZONE_R * 0.7);
    }
  });

  it('closes in on the car, the car always inside, down to its smallest', () => {
    let z = zoneAround([0, 0], ZONE_R, () => 0.99);
    for (let k = 0; k < 8; k++) {
      const next = closeIn(z, [0, 0]);
      expect(next.r).toBeLessThanOrEqual(z.r);
      expect(next.r).toBeGreaterThanOrEqual(ZONE_MIN);
      expect(Math.hypot(next.x, next.y)).toBeLessThanOrEqual(next.r * 0.7 + 1e-9);
      z = next;
    }
    expect(z.r).toBe(ZONE_MIN);
  });
});

describe('seeing the car', () => {
  it('near with a clear view, or very near whatever is between', () => {
    expect(seen(SEE_M - 1, true)).toBe(true);
    expect(seen(SEE_M - 1, false)).toBe(false);
    expect(seen(NEAR_M - 1, false)).toBe(true);
    expect(seen(SEE_M + 1, true)).toBe(false);
  });

  it('has a look the other cars never have, said in words', () => {
    expect(LOOKS.length).toBeGreaterThan(0);
    expect(describeCar('pink', 'van')).toBe('a pink van');
    expect(findPay(100)).toBe(150);
    expect(findPay(600)).toBe(450);
  });
});

describe('the pump\'s scene', () => {
  const D0 = '2026-11-25';
  const D1 = '2026-11-26';
  const D2 = '2026-11-27';
  const after5 = (o: Partial<Story> = {}): Story => ({ ...none(), done: { 1: { day: D0 }, 2: { day: D0 }, 3: { day: D0 }, 4: { day: D0 }, 5: { day: D1 } }, open: 6, opened: D1, last: D1, said: [REGULARS], ...o });

  it('comes once chapter 5 is done, from the next day on', () => {
    expect(findDue(none(), D2)).toBe(false);
    expect(findDue(after5(), D1)).toBe(false);
    expect(findDue(after5(), D2)).toBe(true);
    // not from a stranger: only once the people at the stations have said hello
    expect(findDue(after5({ said: [] }), D2)).toBe(false);
  });

  it('waits while a chapter that opened today is still to do; one left from another day doesn\'t hold it', () => {
    expect(findDue(after5({ opened: D2, last: D2 }), D2)).toBe(false);
    expect(findDue(after5({ opened: D1 }), D2)).toBe(true);
    // the next chapter waiting for its day
    expect(findDue(after5({ opened: '' }), D2)).toBe(true);
  });

  it('is offered once a day until it is played, and kept', () => {
    const s = offer(after5(), FIND_SCENE, D2);
    expect(findDue(s, D2)).toBe(false);
    expect(findDue(s, '2026-11-28')).toBe(true);
    expect(findDue(say(s, FIND_SCENE), '2026-11-28')).toBe(false);
    expect(readStory(JSON.stringify(s)).offered).toEqual({ [FIND_SCENE]: D2 });
    expect(readStory('{"offered": {"x": "nope", "y": 3}}').offered).toEqual({});
  });
});
