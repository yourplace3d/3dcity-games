import { afterEach, describe, expect, it, vi } from 'vitest';
import { caughtCost, LESSON_AFTER_S, lessonDue, nearestBank, readLesson, remindAt, remindDue, REMIND_GAP_S, type LessonNow } from '../src/game/bankMission';
import { HomesUi } from '../src/homesUi';
import type { Home } from '../src/game/homes';

afterEach(() => vi.unstubAllGlobals());

const now = (o: Partial<LessonNow> = {}): LessonNow => ({
  today: '2026-11-24',
  bankHere: true,
  cash: 900,
  deliveredHere: 0,
  playedS: 0,
  busy: false,
  ...o,
});

describe('the mission to the bank', () => {
  it('comes after the first delivery of a later visit, or after a minute of play', () => {
    const l = { stage: 'offer' as const, rent: true };
    expect(lessonDue(l, now())).toBe(false);
    expect(lessonDue(l, now({ deliveredHere: 1 }))).toBe(true);
    expect(lessonDue(l, now({ playedS: LESSON_AFTER_S }))).toBe(true);
  });

  it('waits for rent on a return, and away from the banks, with a package on board, or with little cash', () => {
    const l = { stage: 'offer' as const, rent: true };
    const due = { deliveredHere: 1 };
    expect(lessonDue({ stage: 'offer' }, now(due))).toBe(false);
    expect(lessonDue(l, now({ ...due, bankHere: false }))).toBe(false);
    expect(lessonDue(l, now({ ...due, busy: true }))).toBe(false);
    expect(lessonDue(l, now({ ...due, cash: 40 }))).toBe(false);
  });

  it('put off, is asked again on another day; once learnt, never again', () => {
    expect(lessonDue({ stage: 'offer', later: '2026-11-24', rent: true }, now({ deliveredHere: 1 }))).toBe(false);
    expect(lessonDue({ stage: 'offer', later: '2026-11-23', rent: true }, now({ deliveredHere: 1 }))).toBe(true);
    expect(lessonDue({ stage: 'done', rent: true }, now({ deliveredHere: 1 }))).toBe(false);
    expect(lessonDue({ stage: 'go', rent: true }, now({ deliveredHere: 1 }))).toBe(false);
  });

  it('is not asked of a player who has paid in before', () => {
    expect(readLesson(null, true)).toEqual({ stage: 'done' });
    expect(readLesson(null, false)).toEqual({ stage: 'offer' });
    expect(readLesson('{"v":1,"stage":"go"}', true)).toEqual({ stage: 'go' });
    expect(readLesson('{"v":1,"stage":"offer","later":"2026-11-23","rent":true}', false)).toEqual({ stage: 'offer', later: '2026-11-23', rent: true });
    expect(readLesson('{"stage":"odd"}', false)).toEqual({ stage: 'offer' });
    expect(readLesson('not json', false)).toEqual({ stage: 'offer' });
  });
});

describe('the reminder', () => {
  it('comes with much cash carried, at least a day of rent, and not too often', () => {
    expect(remindAt(300)).toBe(1000);
    expect(remindAt(4260)).toBe(4300);
    const l = { stage: 'done' as const };
    expect(remindDue(l, now({ cash: 1200 }), 300, REMIND_GAP_S)).toBe(true);
    expect(remindDue(l, now({ cash: 900 }), 300, REMIND_GAP_S)).toBe(false);
    expect(remindDue(l, now({ cash: 1200 }), 300, REMIND_GAP_S - 1)).toBe(false);
    expect(remindDue(l, now({ cash: 1200, bankHere: false }), 300, REMIND_GAP_S)).toBe(false);
    expect(remindDue(l, now({ cash: 1200, busy: true }), 300, REMIND_GAP_S)).toBe(false);
    expect(remindDue({ stage: 'offer' }, now({ cash: 1200 }), 300, REMIND_GAP_S)).toBe(false);
  });

  it('says what a fine would take, as the game takes it', () => {
    expect(caughtCost(1000)).toBe(250);
    expect(caughtCost(30)).toBe(30);
    expect(caughtCost(120)).toBe(50);
  });

  it('points at the nearest bank', () => {
    expect(nearestBank([{ x: 0, y: 500 }, { x: 100, y: 0 }], 0, 0)).toEqual({ x: 100, y: 0 });
    expect(nearestBank([], 0, 0)).toBeNull();
  });
});

describe('paying in', () => {
  const home: Home = { id: '1', lat: 49, lon: 11, kind: 'flat', paid: 700, rent: 168, street: '', place: 'Nuremberg', at: 0 };
  const ui = (stage: 'offer' | 'go' | 'done') => {
    vi.stubGlobal('navigator', { webdriver: true });
    const game = { cash: 1200, guide: null };
    const card = vi.fn();
    const toast = vi.fn();
    const u: HomesUi = Object.assign(Object.create(HomesUi.prototype), {
      host: { game, save: vi.fn(), toast, card },
      homes: { v: 1, homes: [home], paidDay: '' },
      saved: 0,
      lesson: { stage },
      shown: '',
      look: vi.fn(),
    });
    return { u, game, card, toast };
  };

  it('ends the mission to the bank with a card', () => {
    const { u, game, card } = ui('go');
    expect(u.payIn()).toBe(1200);
    expect(game.cash).toBe(0);
    expect(card).toHaveBeenCalledOnce();
    expect(card.mock.calls[0][0]).toBe('Your money is safe');
    expect((u as unknown as { lesson: { stage: string } }).lesson.stage).toBe('done');
  });

  it('without being asked, learns it all the same, with a line and no card', () => {
    const { u, card, toast } = ui('offer');
    u.payIn();
    expect(card).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledOnce();
    expect((u as unknown as { lesson: { stage: string } }).lesson.stage).toBe('done');
  });
});
