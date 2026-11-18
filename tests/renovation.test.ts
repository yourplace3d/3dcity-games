import { describe, expect, it } from 'vitest';
import { jobLines, readReno, rentShare, wantsJob } from '../src/game/renovation';

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
});
