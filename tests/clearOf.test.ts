import { describe, expect, it } from 'vitest';
import { clearOf, type Box } from '../src/clearOf';

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

describe('the top right of the screen', () => {
  it('on a phone: the radio’s bar goes under the little map, and the panel under the bar', () => {
    // a phone 390 px wide: the little map at the right, the bar over it, the panel under where the bar was
    const { bar, panel } = clearOf(box(274, 104, 378, 208), box(117, 132, 378, 179), box(45, 210, 345, 411));
    expect(bar).toEqual(box(117, 216, 378, 263));
    expect(panel).toEqual(box(45, 271, 345, 472));
  });

  it('on an iPad: the panel goes under the bar that hid its top line', () => {
    const { bar, panel } = clearOf(box(12, 150, 144, 282), box(921, 132, 1182, 179), box(862, 170, 1182, 380));
    expect(bar).toEqual(box(921, 132, 1182, 179));
    expect(panel).toEqual(box(862, 187, 1182, 397));
  });

  it('with the little map in the top right corner: the panel beside it, not over it', () => {
    // a computer: the map at the top right, the radio's bar above it, the panel where the map is
    const { panel } = clearOf(box(1092, 168, 1268, 344), box(1034, 118, 1268, 162), box(948, 170, 1268, 380));
    expect(panel).toEqual(box(764, 170, 1084, 380));
  });

  it('below the little map where there is no room beside it', () => {
    const { panel } = clearOf(box(274, 104, 378, 208), null, box(45, 170, 345, 371));
    expect(panel).toEqual(box(45, 216, 345, 417));
  });

  it('leaves them where they are when nothing is met', () => {
    const bar = box(1034, 118, 1268, 162);
    const panel = box(948, 170, 1268, 380);
    expect(clearOf(box(12, 612, 188, 788), bar, panel)).toEqual({ bar, panel });
    expect(clearOf(null, null, panel)).toEqual({ bar: null, panel });
  });
});
