/**
 * Keys and touch. Keys drive like a car (gas, brake, steer); the touch stick points where you
 * want to go on the screen, and the car turns that way. On foot both walk by screen direction.
 */

export interface Input {
  /** direction on the screen, x right and y up, length 0…1 (keys on foot, or the stick) */
  moveX: number;
  moveY: number;
  /** whether the direction comes from the touch stick */
  stick: boolean;
  /** keys in a car */
  throttle: number;
  steer: number;
  brake: boolean;
  handbrake: boolean;
}

const KEYS: Record<string, string> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'handbrake', KeyE: 'action', KeyF: 'action', Enter: 'action', KeyR: 'reset', KeyG: 'route',
};

export class Controls {
  private readonly down = new Set<string>();
  private stickId: number | null = null;
  private stickFrom = { x: 0, y: 0 };
  private stickAt = { x: 0, y: 0 };
  private brakeTouch = false;
  /** called once per press */
  onAction: () => void = () => undefined;
  onReset: () => void = () => undefined;
  onRoute: () => void = () => undefined;
  enabled = false;

  constructor(pad: HTMLElement, private readonly knob: HTMLElement, actionBtn: HTMLElement, brakeBtn: HTMLElement) {
    addEventListener('keydown', (e) => {
      const k = KEYS[e.code];
      if (!k || !this.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea')) return;
      e.preventDefault();
      if (e.repeat) return;
      if (k === 'action') this.onAction();
      else if (k === 'reset') this.onReset();
      else if (k === 'route') this.onRoute();
      else this.down.add(k);
    });
    addEventListener('keyup', (e) => {
      const k = KEYS[e.code];
      if (k) this.down.delete(k);
    });
    addEventListener('blur', () => this.down.clear());

    pad.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null || !this.enabled) return;
      this.stickId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      this.stickFrom = { x: e.clientX, y: e.clientY };
      this.stickAt = { ...this.stickFrom };
      knob.parentElement!.style.left = `${e.clientX}px`;
      knob.parentElement!.style.top = `${e.clientY}px`;
      knob.parentElement!.hidden = false;
      this.drawKnob();
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickAt = { x: e.clientX, y: e.clientY };
      this.drawKnob();
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      knob.parentElement!.hidden = true;
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);

    actionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.enabled) this.onAction();
    });
    brakeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.brakeTouch = true;
      brakeBtn.setPointerCapture(e.pointerId);
    });
    for (const ev of ['pointerup', 'pointercancel'] as const) brakeBtn.addEventListener(ev, () => (this.brakeTouch = false));
  }

  private stickVector(): [number, number] {
    if (this.stickId === null) return [0, 0];
    const R = 56;
    let x = (this.stickAt.x - this.stickFrom.x) / R;
    let y = -(this.stickAt.y - this.stickFrom.y) / R;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return m < 0.12 ? [0, 0] : [x, y];
  }

  private drawKnob(): void {
    const [x, y] = this.stickVector();
    this.knob.style.transform = `translate(${x * 56}px, ${-y * 56}px)`;
  }

  read(): Input {
    const d = this.down;
    const kx = (d.has('right') ? 1 : 0) - (d.has('left') ? 1 : 0);
    const ky = (d.has('up') ? 1 : 0) - (d.has('down') ? 1 : 0);
    const [sx, sy] = this.stickVector();
    const stick = sx !== 0 || sy !== 0;
    const km = Math.hypot(kx, ky) || 1;
    return {
      moveX: stick ? sx : kx / km,
      moveY: stick ? sy : ky / km,
      stick,
      throttle: ky,
      steer: -kx,
      brake: this.brakeTouch,
      handbrake: d.has('handbrake'),
    };
  }
}
