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
