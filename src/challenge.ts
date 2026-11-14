/**
 * A run to send to someone: the places of its deliveries, and the name, score and time to
 * beat. All of it travels in the link, so there is no server and nobody is asked who they are.
 * The score in a link is whatever the sender's browser wrote there.
 */
import type { Course } from './game/game';

export interface Challenge {
  name: string;
  score: number;
  seconds: number;
  place: string;
  course: Course;
}

const E5 = 1e5;

/** The text that stands for a challenge in a link: letters, digits, `-` and `_` only. */
export function packChallenge(c: Challenge): string {
  const { start, legs } = c.course;
  const lat0 = Math.round(start.lat * E5);
  const lon0 = Math.round(start.lon * E5);
  // every place as its distance from the start, which keeps the link short
  const pts = legs.flatMap((l) => [l.from, l.to]).flatMap((p) => [Math.round(p.lat * E5) - lat0, Math.round(p.lon * E5) - lon0]);
  const json = JSON.stringify([1, c.name.slice(0, 16), Math.round(c.score), Math.round(c.seconds), c.place.slice(0, 40), lat0, lon0, ...pts]);
  let bin = '';
  for (const b of new TextEncoder().encode(json)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A challenge from a link, or null when the text is not one. */
export function readChallenge(text: string): Challenge | null {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const a = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))) as unknown;
    if (!Array.isArray(a) || a[0] !== 1) return null;
    // a run has had five deliveries, and three since: the link says how many by its length
    const legs = (a.length - 7) / 4;
    if (!Number.isInteger(legs) || legs < 1 || legs > 5) return null;
    const [, name, score, seconds, place, lat0, lon0, ...pts] = a as [number, unknown, unknown, unknown, unknown, ...unknown[]];
    const nums = [score, seconds, lat0, lon0, ...pts];
    if (typeof name !== 'string' || typeof place !== 'string' || !nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    const [la, lo, ...d] = nums.slice(2) as number[];
    // a run stays within a few kilometres of where it began
    if (Math.abs(la) > 85 * E5 || Math.abs(lo) > 180 * E5 || d.some((v) => Math.abs(v) > 0.2 * E5)) return null;
    const at = (i: number) => ({ lat: (la + d[i * 2]) / E5, lon: (lo + d[i * 2 + 1]) / E5 });
    return {
      name: name.trim().slice(0, 16),
      score: Math.max(0, Math.min(1e7, Math.round(score as number))),
      seconds: Math.max(0, Math.min(86400, Math.round(seconds as number))),
      place: place.trim().slice(0, 40),
      course: { start: { lat: la / E5, lon: lo / E5 }, legs: Array.from({ length: legs }, (_, i) => ({ from: at(i * 2), to: at(i * 2 + 1) })) },
    };
  } catch {
    return null;
  }
}
