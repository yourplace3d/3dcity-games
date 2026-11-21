import { describe, expect, it } from 'vitest';
import type { LineFeature } from '../src/geo/osm';
import { RoadNet } from '../src/game/roads';

const road = (pts: LineFeature['pts'], bridge = false): LineFeature => ({ kind: 'minor', pts, widthM: 6, bridge });
const length = (pts: LineFeature['pts']): number => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

describe('driving routes', () => {
  it('stops at a target between junctions instead of overshooting and doubling back', () => {
    const net = new RoadNet([road([[0, 0], [100, 0]]), road([[0, -100], [0, 0]])], 750);
    const field = net.field(60, 0)!;
    const route = net.route(field, 0, -80)!;
    expect(route.metres).toBe(141); // one metre to change lines at the junction
    expect(length(route.pts)).toBeCloseTo(140);
    expect(route.pts.at(-1)).toEqual([60, 0]);
    expect(route.pts.every(([x]) => x <= 60)).toBe(true);
  });

  it('can take the shorter route around a long curved stretch even when both ends are on it', () => {
    const net = new RoadNet([
      road([[0, 0], [0, 100], [100, 100], [100, 0]]),
      road([[0, 0], [100, 0]]),
    ], 750);
    const route = net.route(net.field(100, 10)!, 0, 10)!;
    expect(route.metres).toBe(122);
    expect(length(route.pts)).toBeCloseTo(120);
    expect(route.pts.at(-1)).toEqual([100, 10]);
  });

  it('follows bends on a direct approach and works in either direction', () => {
    const net = new RoadNet([road([[0, 0], [50, 0], [50, 100]])], 750);
    const forward = net.route(net.field(50, 80)!, 20, 0)!;
    const backward = net.route(net.field(20, 0)!, 50, 80)!;
    expect(forward.pts).toEqual([[20, 0], [50, 0], [50, 80]]);
    expect(backward.pts).toEqual([...forward.pts].reverse());
    expect(forward.metres).toBe(110);
    expect(backward.metres).toBe(110);
  });

  it('does not route between a bridge and the street underneath', () => {
    const net = new RoadNet([road([[-100, 0], [100, 0]], true), road([[0, -100], [0, 100]])], 750);
    expect(net.route(net.field(80, 0)!, 0, 80)).toBeNull();
  });
});

describe('one-way streets', () => {
  const oneway = (pts: LineFeature['pts'], dir: 1 | -1): LineFeature => ({ ...road(pts), oneway: dir });
  // a T: the main road runs west to east, a side street leaves it at x = 50 going north
  const tee = (side: LineFeature) => new RoadNet([road([[0, 0], [100, 0]]), side], 750);

  it('offers traffic only the way a one-way street goes', () => {
    for (const [dir, expected] of [[1, 1], [-1, null]] as const) {
      // the side street is drawn from the junction northwards
      const net = tee(oneway([[50, 0], [50, 100]], dir));
      const p = { line: 0, s: 40, dir: 1 as const };
      const offered: number[] = [];
      net.advance(p, 20, 'drive', (options) => {
        for (const o of options) if (o.line === 1) offered.push(o.dir);
        return null;
      }, true);
      expect([...new Set(offered)]).toEqual(expected === null ? [] : [expected]);
    }
  });

  it('still offers both ways when one-way streets are not kept to (a police chase)', () => {
    const net = tee(oneway([[50, 0], [50, 100]], -1));
    const offered: number[] = [];
    net.advance({ line: 0, s: 40, dir: 1 }, 20, 'drive', (options) => {
      for (const o of options) if (o.line === 1) offered.push(o.dir);
      return null;
    });
    expect([...new Set(offered)]).toEqual([1]);
  });

  it('turns into a one-way street the wrong way rather than stopping where the map leaves no other way', () => {
    // a dead end: the only way on from the end of the first road is a one-way street towards it
    const net = new RoadNet([road([[0, 0], [100, 0]]), oneway([[100, 0], [200, 0]], -1)], 750);
    const p = { line: 0, s: 90, dir: 1 as const };
    net.advance(p, 20, 'drive', (options) => options[0] ?? null, true);
    expect(p.line).toBe(1);
  });

  it('puts traffic down facing the way a one-way street goes', () => {
    const net = new RoadNet([oneway([[-100, 0], [100, 0]], -1)], 750);
    for (let k = 0; k < 20; k++) expect(net.randomPlace('traffic', 0, 0, 10, 90)?.dir).toBe(-1);
  });

  it('keeps footpaths two-way', () => {
    const net = new RoadNet([oneway([[-100, 0], [100, 0]], 1)], 750);
    expect(net.lines[0].oneway).toBe(1);
    for (let k = 0; k < 20; k++) expect([1, -1]).toContain(net.randomPlace('walk', 0, 0, 10, 90)?.dir);
  });
});
