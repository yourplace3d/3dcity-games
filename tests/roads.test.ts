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

describe('railway for trains', () => {
  const rail = (pts: LineFeature['pts'], widthM = 3): LineFeature => ({ kind: 'rail', pts, widthM, bridge: false });

  it('a bit of track too short to run on gets no train, but is still track', () => {
    // a line up for 6 m between two tunnels, and a long railway elsewhere
    const net = new RoadNet([rail([[0, 0], [6, 0]]), rail([[-300, 100], [300, 100]])], 750);
    const stub = net.lines.find((l) => l.len < 10)!;
    expect(stub.train).toBe(true);
    expect(stub.short).toBe(true);
    let found = 0;
    for (let k = 0; k < 50; k++) {
      const p = net.randomPlace('train', 0, 0, 0, 600);
      if (!p) continue;
      found++;
      expect(net.lines[p.line].short).toBe(false);
    }
    expect(found).toBeGreaterThan(0);
    expect(net.nearestAlong(3, 0, 20, 'train', 1, 0)).toBeNull();
    // stops and drawing still see it
    expect(net.nearest(3, 0, 20, 'train')).not.toBeNull();
    expect(net.hasTrains).toBe(true);
  });

  it('short pieces joined into a long enough stretch do run', () => {
    const pieces = Array.from({ length: 10 }, (_, i): LineFeature => rail([[i * 25, 0], [(i + 1) * 25, 0]]));
    const net = new RoadNet(pieces, 750);
    expect(net.lines.every((l) => !l.short)).toBe(true);
    expect(net.nearestAlong(30, 0, 20, 'train', 1, 0)).not.toBeNull();
  });

  it('a short tram siding gets no tram', () => {
    const net = new RoadNet([rail([[0, 0], [40, 0]], 1.6), rail([[0, 200], [300, 200]], 1.6)], 750);
    expect(net.lines.map((l) => l.short)).toEqual([true, false]);
    expect(net.hasTrams).toBe(true);
  });

  it('back on the rails, a tram takes its own track and not one crossing it', () => {
    // a tram track east-west, and another crossing it north-south
    const net = new RoadNet([rail([[-300, 0], [300, 0]], 1.6), rail([[0, -300], [0, 300]], 1.6)], 750);
    // knocked off just beside the crossing line, facing east
    const n = net.nearestAlong(1, 4, 8, 'tram', 1, 0)!;
    expect(net.lines[n.line].pts[0]).toEqual([-300, 0]);
    // facing north, the crossing line is its own
    const m = net.nearestAlong(1, 4, 8, 'tram', 0, 1)!;
    expect(net.lines[m.line].pts[0]).toEqual([0, -300]);
  });
});
