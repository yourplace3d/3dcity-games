/**
 * The game's sounds, made in the browser as they are needed: no sound files. An engine that rises
 * with the speed, tyres on a handbrake turn, the siren of the police on your tail, a train's horn
 * as it comes near, and short notes for a package, a delivery, a crash and a fine.
 *
 * A browser lets a page make sound only after the player has touched or pressed something, so
 * nothing starts before that. Off is remembered.
 */

export type Sfx = 'pickup' | 'deliver' | 'run' | 'late' | 'fine' | 'splash' | 'crash' | 'door' | 'subway' | Mumble;
/** voices behind a door, words not to be made out (`Sound.mumble`): cross, worried, or glad */
export type Mumble = 'mumbleAngry' | 'mumbleSad' | 'mumbleHappy';

/** What can be heard around the player right now. */
export interface Ears {
  /** in a car that still runs */
  driving: boolean;
  /** m/s */
  speed: number;
  /** how hard the pedal is down, 0 to 1 */
  throttle: number;
  skid: boolean;
  /** how near the police on your tail are, 0 (none) to 1 */
  siren: number;
  /** how near a moving train is, 0 to 1 */
  train: number;
}

const KEY = '3da-sound';

export class Sound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private engine: { a: OscillatorNode; b: OscillatorNode; tone: BiquadFilterNode; gain: GainNode } | null = null;
  private skid: GainNode | null = null;
  private siren: { osc: OscillatorNode; gain: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  private hornAt = -99;
  private crashAt = -99;
  on = true;
  /** The page has been out of sight since the sound was last woken: see `wake`. */
  private away = false;

  /** Whether the browser is letting the page be heard right now (for the button, and for tests). */
  get heard(): boolean {
    return this.on && this.ctx?.state === 'running';
  }

  constructor() {
    try {
      this.on = localStorage.getItem(KEY) !== '0';
    } catch {
      /* no place to remember it: on */
    }
    // An iPad counts the lifting of a finger as the player's doing, not the putting down: listening
    // for the press alone left the game silent there.
    const wake = () => this.wake();
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown', 'pointerdown']) addEventListener(ev, wake, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.away = true;
        void this.ctx.suspend();
      } else if (this.on) void this.ctx.resume();
    });
  }

  /** Sound on or off; remembered. */
  toggle(): boolean {
    this.on = !this.on;
    try {
      localStorage.setItem(KEY, this.on ? '1' : '0');
    } catch {
      /* it lasts as long as the page */
    }
    if (this.on) this.wake();
    else if (this.out && this.ctx) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    return this.on;
  }

  /** The first touch or key: from now on the browser lets the page be heard. */
  private wake(): void {
    if (!this.on) return;
    try {
      // An iPhone back from the Home Screen says its sound is running and plays nothing. The first
      // touch after a time out of sight starts the sound afresh instead of trusting what is there.
      if (this.away && this.ctx) {
        void this.ctx.close();
        this.ctx = this.out = this.engine = this.skid = this.siren = this.noise = null;
      }
      this.away = false;
      if (!this.ctx) this.build();
      // an iPhone or iPad with its ringer switched to silent mutes a web page's sounds unless the page
      // says they are what it is for, as a game's are
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== 'playback') session.type = 'playback';
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
      if (this.ctx && this.out) this.out.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.05);
    } catch (err) {
      // a browser without sound: the game goes on silent
      console.warn('no sound', err);
      this.on = false;
    }
  }

  private build(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    // keeps a crash and a horn together from clipping
    const limit = ctx.createDynamicsCompressor();
    out.connect(limit).connect(ctx.destination);
    this.out = out;

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = noise;

    // the engine: two rough tones an octave apart, through a filter that opens with the revs
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const a = ctx.createOscillator();
    a.type = 'sawtooth';
    const b = ctx.createOscillator();
    b.type = 'square';
    const half = ctx.createGain();
    half.gain.value = 0.5;
    a.connect(tone);
    b.connect(half).connect(tone);
    tone.connect(gain).connect(out);
    a.start();
    b.start();
    this.engine = { a, b, tone, gain };

    // tyres: hiss in a narrow band
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1700;
    band.Q.value = 2.5;
    const sg = ctx.createGain();
    sg.gain.value = 0;
    src.connect(band).connect(sg).connect(out);
    src.start();
    this.skid = sg;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const ng = ctx.createGain();
    ng.gain.value = 0;
    osc.connect(ng).connect(out);
    osc.start();
    this.siren = { osc, gain: ng };
  }

  /** Each frame: what is around the player. null while the game waits (a menu, the map, a result). */
  hear(e: Ears | null): void {
    const ctx = this.ctx;
    if (!ctx || !this.engine || !this.skid || !this.siren) return;
    const t = ctx.currentTime;
    const drive = e?.driving ?? false;
    const speed = e?.speed ?? 0;
    // gears: the note climbs, drops back and climbs again as the car gets faster
    // a shift every 20 km/h or so: a car in town is heard going up through four or five gears
    const SHIFT = 5.6;
    const gear = Math.min(6, Math.floor(speed / SHIFT));
    const within = Math.min(1.5, (speed - gear * SHIFT) / SHIFT);
    const hz = 46 + gear * 6 + within * 50 + (e?.throttle ?? 0) * 8;
    this.engine.a.frequency.setTargetAtTime(hz, t, 0.06);
    this.engine.b.frequency.setTargetAtTime(hz / 2, t, 0.06);
    this.engine.tone.frequency.setTargetAtTime(240 + speed * 26 + (e?.throttle ?? 0) * 320, t, 0.08);
    // kept low: it runs the whole time, and the notes and the siren have to stand out over it
    this.engine.gain.gain.setTargetAtTime(drive ? 0.028 + 0.05 * (e?.throttle ?? 0) : 0, t, 0.09);
    this.skid.gain.setTargetAtTime(e?.skid ? 0.16 : 0, t, 0.05);
    const near = e?.siren ?? 0;
    // a wail, up and down every second and a half
    this.siren.osc.frequency.setTargetAtTime(760 + 190 * Math.sin(t * 4.2), t, 0.03);
    this.siren.gain.gain.setTargetAtTime(near > 0 ? 0.025 + 0.085 * near : 0, t, 0.15);
    if (e && e.train > 0.3 && t - this.hornAt > 7) {
      this.hornAt = t;
      this.horn(0.1 + 0.2 * e.train);
    }
  }

  private horn(vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol, t + 0.85);
    g.gain.linearRampToValueAtTime(0, t + 1.1);
    f.connect(g).connect(this.out);
    for (const hz of [277, 349, 415]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.connect(f);
      o.start(t);
      o.stop(t + 1.15);
    }
  }

  private note(hz: number, at: number, len: number, vol: number, type: OscillatorType = 'triangle'): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + len + 0.03);
  }

  /**
   * Two voices talking behind a door, made here and nowhere recorded: a buzz through a mouth-like filter,
   * one syllable after another, the pitch and the filter moving with each, so it sounds like speech no one
   * can make out (the owner, 28 November 2026: "an indistinguishable mumbling comic sound, depending on the
   * mission happy or angry"). Cross: low, loud, clipped, falling; worried: soft and sinking; glad: high,
   * bouncing up. About `len` seconds.
   */
  private mumble(mood: Mumble, len: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const voice = {
      mumbleAngry: { base: 150, spread: 0.35, vol: 0.55, syl: 0.11, gap: 0.03, slide: -0.25, wave: 'sawtooth' as OscillatorType },
      mumbleSad: { base: 190, spread: 0.15, vol: 0.45, syl: 0.17, gap: 0.08, slide: -0.2, wave: 'sawtooth' as OscillatorType },
      mumbleHappy: { base: 240, spread: 0.3, vol: 0.45, syl: 0.12, gap: 0.05, slide: 0.3, wave: 'square' as OscillatorType },
    }[mood];
    let at = 0.05;
    let who = 0;
    while (at < len) {
      // a phrase of a few syllables, then the other voice (yours a little lower)
      const words = 3 + Math.floor(Math.random() * 4);
      const pitch = voice.base * (who === 0 ? 1 : 0.78);
      for (let i = 0; i < words && at < len; i++) {
        const t = ctx.currentTime + at;
        const d = voice.syl * (0.7 + Math.random() * 0.7);
        const hz = pitch * (1 + (Math.random() - 0.5) * voice.spread);
        const o = ctx.createOscillator();
        o.type = voice.wave;
        o.frequency.setValueAtTime(hz, t);
        o.frequency.linearRampToValueAtTime(hz * (1 + voice.slide * (i + 1) / words), t + d);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 4;
        // the mouth opening and closing: the vowel moves within a syllable
        const vowel = 500 + Math.random() * 900;
        f.frequency.setValueAtTime(vowel, t);
        f.frequency.linearRampToValueAtTime(vowel * (0.6 + Math.random() * 0.8), t + d);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(voice.vol, t + 0.02);
        g.gain.setValueAtTime(voice.vol, t + d * 0.6);
        g.gain.linearRampToValueAtTime(0, t + d);
        o.connect(f).connect(g).connect(this.out);
        o.start(t);
        o.stop(t + d + 0.02);
        at += d + voice.gap * (0.5 + Math.random());
      }
      at += 0.12 + Math.random() * 0.15;
      who = 1 - who;
    }
  }

  private burst(len: number, vol: number, hz: number, kind: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = kind;
    f.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.03);
  }

  /** A short sound for something that has just happened; `strength` from 0 to 1 where it varies. */
  play(what: Sfx, strength = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.on || ctx.state !== 'running') return;
    switch (what) {
      case 'pickup':
        this.note(660, 0, 0.16, 0.16);
        this.note(880, 0.09, 0.22, 0.16);
        break;
      case 'deliver':
        this.note(659, 0, 0.14, 0.17);
        this.note(784, 0.1, 0.14, 0.17);
        this.note(1047, 0.2, 0.34, 0.18);
        break;
      case 'run':
        [523, 659, 784, 1047, 1319].forEach((hz, i) => this.note(hz, i * 0.11, 0.5, 0.15));
        break;
      case 'late':
        this.note(330, 0, 0.22, 0.15, 'square');
        this.note(247, 0.18, 0.4, 0.15, 'square');
        break;
      case 'fine':
        this.note(196, 0, 0.3, 0.2, 'sawtooth');
        this.note(147, 0.22, 0.6, 0.2, 'sawtooth');
        break;
      case 'splash':
        this.burst(0.7, 0.3, 2400, 'highpass');
        break;
      case 'crash': {
        if (ctx.currentTime - this.crashAt < 0.12) return;
        this.crashAt = ctx.currentTime;
        this.burst(0.18 + 0.3 * strength, 0.12 + 0.4 * strength, 500 + 900 * strength);
        this.note(70, 0, 0.16, 0.2 * strength, 'sine');
        break;
      }
      case 'door':
        this.burst(0.07, 0.2, 700);
        break;
      case 'subway':
        this.burst(1.3, 0.14, 420);
        break;
      case 'mumbleAngry':
      case 'mumbleSad':
      case 'mumbleHappy':
        this.mumble(what, 1.8);
        break;
    }
  }
}
