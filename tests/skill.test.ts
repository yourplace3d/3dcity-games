import { describe, expect, it } from 'vitest';
import { Car } from '../src/game/cars';
import type { World } from '../src/game/world';
import {
  afterCrash,
  CHAIN_S,
  CRASH_COST,
  CRASH_KNOCK,
  DRIFT_SLIP,
  DRIFT_SPEED,
  levelOf,
  LEVELS,
  MAX_LEVEL,
  rankOf,
  readSkill,
  SkillTracker,
  slipOf,
  type Body,
  type Me,
  type SkillEvent,
} from '../src/game/skill';

/** an open, flat world with nothing in it */
const flat = { half: 5000, groundY: () => 0, inWater: () => false, solids: { push: () => null } } as unknown as World;

function body(x: number, y: number, th: number, v: number, extra: Partial<Me> = {}): Me {
  return { x, y, th, vx: Math.cos(th) * v, vy: Math.sin(th) * v, r: 0.95, a: 1.2, offs: [1, -1], spec: { len: 4.3 }, knock: 0, ...extra };
}

function tracker(total = 0) {
  const events: SkillEvent[] = [];
  const kept: number[] = [];
  const t = new SkillTracker({ ...readSkill(null), total }, (s) => kept.push(s.total));
  return { t, events, kept, emit: (e: SkillEvent) => events.push(e) };
}

/**
 * Drive past a car coming the other way, `gap` metres apart side to side (a lane over), at `v` m/s each;
 * the other car is at the origin going west, you go east from 20 m back.
 */
function pass(tr: ReturnType<typeof tracker>, gap: number, v = 14, otherV = 8): void {
  const other = {} as object;
  const side = 0.95 * 2 + gap;
  for (let i = 0; i <= 40; i++) {
    const t = i * 0.05;
    const me = body(-20 + v * t, side, 0, v);
    const o: Body = body(-otherV * t, 0, Math.PI, otherV);
    tr.t.step(0.05, me, [[other, o]], tr.emit);
  }
}

describe('driving skill: near misses', () => {
  it('counts a close pass at speed, more for a closer one', () => {
    const a = tracker();
    pass(a, 0.9);
    const b = tracker();
    pass(b, 0.2);
    const pa = a.events.find((e) => e.kind === 'move');
    const pb = b.events.find((e) => e.kind === 'move');
    expect(pa).toMatchObject({ move: 'near' });
    expect(pb).toMatchObject({ move: 'near' });
    expect((pb as { points: number }).points).toBeGreaterThan((pa as { points: number }).points);
  });

  it('does not count a wide pass, a slow one, or a touch', () => {
    const wide = tracker();
    pass(wide, 2.5);
    const slow = tracker();
    pass(slow, 0.4, 5, 1);
    const touch = tracker();
    pass(touch, -0.1);
    for (const t of [wide, slow, touch]) expect(t.events.filter((e) => e.kind === 'move')).toEqual([]);
  });

  it('gives one near miss for the same car, not one for each time past it', () => {
    const tr = tracker();
    pass(tr, 0.5);
    const other = {} as object;
    // the same car object passed again at once: nothing new
    for (let i = 0; i <= 60; i++) {
      const t = i * 0.05;
      tr.t.step(0.05, body(-20 + 14 * t, 2.4, 0, 14), [[other, body(-8 * t, 0, Math.PI, 8)]], tr.emit);
    }
    expect(tr.events.filter((e) => e.kind === 'move').length).toBe(2);
  });
});

describe('driving skill: chains', () => {
  it('multiplies moves in quick succession and banks the chain once it goes quiet', () => {
    const tr = tracker();
    pass(tr, 0.6);
    pass(tr, 0.6);
    const moves = tr.events.filter((e): e is Extract<SkillEvent, { kind: 'move' }> => e.kind === 'move');
    expect(moves.map((m) => m.combo)).toEqual([1, 2]);
    expect(moves[1].points).toBe(moves[0].points * 2);
    expect(tr.events.some((e) => e.kind === 'banked')).toBe(false);
    for (let i = 0; i < (CHAIN_S + 0.2) / 0.05; i++) tr.t.step(0.05, body(0, 0, 0, 3), [], tr.emit);
    const banked = tr.events.find((e) => e.kind === 'banked');
    expect(banked).toMatchObject({ points: moves[0].points * 3, combo: 2 });
    expect(tr.t.save.total).toBe(moves[0].points * 3);
    expect(tr.kept).toEqual([moves[0].points * 3]);
  });

  it('banks the chain when you get out', () => {
    const tr = tracker();
    pass(tr, 0.6);
    tr.t.step(0.05, null, [], tr.emit);
    expect(tr.events.at(-1)).toMatchObject({ kind: 'banked' });
  });

  it('loses the open chain in a crash, and the crash costs a little', () => {
    const tr = tracker(250);
    pass(tr, 0.6);
    tr.t.step(0.05, body(0, 0, 0, 10, { knock: CRASH_KNOCK + 1 }), [], tr.emit);
    expect(tr.events.find((e) => e.kind === 'lost')).toBeTruthy();
    expect(tr.events.find((e) => e.kind === 'crash')).toMatchObject({ points: CRASH_COST, total: 250 - CRASH_COST });
    expect(tr.t.combo).toBe(0);
    // the same crash a moment later costs nothing more
    tr.t.step(0.05, body(0, 0, 0, 10, { knock: CRASH_KNOCK + 1 }), [], tr.emit);
    expect(tr.t.save.total).toBe(250 - CRASH_COST);
  });
});

describe('driving skill: levels', () => {
  it('finds the level and the next', () => {
    expect(levelOf(0)).toEqual({ level: 0, from: 0, next: LEVELS[1] });
    expect(levelOf(LEVELS[2])).toEqual({ level: 2, from: LEVELS[2], next: LEVELS[3] });
    expect(levelOf(1e9).next).toBeNull();
  });

  it('levels come slowly, each taking longer than the last', () => {
    expect(LEVELS.length).toBe(MAX_LEVEL);
    expect([LEVELS[1], LEVELS[2], LEVELS[4], LEVELS[9], LEVELS[19], LEVELS[29]]).toEqual([40, 200, 1200, 11400, 98800, 342200]);
    for (let i = 2; i < LEVELS.length; i++) expect(LEVELS[i] - LEVELS[i - 1]).toBeGreaterThan(LEVELS[i - 1] - LEVELS[i - 2]);
  });

  it('names levels by rank in fives, Legend only at the top', () => {
    expect([0, 4, 5, 9, 25, 28, 29].map(rankOf)).toEqual([0, 0, 1, 1, 5, 5, 6]);
  });

  it('never takes a crash below the level reached', () => {
    expect(afterCrash(LEVELS[1] + 3)).toBe(LEVELS[1]);
    expect(afterCrash(LEVELS[1])).toBe(LEVELS[1]);
    expect(afterCrash(LEVELS[1] + 50)).toBe(LEVELS[1] + 50 - CRASH_COST);
    expect(afterCrash(4)).toBe(0);
  });

  it('says when a chain reaches a new level', () => {
    const tr = tracker(LEVELS[1] - 1);
    pass(tr, 0.6);
    tr.t.step(0.05, null, [], tr.emit);
    expect(tr.events.at(-1)).toMatchObject({ kind: 'banked', levelUp: 1 });
  });

  it('reads what was kept, and nothing broken', () => {
    expect(readSkill('{"total":120,"near":4,"drift":"x","bestChain":-3}')).toEqual({ total: 120, near: 4, drift: 0, bestChain: 0, bestCombo: 0 });
    expect(readSkill('nonsense').total).toBe(0);
  });
});

describe('driving skill: drifts, with the real car', () => {
  /** Drive a sedan at `v` m/s, then turn full lock for `s` seconds, with or without the handbrake. */
  function corner(v: number, handbrake: boolean, s = 1.6) {
    const car = new Car('sedan', '#c8362e');
    car.driver = 'player';
    car.vx = v;
    const tr = tracker();
    let most = 0;
    let fastSlide = 0;
    for (let i = 0; i < s / 0.02; i++) {
      Object.assign(car.controls, { throttle: 1, steer: 1, handbrake });
      car.step(0.02, flat);
      most = Math.max(most, slipOf(car));
      if (car.speed >= DRIFT_SPEED && slipOf(car) >= DRIFT_SLIP) fastSlide += 0.02;
      tr.t.step(0.02, car, [], tr.emit);
    }
    Object.assign(car.controls, { throttle: 1, steer: 0, handbrake: false });
    for (let i = 0; i < 50; i++) {
      car.step(0.02, flat);
      tr.t.step(0.02, car, [], tr.emit);
    }
    return { most, fastSlide, moves: tr.events.filter((e) => e.kind === 'move') };
  }

  it('counts a handbrake turn at speed as a drift', () => {
    const r = corner(18, true);
    expect(r.moves).toMatchObject([{ move: 'drift' }]);
  });

  it('does not count an ordinary full-lock turn, slow or fast', () => {
    for (const v of [9, 14, 22, 30]) expect(corner(v, false).moves, `${v} m/s`).toEqual([]);
  });
});
