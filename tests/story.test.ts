import { describe, expect, it } from 'vitest';
import { addPending, advance, begin, BUILT, finished, goal, keep, met, none, noteJob, readStory, SCENES, shown, type Snapshot, type Story } from '../src/game/story';
import { namesFor } from '../src/game/names';

const snap = (o: Partial<Snapshot> = {}): Snapshot => ({ delivered: 0, homes: 0, reno: null, saved: 0, partied: false, building: false, ...o });
const D1 = '2026-11-26';
const D2 = '2026-11-27';
const D3 = '2026-11-28';

/** Move on with what the player has, and say which chapters finished and which opened. */
function play(s: Story, sn: Snapshot, day: string) {
  return advance(s, sn, day);
}

describe('the story', () => {
  it('starts a new player at chapter 1, open today', () => {
    const s = begin(snap(), D1);
    expect(s.open).toBe(1);
    expect(s.opened).toBe(D1);
    expect(s.done).toEqual({});
  });

  it('plays straight through to the first flat on the first visit', () => {
    let s = begin(snap(), D1);
    let r = play(s, snap({ delivered: 1 }), D1);
    expect(r.finished).toEqual([1]);
    expect(r.opened).toBe(2);
    s = r.story;
    r = play(s, snap({ delivered: 2 }), D1);
    expect(r.finished).toEqual([2]);
    expect(r.opened).toBe(3);
    s = r.story;
    // bought, not yet repaired: chapter 3 goes on
    r = play(s, snap({ delivered: 2, homes: 1, reno: 'flat' }), D1);
    expect(r.finished).toEqual([]);
    s = r.story;
    // repaired: chapter 3 is done, and chapter 4 waits for another day
    r = play(s, snap({ delivered: 3, homes: 1, reno: 'buy' }), D1);
    expect(r.finished).toEqual([3]);
    expect(r.opened).toBeNull();
    expect(r.story.open).toBe(4);
    expect(r.story.opened).toBe('');
    // the next day it opens
    r = play(r.story, snap({ delivered: 3, homes: 1, reno: 'buy' }), D2);
    expect(r.opened).toBe(4);
    expect(r.story.opened).toBe(D2);
  });

  it('opens one chapter a day from chapter 4 on, and none twice on a day', () => {
    let s: Story = { ...none(), open: 4, opened: D2, last: D2, first: D1, done: { 1: { day: D1 }, 2: { day: D1 }, 3: { day: D1 } } };
    const banked = snap({ delivered: 5, homes: 1, reno: 'buy', saved: 500 });
    let r = play(s, banked, D2);
    expect(r.finished).toEqual([4]);
    expect(r.opened).toBeNull();
    s = r.story;
    expect(play(s, banked, D2).opened).toBeNull();
    r = play(s, banked, D3);
    expect(r.opened).toBe(5);
  });

  it('opens a waiting chapter on the day the one before is done, if that one opened on an earlier day', () => {
    const s: Story = { ...none(), open: 4, opened: D1, last: D1, first: D1, done: { 1: { day: D1 }, 2: { day: D1 }, 3: { day: D1 } } };
    const r = play(s, snap({ delivered: 5, homes: 1, reno: 'buy', saved: 500 }), D3);
    expect(r.finished).toEqual([4]);
    expect(r.opened).toBe(5);
  });

  it('counts a chapter done before it opened, and moves on', () => {
    // chapter 4 waits for its day, but the player has paid in already
    const s: Story = { ...none(), open: 4, opened: '', last: D1, first: D1, done: { 1: { day: D1 }, 2: { day: D1 }, 3: { day: D1 } } };
    const r = play(s, snap({ delivered: 5, homes: 1, reno: 'buy', saved: 100 }), D1);
    expect(r.finished).toEqual([4]);
    // chapter 5 still waits: it is the same day
    expect(r.opened).toBeNull();
    expect(r.story.open).toBe(5);
  });

  it('ticks what a player who is further on has done, silently', () => {
    const s = begin(snap({ delivered: 300, homes: 12, reno: 'done', saved: 5000, partied: true, building: true }), D1);
    expect(Object.keys(s.done).map(Number)).toEqual([1, 2, 3, 4, 6, 7]);
    expect(Object.values(s.done).every((d) => d.silent)).toBe(true);
    // chapter 5 is the one to play: the people at the stations
    expect(s.open).toBe(5);
    expect(s.opened).toBe(D1);
  });

  it('finishes chapter 5 with a job of each kind, and then waits: chapter 8 is not built', () => {
    let s = begin(snap({ delivered: 300, homes: 12, reno: 'done', saved: 5000, partied: true, building: true }), D1);
    const sn = snap({ delivered: 300, homes: 12, reno: 'done', saved: 5000, partied: true, building: true });
    s = noteJob(noteJob(s, 'supply'), 'rush');
    expect(play(s, sn, D1).finished).toEqual([]);
    s = noteJob(s, 'clean');
    const r = play(s, sn, D1);
    expect(r.finished).toEqual([5]);
    expect(r.story.open).toBe(BUILT + 1);
    expect(play(r.story, sn, D3).opened).toBeNull();
  });

  it('asks for a repaired first flat in chapter 3, and a whole building with nothing left to repair in chapter 7', () => {
    const s = none();
    expect(finished(3, snap({ homes: 1, reno: 'flat' }), s)).toBe(false);
    expect(finished(3, snap({ homes: 1, reno: 'buy' }), s)).toBe(true);
    expect(finished(3, snap({ homes: 3, reno: null }), s)).toBe(true);
    expect(finished(7, snap({ homes: 1, building: true, reno: 'rest' }), s)).toBe(false);
    expect(finished(7, snap({ homes: 1, building: true, reno: 'done' }), s)).toBe(true);
    expect(finished(8, snap({ building: true, partied: true }), s)).toBe(false);
  });

  it('names the people at the stations still to meet in chapter 5', () => {
    const names = namesFor(49.4521, 11.0767);
    const s: Story = { ...none(), names, kinds: ['supply'] };
    const g = goal(5, { ...snap(), town: 'Nuremberg', buildingsAfter: 6 }, s);
    expect(g.text).toBe(`Do a job for ${names.flame} at the fire station and ${names.shield} at the police station.`);
    expect(g.way).toBe('station');
  });

  it('lets chapter 5’s people write only if they have not yet', () => {
    let s = none();
    s = keep(s, { who: 'pump', from: 'Mira · the pump', text: 'Hi', day: D1 });
    expect(met(s)).toEqual(['pump']);
    expect(SCENES.regulars(s).map(([w]) => w)).toEqual(['flame', 'shield']);
  });

  it('hands back the same story when nothing moved, so nothing is written again', () => {
    const s = begin(snap({ delivered: 1 }), D1);
    const r = play(s, snap({ delivered: 1 }), D1);
    expect(r.story).toBe(s);
    expect(play(s, snap({ delivered: 2 }), D1).story).not.toBe(s);
    expect(noteJob(noteJob(s, 'rush'), 'rush').kinds).toEqual(['rush']);
    const once = noteJob(s, 'rush');
    expect(noteJob(once, 'rush')).toBe(once);
  });

  it('keeps people’s messages until they are shown, never the game’s lines', () => {
    let s = addPending(none(), [['game', 'A line'], ['friends', 'Hey'], ['pump', 'Oil']]);
    expect(s.pending).toEqual([{ who: 'friends', text: 'Hey' }, { who: 'pump', text: 'Oil' }]);
    expect(readStory(JSON.stringify(s)).pending).toEqual(s.pending);
    s = shown(s, 'friends', 'Hey');
    expect(s.pending).toEqual([{ who: 'pump', text: 'Oil' }]);
    expect(shown(s, 'flame', 'nothing')).toBe(s);
  });

  it('says whole buildings are for sale only from the number of homes the game asks', () => {
    const at = (homes: number) => goal(7, { ...snap({ homes }), town: 'Nuremberg', buildingsAfter: 6 }, none()).text;
    expect(at(5)).toBe('Own a whole building. They are for sale once you have 6 homes.');
    expect(at(6)).toBe('Own a whole building: stop beside one to see its price.');
  });

  it('reads back what it stored, and nothing broken', () => {
    const s = begin(snap({ delivered: 2 }), D1);
    const t = keep({ ...s, names: namesFor(52.52, 13.405), kinds: ['rush'], said: ['x'] }, { who: 'friends', from: 'Jo', text: 'Hey', day: D1 });
    expect(readStory(JSON.stringify({ v: 1, ...t }))).toEqual(t);
    expect(readStory('{"open": 99, "done": {"1": {"day": "nope"}}, "kinds": ["fly"], "inbox": [{"who": "x"}]}')).toEqual({ ...none(), open: BUILT + 1 });
    expect(readStory('not json')).toEqual(none());
  });
});
