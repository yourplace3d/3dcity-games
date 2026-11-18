import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controls } from '../src/game/input';

class Element extends EventTarget {
  style = {};
  hidden = false;
  parentElement = { style: {}, hidden: true };
  setPointerCapture = vi.fn();
}
function send(target: EventTarget, type: string, values = {}) {
  target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), values));
}

describe('controls across menus and lost focus', () => {
  let win: EventTarget;
  let pad: Element;
  let knob: Element;
  let brake: Element;
  let controls: Controls;
  beforeEach(() => {
    win = new EventTarget();
    vi.stubGlobal('addEventListener', win.addEventListener.bind(win));
    vi.stubGlobal('document', new EventTarget());
    pad = new Element(); knob = new Element(); brake = new Element();
    controls = new Controls(...[pad, knob, new Element(), brake].map((e) => e as unknown as HTMLElement) as [HTMLElement, HTMLElement, HTMLElement, HTMLElement]);
    controls.enabled = true;
  });
  afterEach(() => vi.unstubAllGlobals());

  function move() {
    send(win, 'keydown', { code: 'KeyW' });
    send(pad, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    send(pad, 'pointermove', { pointerId: 1, clientX: 150, clientY: 100 });
    send(brake, 'pointerdown', { pointerId: 2 });
    expect(controls.read()).toMatchObject({ throttle: 1, stick: true, brake: true });
  }
  function expectIdle() {
    expect(controls.read()).toEqual({ moveX: 0, moveY: 0, throttle: 0, steer: -0, stick: false, brake: false, handbrake: false });
    expect(knob.parentElement.hidden).toBe(true);
  }
  it('does not carry held keys, steering or braking through a pause', () => {
    move();
    controls.enabled = false;
    controls.enabled = true;
    expectIdle();
  });
  it('clears touch as well as keys when the window loses focus', () => {
    move();
    send(win, 'blur');
    expectIdle();
  });
  it('ends gestures when pointer capture is lost', () => {
    move();
    send(win, 'keyup', { code: 'KeyW' });
    send(pad, 'lostpointercapture', { pointerId: 1 });
    send(brake, 'lostpointercapture', { pointerId: 2 });
    expectIdle();
  });
  it('ignores brake presses while disabled and releases by other fingers', () => {
    controls.enabled = false;
    send(brake, 'pointerdown', { pointerId: 1 });
    controls.enabled = true;
    expectIdle();
    send(brake, 'pointerdown', { pointerId: 2 });
    send(brake, 'pointerup', { pointerId: 3 });
    expect(controls.read().brake).toBe(true);
    send(brake, 'pointerup', { pointerId: 2 });
    expectIdle();
  });
});
