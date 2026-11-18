import { afterEach, describe, expect, it, vi } from 'vitest';
import { jobLines, readReno, rentShare, wantsJob } from '../src/game/renovation';
import { HomesUi } from '../src/homesUi';
import type { Home } from '../src/game/homes';

afterEach(() => vi.unstubAllGlobals());

describe('the way to a first home and its building', () => {
  it('starts with nothing for a new player, and with nothing to repair for one who has a home', () => {
    expect(readReno(null, null, false)).toBeNull();
    expect(readReno(null, null, true)).toEqual({ stage: 'done' });
    // the older first-home mission
    expect(readReno(null, 'on', false)).toEqual({ stage: 'find' });
    expect(readReno(null, 'done', false)).toEqual({ stage: 'done' });
  });

  it('reads what was kept, and nothing broken', () => {
    expect(readReno(JSON.stringify({ stage: 'rest', units: 4, fixed: 2, told: true }), null, true)).toEqual({ stage: 'rest', units: 4, fixed: 2, told: true });
    expect(readReno(JSON.stringify({ stage: 'rest', units: 4, fixed: 99 }), null, true)?.fixed).toBe(3);
    expect(readReno('{nope', null, false)).toBeNull();
    expect(readReno(JSON.stringify({ stage: 'party' }), null, false)).toBeNull();
    // a building to repair without a home (a save from another device, say): the way starts again
    expect(readReno(JSON.stringify({ stage: 'flat', units: 4 }), null, false)).toBeNull();
  });

  it('pays no rent before the flat is repaired, then flat by flat', () => {
    expect(rentShare({ stage: 'flat', units: 4 })).toBe(0);
    expect(rentShare({ stage: 'buy', units: 4 })).toBe(1);
    expect(rentShare({ stage: 'rest', units: 4, fixed: 0 })).toBe(0.25);
    expect(rentShare({ stage: 'rest', units: 4, fixed: 2 })).toBe(0.75);
    expect(rentShare({ stage: 'paint', units: 4, fixed: 3 })).toBe(1);
    expect(rentShare(null)).toBe(1);
  });

  it('wants a package while there is something to repair or paint', () => {
    expect((['find', 'flat', 'buy', 'rest', 'paint', 'done'] as const).filter((stage) => wantsJob({ stage }))).toEqual(['flat', 'rest', 'paint']);
  });

  it('has a line for each kind of job, naming what it repairs', () => {
    const lines = jobLines({ stage: 'rest', units: 5, fixed: 1 });
    expect(lines.supply).toContain('flat 3 of 5');
    expect(lines.rush).toContain('flat 3 of 5');
    expect(jobLines({ stage: 'flat', units: 3 }).clean).toContain('your flat');
    expect(jobLines({ stage: 'paint', units: 3 }).plain).toContain('Paint for the outside');
  });

  it('counts a day with only a worn-down flat as paid, so the repair pays from the next day', () => {
    vi.stubGlobal('navigator', { webdriver: true });
    const home: Home = { id: '1', lat: 52.5, lon: 13.4, kind: 'flat', paid: 600, rent: 144, street: '', place: '', at: 0 };
    const game = { cash: 0 };
    const toast = vi.fn();
    const ui: HomesUi = Object.assign(Object.create(HomesUi.prototype), {
      host: { game, save: vi.fn(), toast },
      homes: { v: 1, homes: [home], paidDay: '2000-01-01' },
      reno: { stage: 'flat', units: 4 },
    });
    // back on a new day: nothing due while it is worn down
    expect(ui.payRent(true)).toBe(0);
    // repaired later that day: its rent starts tomorrow, as the game says
    Object.assign(ui, { reno: { stage: 'buy', units: 4, told: true } });
    expect(ui.payRent()).toBe(0);
    expect(game.cash).toBe(0);
    expect(toast).not.toHaveBeenCalled();
  });
});
