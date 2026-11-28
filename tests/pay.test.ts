import { describe, expect, it } from 'vitest';
import { JOB_MAX, jobCash, jobWorth, openPay, PAY_TOP, type JobKind } from '../src/game/services';
import { findPay } from '../src/game/find';

const KINDS: JobKind[] = ['plain', 'supply', 'rush', 'clean'];

describe('what a job pays (the owner: "Jobs should not pay more than 300 ever")', () => {
  it('never more than $300 in cash, whatever the job is worth', () => {
    expect(JOB_MAX).toBe(300);
    for (const kind of KINDS) {
      // a long way after fifty deliveries, as open jobs had come to pay, and a clock barely touched
      for (const pay of [50, 180, 300, 900, 2900]) {
        for (const left of [0, 8, 45, 200]) {
          for (const whole of [true, false]) expect(jobCash(jobWorth(kind, openPay(kind, pay), left, whole))).toBeLessThanOrEqual(300);
        }
      }
    }
    expect(jobCash(2900)).toBe(300);
    expect(jobCash(180)).toBe(180);
  });

  it('an open job’s own pay stops a little under that, by kind, and the clean run still pays best', () => {
    for (const kind of KINDS) {
      expect(PAY_TOP[kind]).toBeLessThan(JOB_MAX);
      expect(openPay(kind, 5000)).toBe(PAY_TOP[kind]);
      // a short way pays what it comes to
      expect(openPay(kind, 120)).toBe(120);
    }
    expect(Math.max(...KINDS.map((k) => PAY_TOP[k]))).toBe(PAY_TOP.clean);
  });

  it('what comes on top still shows at the top: a supply run without a dent, seconds left on a rush job', () => {
    const top = (kind: JobKind, left: number, whole: boolean) => jobCash(jobWorth(kind, PAY_TOP[kind], left, whole));
    // a fifth more for a car that took no harm
    expect(top('supply', 0, true)).toBeGreaterThan(top('supply', 0, false));
    expect(top('supply', 0, true)).toBe(280);
    // each second left pays three times on a rush job
    expect(top('rush', 10, false)).toBeGreaterThan(top('rush', 0, false));
    expect(top('rush', 10, false)).toBe(280);
    expect(top('plain', 10, false)).toBe(280);
    // and every kind, done well, reaches the most a job pays
    for (const kind of KINDS) expect(top(kind, 30, true)).toBe(300);
  });

  it('a job is worth its pay, $2 a second left, $6 on a rush job, and a fifth more for a whole supply run', () => {
    expect(jobWorth('plain', 200, 0, true)).toBe(200);
    expect(jobWorth('plain', 200, 12, false)).toBe(220);
    expect(jobWorth('rush', 200, 12, false)).toBe(270);
    expect(jobWorth('supply', 200, 0, true)).toBe(240);
    expect(jobWorth('supply', 200, 0, false)).toBe(200);
    expect(jobWorth('clean', 200, 0, true)).toBe(200);
  });

  it('a run of three still counts the whole worth: its score compares with runs made before', () => {
    // the third delivery of a run, 800 m away: worth more than a job pays in cash
    const worth = jobWorth('plain', 450, 15, true);
    expect(worth).toBe(480);
    expect(jobCash(worth)).toBe(300);
  });

  it('the car found for the pump pays no more either', () => {
    for (const m of [0, 250, 520, 3000]) expect(findPay(m)).toBeLessThanOrEqual(JOB_MAX);
  });
});
