import { describe, expect, it } from 'vitest';
import { answer, dayRent, HOLD_DAYS, newDay, nextUpgrade, readTenants, tenantOf, upgradeShare, type Tenants } from '../src/game/tenants';

const fresh = (): Tenants => ({ v: 1, t: [] });

describe('tenants', () => {
  it('pays full rent at three stars, never under half, and nothing before moving day', () => {
    expect(dayRent(200, { due: 0, stars: 3, up: 0 })).toBe(200);
    expect(dayRent(200, { due: 0, stars: 2, up: 0 })).toBe(150);
    expect(dayRent(200, { due: 0, stars: 1, up: 0 })).toBe(100);
    expect(dayRent(200, { due: 0, stars: 3, up: 0, ask: 'move' })).toBe(0);
  });

  it('keeps the rent at the building, up to three days of it', () => {
    const t = fresh();
    for (let d = 1; d <= 5; d++) newDay(t, [100], [false], `2026-11-0${d}`);
    expect(t.t[0].due).toBe(100 * HOLD_DAYS);
  });

  it('takes a star for an ask left open, and gives one back for an answer, with a tip', () => {
    const t = fresh();
    tenantOf(t, 0).ask = 'pipe';
    newDay(t, [200], [true], '2026-11-01');
    expect(t.t[0].stars).toBe(2);
    expect(t.t[0].due).toBe(150);
    t.t[0].ask = 'locks';
    expect(answer(t, 0, 200)).toBe(50);
    expect(t.t[0].stars).toBe(3);
    expect(t.t[0].ask).toBeUndefined();
    // stars never fall under one
    t.t[0].stars = 1;
    t.t[0].ask = 'repair';
    newDay(t, [200], [true], '2026-11-02');
    expect(t.t[0].stars).toBe(1);
  });

  it('asks on some days and not others, the same for everyone on a day', () => {
    let asked = 0;
    for (let d = 0; d < 200; d++) {
      const t = fresh();
      newDay(t, [100], [true], `day-${d}`);
      if (t.t[0].ask) asked++;
    }
    expect(asked).toBeGreaterThan(60);
    expect(asked).toBeLessThan(140);
    const a = fresh();
    const b = fresh();
    newDay(a, [100, 100, 100], [true, true, true], '2026-11-18');
    newDay(b, [100, 100, 100], [true, true, true], '2026-11-18');
    expect(a.t.map((x) => x.ask)).toEqual(b.t.map((x) => x.ask));
    // a home not asking yet never does
    const c = fresh();
    for (let d = 0; d < 30; d++) newDay(c, [100], [false], `d${d}`);
    expect(c.t[0].ask).toBeUndefined();
  });

  it('makes each upgrade dearer and worth less than the one before', () => {
    const t = { due: 0, stars: 3, up: 0 };
    const seen: number[] = [];
    let u = nextUpgrade(200, t);
    while (u) {
      seen.push(u.cost / u.adds);
      t.up++;
      u = nextUpgrade(200, t);
    }
    expect(seen.length).toBe(4);
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeGreaterThan(seen[k - 1]);
    expect(upgradeShare(4)).toBeCloseTo(1.29);
    expect(dayRent(200, t)).toBe(258);
  });

  it('reads what is kept, and nothing odd', () => {
    const t = readTenants('{"v":1,"t":[{"due":40,"stars":9,"up":2,"ask":"pipe"},{"ask":"steal"}]}');
    expect(t.t[0]).toEqual({ due: 40, stars: 3, up: 2, ask: 'pipe' });
    expect(t.t[1]).toEqual({ due: 0, stars: 3, up: 0 });
    expect(readTenants('nonsense').t).toEqual([]);
  });
});
