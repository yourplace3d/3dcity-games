import { describe, expect, it } from 'vitest';
import { underParts, type TileBuilding } from '../src/geo/tiles';

const box = (x0: number, y0: number, x1: number, y1: number) => ({ outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Array<[number, number]>, holes: [] });
const b = (poly: ReturnType<typeof box>, height: number, minHeight = 0, id = ''): TileBuilding => ({ poly, height, minHeight, heightKnown: true, id });

describe('outlines under building parts', () => {
  it('puts an outline back under parts that only sit on its roof', () => {
    const outline = b(box(0, 0, 40, 20), 5, 0, 'o');
    const roof = [b(box(5, 5, 10, 10), 24, 20), b(box(20, 5, 30, 12), 23, 18)];
    const base = underParts(roof, [outline]);
    expect(base).toHaveLength(1);
    expect(base[0].minHeight).toBe(0);
    // up to the lowest part above it, not the 5 m the tiles fall back to
    expect(base[0].height).toBe(18);
    expect(base[0].id).toBe('o');
  });

  it('leaves the outline out when its parts stand on the ground', () => {
    const outline = b(box(0, 0, 40, 20), 20);
    const parts = [b(box(0, 0, 40, 20), 18), b(box(5, 5, 10, 10), 24, 18)];
    expect(underParts(parts, [outline])).toHaveLength(0);
  });

  it('keeps an outline whose parts lie elsewhere at its own height', () => {
    const outline = b(box(0, 0, 40, 20), 15);
    const elsewhere = [b(box(100, 100, 110, 110), 24, 20)];
    expect(underParts(elsewhere, [outline])).toEqual([{ ...outline, minHeight: 0, height: 15 }]);
  });
});
