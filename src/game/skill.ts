/**
 * Driving skill: points for driving well, the game's fourth kind of points beside cash, home points and
 * trophies (the owner, 28 November 2026: "our next collectible points. Driving skills which in future will
 * open up different vehicles, hidden gems").
 *
 * - **Near miss:** passing a moving car, bus, tram or train within `NEAR_GAP_M` at speed, without touching it.
 * - **Drift:** the car sliding sideways (more than `DRIFT_SLIP` off its nose) at speed for `DRIFT_MIN_S` or longer.
 * - **Chains:** a move within `CHAIN_S` of the last one adds to a chain, and each move in it counts that many
 *   times (×2, ×3, up to ×`CHAIN_MAX`). The chain is banked when it ends cleanly: `CHAIN_S` with no move, or
 *   getting out. A crash while it is open loses it.
 *
 * Skill is never spent, and later unlocks open at levels (the owner's choice, 28 November). A crash costs a
 * little (`CRASH_COST`, the owner: "crashes can cost you points maybe?"), but never below the start of the
 * level reached, so a level once reached, and whatever it opens, is never lost.
 * The counts of each move are kept too, so a later unlock can ask for, say, 50 drifts. Kept in the browser
 * under `3da-skill`, so saving online carries it along.
 *
 * No screen and no sound here: `Game` feeds it each frame and passes on what it says.
 */

export type Move = 'near' | 'drift' | 'spin';

/**
 * Points that come on their own, straight to the total and outside any chain (the owner, 28 November: "We need
 * to get more additional points, successfully escaped the police ... Certain missions with a perfect time ...
 * beating the friend's challenge"): shaking off the police, a perfect delivery, beating a friend's run.
 */
export type Bonus = 'escape' | 'perfect' | 'rival';

/** what is kept */
export interface SkillSave {
  total: number;
  near: number;
  drift: number;
  spin: number;
  escape: number;
  perfect: number;
  rival: number;
  /** the most points one chain banked */
  bestChain: number;
  /** the most moves in one chain */
  bestCombo: number;
}

/** A car as the skill sees it: where, which way, how fast, and its two (or more) collision circles. */
export interface Body {
  x: number;
  y: number;
  th: number;
  vx: number;
  vy: number;
  /** circle radius, how far the end circles sit from the middle, and where along the car they are */
  r: number;
  a: number;
  offs: number[];
  /** its length (m): a bus, tram or train is worth a little more to scrape past */
  spec: { len: number };
}

export interface Me extends Body {
  /** the hardest knock this frame (m/s) */
  knock: number;
}

export type SkillEvent =
  | { kind: 'move'; move: Move; points: number; combo: number; pending: number }
  | { kind: 'banked'; points: number; combo: number; total: number; levelUp: number | null }
  | { kind: 'lost'; points: number }
  | { kind: 'bonus'; what: Bonus; points: number; total: number; levelUp: number | null }
  /** a crash took `points` from the total (0 at the floor of the level) */
  | { kind: 'crash'; points: number; total: number };

/** the widest gap that is a near miss (m, side to side) */
export const NEAR_GAP_M = 1.1;
/** how fast you have to be going for a near miss, and how much faster than the other car (m/s) */
export const NEAR_SPEED = 9;
export const NEAR_REL = 7;
/** a car passed once gives no second near miss for this long (s) */
const NEAR_AGAIN_S = 8;
/**
 * sliding at least this far off the nose (radians, about 19°), at this speed (m/s), for this long (s). An
 * ordinary turn at full lock slides up to about 16° (tests/skill.test.ts), a handbrake turn 40° and more.
 */
export const DRIFT_SLIP = 0.33;
export const DRIFT_SPEED = 5;
export const DRIFT_MIN_S = 0.45;
/** past this (radians, 150°) the car is going backwards, not sliding */
const DRIFT_BACK = (150 * Math.PI) / 180;
/** a slide may straighten for this long (s) and still be one drift */
const DRIFT_GAP_S = 0.25;
/** the most a single drift is worth before the chain */
const DRIFT_MAX = 60;
/**
 * A 180: the car turning this far round (radians, 150°) in one slide that began as a drift at `DRIFT_SPEED`
 * or more; the slide may end going backwards. Backing and turning alone never starts one.
 */
export const SPIN_RAD = (150 * Math.PI) / 180;
/** the slow end of a spin (m/s): below this it is over */
const SPIN_SLOW = 2;
/** a spin's worth, before the chain */
export const SPIN_POINTS = 40;
/** seconds without a move before a chain is banked */
export const CHAIN_S = 3;
/** the most a chain multiplies */
export const CHAIN_MAX = 5;
/** a knock this hard (m/s) is a crash: the chain open is lost, and so is a drift under way */
export const CRASH_KNOCK = 4;

/** what a crash takes from the total, at most, and how long after one the next can cost again (s) */
export const CRASH_COST = 10;
const CRASH_AGAIN_S = 2;

/**
 * Where each level begins (skill points): slow, and slower the higher (the owner, 28 November: "The leveling
 * up should go slowly ... the later the level the more it takes. Like Diablo"). Level n+1 takes 40 × n² more
 * than level n: level 2 at 40 (a couple of good moves), 3 at 200, 5 at 1,200, 10 at 11,400, 20 at 98,800 and
 * the top, 30, at 342,200. At a guessed 1,000 to 2,000 points an hour of play: level 2 in the first minutes,
 * 5 in about an hour, 10 in an evening or two, 20 in weeks and 30 in months.
 */
export const MAX_LEVEL = 30;
const STEP = 40;
export const LEVELS = Array.from({ length: MAX_LEVEL }, (_, n) => (STEP * n * (n + 1) * (2 * n + 1)) / 6);

/**
 * The rank a level is at, for its name (the language tables' `skillLevels`): levels 1 to 5 Rookie, 6 to 10
 * Regular, and so on to Master at 26 to 29, and Legend only at the top. `level` counts from 0.
 */
export function rankOf(level: number): number {
  return level >= MAX_LEVEL - 1 ? 6 : Math.min(5, Math.floor(level / 5));
}

/** The level a total is at, and where it and the next one begin (`next` null at the top). */
export function levelOf(total: number): { level: number; from: number; next: number | null } {
  let level = 0;
  while (level + 1 < LEVELS.length && total >= LEVELS[level + 1]) level++;
  return { level, from: LEVELS[level], next: LEVELS[level + 1] ?? null };
}

/** The total after a crash: `CRASH_COST` less, never below the start of the level reached. */
export function afterCrash(total: number): number {
  return Math.max(levelOf(total).from, total - CRASH_COST);
}

/** A near miss's worth: 10, up to 25 for a scrape, and 5 more past something long. */
export function nearPoints(gap: number, len: number): number {
  const close = Math.max(0, Math.min(1, 1 - gap / NEAR_GAP_M));
  return Math.round(10 + 15 * close) + (len > 7 ? 5 : 0);
}

/**
 * What each bonus is worth: shaking off the police 30 a star (up to 4 stars, 120), a perfect delivery 30 (a
 * rush job 45, a mission's package 60), beating a friend's run 150.
 */
export const ESCAPE_POINTS = 30;
export const PERFECT_POINTS = 30;
export const RIVAL_POINTS = 150;
/** a delivery is perfect with this share of its clock left, in the car it came on board in, without a dent */
export const PERFECT_LEFT = 0.4;

/** A drift's worth: 8 and 14 a second, up to `DRIFT_MAX`. */
export function driftPoints(seconds: number): number {
  return Math.min(DRIFT_MAX, Math.round(8 + 14 * seconds));
}

const STORE = '3da-skill';

const EMPTY: SkillSave = { total: 0, near: 0, drift: 0, spin: 0, escape: 0, perfect: 0, rival: 0, bestChain: 0, bestCombo: 0 };

export function readSkill(raw: string | null): SkillSave {
  try {
    const k = JSON.parse(raw ?? '') as Partial<Record<keyof SkillSave, unknown>>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    return {
      total: n(k.total),
      near: n(k.near),
      drift: n(k.drift),
      spin: n(k.spin),
      escape: n(k.escape),
      perfect: n(k.perfect),
      rival: n(k.rival),
      bestChain: n(k.bestChain),
      bestCombo: n(k.bestCombo),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function loadSkill(): SkillSave {
  try {
    return readSkill(localStorage.getItem(STORE));
  } catch {
    return { ...EMPTY };
  }
}

export function storeSkill(s: SkillSave): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    /* it lasts as long as the page */
  }
}

/** The narrowest gap between two cars' collision circles (m): below 0 they touch. */
export function gapBetween(p: Body, q: Body): number {
  let best = Infinity;
  const pfx = Math.cos(p.th);
  const pfy = Math.sin(p.th);
  const qfx = Math.cos(q.th);
  const qfy = Math.sin(q.th);
  for (const sp of p.offs) {
    for (const sq of q.offs) {
      const d = Math.hypot(q.x + qfx * q.a * sq - (p.x + pfx * p.a * sp), q.y + qfy * q.a * sq - (p.y + pfy * p.a * sp));
      best = Math.min(best, d - p.r - q.r);
    }
  }
  return best;
}

/** How far the car slides off its nose (radians, 0 to π/2), going forward; 0 when backing or slow. */
export function slipOf(b: Body): number {
  const fx = Math.cos(b.th);
  const fy = Math.sin(b.th);
  const vf = b.vx * fx + b.vy * fy;
  const vl = b.vx * fy - b.vy * fx;
  if (vf <= 1) return 0;
  return Math.atan2(Math.abs(vl), vf);
}

/** How far the car moves off its nose (radians, 0 to π: π is straight backwards); 0 when slow. */
function offNose(b: Body): number {
  const fx = Math.cos(b.th);
  const fy = Math.sin(b.th);
  if (Math.hypot(b.vx, b.vy) < 1) return 0;
  return Math.atan2(Math.abs(b.vx * fy - b.vy * fx), b.vx * fx + b.vy * fy);
}

const turnOf = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

interface Pass {
  /** narrowest gap so far, and the speed between the two then */
  gap: number;
  rel: number;
  touched: boolean;
  len: number;
}

export class SkillTracker {
  save: SkillSave;
  /** moves in the open chain, and the points it holds */
  combo = 0;
  pending = 0;
  /** seconds since the last move */
  private quiet = 0;
  /** the slide under way: how long, and how long it has been straight */
  driftS = 0;
  private straightS = 0;
  private readonly passing = new Map<object, Pass>();
  private readonly passed = new Map<object, number>();
  private clock = 0;
  private crashAt = -99;
  /** the spin under way: how far round so far (radians, signed), whether it has paid, the last heading */
  private spinRot = 0;
  private spinOn = false;
  private spun = false;
  private spinOff = 0;
  private lastTh: number | null = null;

  constructor(save: SkillSave = { ...EMPTY }, private readonly keep: (s: SkillSave) => void = () => undefined) {
    this.save = save;
  }

  /**
   * One frame. `me`: the car you drive, or null on foot (which ends the chain, banked). `others`: the moving
   * traffic near you, each with its own object as its name. `crash`: the car went into water or was wrecked.
   */
  step(dt: number, me: Me | null, others: Array<[object, Body]>, emit: (e: SkillEvent) => void, crash = false): void {
    this.clock += dt;
    for (const [k, t] of this.passed) if (this.clock - t > NEAR_AGAIN_S) this.passed.delete(k);
    if (!me) {
      this.passing.clear();
      this.driftS = 0;
      this.endSpin();
      this.lastTh = null;
      this.bank(emit);
      return;
    }
    if (crash || me.knock >= CRASH_KNOCK) {
      this.driftS = 0;
      this.endSpin();
      // whatever was being passed is not a clean pass now
      for (const p of this.passing.values()) p.touched = true;
      if (this.pending > 0) emit({ kind: 'lost', points: this.pending });
      this.combo = 0;
      this.pending = 0;
      this.quiet = 0;
      if (this.clock - this.crashAt >= CRASH_AGAIN_S) {
        this.crashAt = this.clock;
        const s = this.save;
        const was = s.total;
        s.total = afterCrash(was);
        if (was !== s.total) this.keep(s);
        if (was > 0) emit({ kind: 'crash', points: was - s.total, total: s.total });
      }
    }
    const speed = Math.hypot(me.vx, me.vy);

    // near misses: follow each car while it is close, and judge the pass as it goes away
    const seen = new Set<object>();
    for (const [key, o] of others) {
      const far = Math.hypot(o.x - me.x, o.y - me.y);
      let p = this.passing.get(key);
      if (far > 16) {
        if (p) this.endPass(key, p, emit);
        continue;
      }
      seen.add(key);
      const gap = gapBetween(me, o);
      if (!p) {
        if (gap > NEAR_GAP_M * 3) continue;
        p = { gap: Infinity, rel: 0, touched: false, len: o.spec.len };
        this.passing.set(key, p);
      }
      if (gap < 0.08 || (me.knock > 1 && gap < 0.6)) p.touched = true;
      if (gap < p.gap) {
        p.gap = gap;
        // fast yourself and past it, not standing beside it
        p.rel = speed >= NEAR_SPEED ? Math.hypot(me.vx - o.vx, me.vy - o.vy) : 0;
      }
    }
    for (const [key, p] of this.passing) if (!seen.has(key)) this.endPass(key, p, emit);

    // drifts
    // sideways, or more: a slide that swings past sideways is still a drift, until the car goes backwards
    const off = offNose(me);
    const sliding = speed >= DRIFT_SPEED && off >= DRIFT_SLIP && off <= DRIFT_BACK;
    if (sliding) {
      this.driftS += dt;
      this.straightS = 0;
      // a long slide keeps the chain open
      if (this.driftS >= DRIFT_MIN_S) this.quiet = 0;
    } else if (this.driftS > 0) {
      this.straightS += dt;
      if (this.straightS >= DRIFT_GAP_S) {
        const s = this.driftS;
        this.driftS = 0;
        this.straightS = 0;
        if (s >= DRIFT_MIN_S) this.add('drift', driftPoints(s), emit);
      }
    }

    // a 180: one slide that turns the car round
    const turned = this.lastTh === null ? 0 : turnOf(me.th - this.lastTh);
    this.lastTh = me.th;
    if (!this.spinOn && sliding) this.spinOn = true;
    if (this.spinOn) {
      if (speed >= SPIN_SLOW && offNose(me) >= DRIFT_SLIP) {
        this.spinRot += turned;
        this.spinOff = 0;
        // a long spin keeps the chain open
        this.quiet = 0;
      } else if ((this.spinOff += dt) >= DRIFT_GAP_S || speed < SPIN_SLOW) this.endSpin();
      if (this.spinOn && !this.spun && Math.abs(this.spinRot) >= SPIN_RAD) {
        this.spun = true;
        this.add('spin', SPIN_POINTS, emit);
      }
    }

    if (this.combo > 0) {
      this.quiet += dt;
      if (this.quiet >= CHAIN_S && this.driftS === 0) this.bank(emit);
    }
  }

  private endSpin(): void {
    this.spinOn = false;
    this.spun = false;
    this.spinRot = 0;
    this.spinOff = 0;
  }

  /**
   * Points on their own, straight to the total (the chain open stays open). `escape` takes how many stars the
   * chase reached, `perfect` what the delivery was worth (1, 1.5 for a rush job, 2 for a mission's package).
   */
  bonus(what: Bonus, emit: (e: SkillEvent) => void, times = 1): void {
    const base = what === 'escape' ? ESCAPE_POINTS : what === 'perfect' ? PERFECT_POINTS : RIVAL_POINTS;
    const points = Math.round(base * Math.max(1, times));
    const s = this.save;
    const before = levelOf(s.total).level;
    s.total += points;
    s[what]++;
    const after = levelOf(s.total).level;
    this.keep(s);
    emit({ kind: 'bonus', what, points, total: s.total, levelUp: after > before ? after : null });
  }

  private endPass(key: object, p: Pass, emit: (e: SkillEvent) => void): void {
    this.passing.delete(key);
    if (p.touched || p.gap > NEAR_GAP_M || p.rel < NEAR_REL || this.passed.has(key)) return;
    this.passed.set(key, this.clock);
    this.add('near', nearPoints(Math.max(0, p.gap), p.len), emit);
  }

  private add(move: Move, base: number, emit: (e: SkillEvent) => void): void {
    this.combo++;
    this.quiet = 0;
    const points = base * Math.min(CHAIN_MAX, this.combo);
    this.pending += points;
    this.save[move]++;
    emit({ kind: 'move', move, points, combo: this.combo, pending: this.pending });
  }

  /** The open chain is banked (getting out, the run's end, a pause of `CHAIN_S`). */
  bank(emit: (e: SkillEvent) => void): void {
    if (this.combo === 0) return;
    const before = levelOf(this.save.total).level;
    const s = this.save;
    s.total += this.pending;
    s.bestChain = Math.max(s.bestChain, this.pending);
    s.bestCombo = Math.max(s.bestCombo, this.combo);
    const after = levelOf(s.total).level;
    emit({ kind: 'banked', points: this.pending, combo: this.combo, total: s.total, levelUp: after > before ? after : null });
    this.combo = 0;
    this.pending = 0;
    this.quiet = 0;
    this.keep(s);
  }
}
