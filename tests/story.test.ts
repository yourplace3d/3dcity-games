import { describe, expect, it } from 'vitest';
import { addNote, addPending, advance, begin, BUILT, finished, goal, hellosDue, keep, met, none, noteJob, readStory, record, REGULARS, SAID_MAX, say, SCENES, shown, type Snapshot, type Story } from '../src/game/story';
import { namesFor } from '../src/game/names';

const snap = (o: Partial<Snapshot> = {}): Snapshot => ({ delivered: 0, homes: 0, reno: null, saved: 0, partied: false, building: false, settled: 0, dispute: null, ...o });
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

  it('finishes chapter 5 with a job of each kind; chapter 8 opens on another day and ends with a dispute settled', () => {
    let s = begin(snap({ delivered: 300, homes: 12, reno: 'done', saved: 5000, partied: true, building: true }), D1);
    const sn = snap({ delivered: 300, homes: 12, reno: 'done', saved: 5000, partied: true, building: true });
    s = noteJob(noteJob(s, 'supply'), 'rush');
    expect(play(s, sn, D1).finished).toEqual([]);
    s = noteJob(s, 'clean');
    let r = play(s, sn, D1);
    expect(r.finished).toEqual([5]);
    // chapters 6 and 7 were done already: chapter 8, the tenants, waits for the next day
    expect(r.story.open).toBe(8);
    expect(r.story.opened).toBe('');
    r = play(r.story, sn, D3);
    expect(r.opened).toBe(8);
    // a dispute under way is not the end of it; settled, whichever way, it is
    r = play(r.story, { ...sn, dispute: 'court' }, D3);
    expect(r.finished).toEqual([]);
    r = play(r.story, { ...sn, settled: 1 }, D3);
    expect(r.finished).toEqual([8]);
    expect(r.story.open).toBe(BUILT + 1);
    expect(BUILT).toBe(8);
  });

  it('says what chapter 8 asks, as the dispute stands', () => {
    const st = { ...snap({ homes: 7, building: true }), town: 'Nuremberg', buildingsAfter: 6, disputeAt: 'your building on Königstraße' };
    expect(goal(8, st, none())).toEqual({ text: 'Your tenants have something to say: drive to one of your homes in Nuremberg.', way: 'home' });
    expect(goal(8, { ...st, dispute: 'talk' }, none()).text).toBe('The tenants in your building on Königstraße have stopped paying: stop beside it and talk to them.');
    expect(goal(8, { ...st, dispute: 'insist' }, none()).way).toBe('station');
    expect(goal(8, { ...st, dispute: 'court' }, none()).text).toContain('by the book');
    expect(goal(8, { ...st, dispute: 'moving' }, none()).way).toBeNull();
  });

  it('keeps the tenants\' notes, where they may show, and the story so far', () => {
    let s = addNote(none(), { who: 'tenants', text: 'Can we talk?', from: 'Lena and Max · your flat', anywhere: true });
    s = record(s, 'Königstraße: you met them halfway.', D1);
    const back = readStory(JSON.stringify(s));
    expect(back.pending).toEqual([{ who: 'tenants', text: 'Can we talk?', from: 'Lena and Max · your flat', anywhere: true }]);
    expect(back.sofar).toEqual([{ day: D1, text: 'Königstraße: you met them halfway.' }]);
    expect(readStory('{"sofar": [{"day": "x", "text": 1}], "pending": [{"who": "game", "text": "no"}]}').sofar).toEqual([]);
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

  it('says which chapters were done before they opened', () => {
    // chapter 5 opened today, chapter 6 waits: a party thrown today ticks it, early
    const s: Story = { ...none(), open: 6, opened: '', last: D1, first: D1, done: { 1: { day: D1 }, 2: { day: D1 }, 3: { day: D1 }, 4: { day: D1 }, 5: { day: D1 } } };
    const r = play(s, snap({ delivered: 9, homes: 1, reno: 'buy', saved: 10, partied: true }), D1);
    expect(r.finished).toEqual([6]);
    expect(r.early).toEqual([6]);
    // an open chapter is not early
    const t: Story = { ...s, opened: D1 };
    expect(play(t, snap({ delivered: 9, homes: 1, reno: 'buy', saved: 10, partied: true }), D1).early).toEqual([]);
  });

  it('in chapter 5, says that a job at any station counts away from home', () => {
    const s: Story = { ...none(), names: namesFor(49.4521, 11.0767), kinds: ['rush'] };
    const g = (away: boolean, kinds: Story['kinds']) => goal(5, { ...snap(), town: 'Nuremberg', buildingsAfter: 6, away }, { ...s, kinds }).text;
    expect(g(true, ['rush'])).toBe('Do a job at a fuel station and a police station: they count wherever you are.');
    expect(g(false, ['supply', 'rush', 'clean'])).toBe('Done: they all know you now.');
  });

  it('counts someone whose message still waits as met', () => {
    const s = addPending(none(), [['pump', 'Plaster for you']]);
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

  it('never finishes chapter 5 before it opens: a new player who did every kind of station job on day 1 still meets the people', () => {
    let s = begin(snap(), D1);
    s = play(s, snap({ delivered: 1 }), D1).story;
    s = play(s, snap({ delivered: 2 }), D1).story;
    s = play(s, snap({ delivered: 2, homes: 1, reno: 'flat' }), D1).story;
    // the flat's repair came from the pump, who wrote; then open jobs at the fire station and the police
    s = keep(s, { who: 'pump', from: 'Mira · the pump', text: 'Here is your plaster', day: D1 });
    s = noteJob(noteJob(noteJob(s, 'supply'), 'rush'), 'clean');
    const repaired = snap({ delivered: 5, homes: 1, reno: 'buy' });
    s = play(s, repaired, D1).story;
    expect(s.open).toBe(4);
    s = play(s, repaired, D2).story;
    // the bank: chapter 4 is done, and chapter 5 waits for its day though a job of each kind is done
    const banked = { ...repaired, saved: 100 };
    let r = play(s, banked, D2);
    expect(r.finished).toEqual([4]);
    expect(r.early).toEqual([]);
    expect(r.story.open).toBe(5);
    expect(r.story.opened).toBe('');
    expect(play(r.story, banked, D2).story).toBe(r.story);
    // its day: the two who have not written do, and the chapter asks for a job for each of them
    r = play(r.story, banked, D3);
    expect(r.opened).toBe(5);
    expect(r.finished).toEqual([]);
    expect(r.story.kinds).toEqual(['supply']);
    expect(SCENES.regulars(r.story).map(([w]) => w)).toEqual(['flame', 'shield']);
    expect(goal(5, { ...banked, town: 'Nuremberg', buildingsAfter: 6 }, r.story).text).toBe('Do a job for the fire station and the police station.');
    // one job for each, and it is done
    s = noteJob(noteJob(r.story, 'rush'), 'clean');
    expect(play(s, banked, D3).finished).toEqual([5]);
  });

  it('counts a job for someone who has not written only from the day they write', () => {
    // nobody met (the first home was not a worn-down flat), and a job of each kind done before chapter 5
    const s: Story = { ...none(), open: 5, opened: '', last: D1, first: D1, kinds: ['supply', 'rush', 'clean'], done: { 1: { day: D1 }, 2: { day: D1 }, 3: { day: D1 }, 4: { day: D1 } } };
    const r = play(s, snap({ delivered: 9, homes: 1, reno: 'done', saved: 10 }), D2);
    expect(r.opened).toBe(5);
    expect(r.story.kinds).toEqual([]);
    expect(SCENES.regulars(r.story).map(([w]) => w)).toEqual(['pump', 'flame', 'shield']);
    // someone whose message still waits to be shown has written
    const waiting = addPending(s, [['flame', 'A part for your boiler']]);
    expect(play(waiting, snap({ delivered: 9, homes: 1, reno: 'done', saved: 10 }), D2).story.kinds).toEqual(['rush']);
  });

  it('owes a hello to a player whose chapter 5 was ticked before its people wrote, once', () => {
    const done = { 1: { day: D1 }, 2: { day: D1 }, 3: { day: D1 }, 4: { day: D2 }, 5: { day: D2 } };
    // as the story first went live: chapter 5 ticked unseen, only the pump met at the flat's repair
    let s: Story = { ...none(), open: 6, opened: '', last: D2, first: D1, kinds: ['supply', 'rush', 'clean'], done };
    s = keep(s, { who: 'pump', from: 'Mira · the pump', text: 'Here is your plaster', day: D1 });
    expect(hellosDue(s)).toBe(true);
    expect(SCENES.regulars(s).map(([w]) => w)).toEqual(['flame', 'shield']);
    expect(hellosDue(say(s, REGULARS))).toBe(false);
    // due as chapter 5 opens, and not before
    expect(hellosDue({ ...s, done: { 1: { day: D1 } }, open: 5, opened: '' })).toBe(false);
    expect(hellosDue({ ...s, done: { 1: { day: D1 } }, open: 5, opened: D2 })).toBe(true);
    expect(hellosDue(none())).toBe(false);
  });

  it('thanks for a supply run as it arrived: in one piece, or with a new dent', () => {
    expect(SCENES.thanks('supply')[0][1]).toContain('in one piece');
    expect(SCENES.thanks('supply', true)[0][1]).not.toContain('in one piece');
    expect(SCENES.thanks('supply', true)[0][1]).toContain('dent');
    expect(SCENES.thanks('rush', true)).toEqual(SCENES.thanks('rush'));
  });

  it('says the next step of the first building in chapter 7, and where its way leads', () => {
    const st = { ...snap({ homes: 1, building: true }), town: 'Nuremberg', buildingsAfter: 6 };
    // the rest of the building is bought at the building; its repair and its paint come from the stations
    expect(goal(7, { ...st, building: false, reno: 'buy' }, none())).toMatchObject({ way: 'home' });
    expect(goal(7, { ...st, reno: 'rest' }, none())).toMatchObject({ way: 'station' });
    expect(goal(7, { ...st, reno: 'rest' }, none()).text).toContain('flat by flat');
    expect(goal(7, { ...st, reno: 'paint' }, none())).toMatchObject({ way: 'station' });
    expect(goal(7, { ...st, reno: 'paint' }, none()).text).toContain('paint');
  });

  it('says in chapter 3 what the first flat waits for, and leads to the flats once they are shown', () => {
    const st = { ...snap({ delivered: 2 }), town: '', buildingsAfter: 6 };
    expect(goal(3, st, none())).toEqual({ text: 'Buy a worn-down flat. After your next delivery, the game shows you where.', way: null });
    expect(goal(3, { ...st, flatWaits: 'cash' }, none()).text).toContain('$200');
    expect(goal(3, { ...st, flatWaits: 'run' }, none()).text).toContain('Finish your run');
    // shown where: no promise left to keep, the arrow leads there
    expect(goal(3, { ...st, reno: 'find', flatWaits: 'cash' }, none())).toEqual({ text: 'Buy a worn-down flat: stop beside a building with a green $ sign.', way: 'flats' });
    expect(goal(3, { ...st, homes: 1, reno: 'flat' }, none()).way).toBe('station');
  });

  it('names no flat where the home may be a house or a building: the party of chapter 6', () => {
    const at = (homes: number) => goal(6, { ...snap({ homes }), town: 'Nuremberg', buildingsAfter: 6 }, none()).text;
    expect(at(1)).toBe('Throw a party at your home: stop beside it.');
    expect(at(4)).toBe('Throw a party at one of your homes: stop beside it.');
  });

  it('says in chapter 8 that a home being renovated here comes first', () => {
    const st = { ...snap({ homes: 7, building: true }), town: 'Nuremberg', buildingsAfter: 6, renovateFirst: 'your flat on Lindenstraße' };
    expect(goal(8, st, none())).toEqual({ text: 'Your tenants have something to say. First your flat on Lindenstraße needs renovating: a package from any station brings what it needs.', way: 'station' });
    // once they have written, the dispute's own lines
    expect(goal(8, { ...st, dispute: 'talk', disputeAt: 'your building on Königstraße' }, none()).way).toBe('home');
  });

  it('thanks for the neighbour\'s own house, or for a building bought elsewhere', () => {
    expect(SCENES.buildingThanks(true)[0][1]).toBe('The whole house looks new. Thank you.');
    expect(SCENES.buildingThanks(false)[0][1]).not.toContain('house');
  });

  it('keeps the newest scenes shown, so one just played is not played again', () => {
    const said = Array.from({ length: SAID_MAX + 50 }, (_, i) => `scene-${i}`);
    const back = readStory(JSON.stringify({ ...none(), said })).said;
    expect(back).toHaveLength(SAID_MAX);
    expect(back.at(-1)).toBe(`scene-${SAID_MAX + 49}`);
  });

  it('reads back what it stored, and nothing broken', () => {
    const s = begin(snap({ delivered: 2 }), D1);
    const t = keep({ ...s, names: namesFor(52.52, 13.405), kinds: ['rush'], said: ['x'] }, { who: 'friends', from: 'Jo', text: 'Hey', day: D1 });
    expect(readStory(JSON.stringify({ v: 1, ...t }))).toEqual(t);
    expect(readStory('{"open": 99, "done": {"1": {"day": "nope"}}, "kinds": ["fly"], "inbox": [{"who": "x"}]}')).toEqual({ ...none(), open: BUILT + 1 });
    expect(readStory('not json')).toEqual(none());
  });
});
