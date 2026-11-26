/**
 * The top right of the screen holds the buttons, the radio's bar with the station's name, the panel
 * of a building for sale, and on a phone, or wherever the player drags it, the little map. Each has
 * its place in the style sheet, but those places were laid down one at a time and met: on a phone the
 * radio's bar lay over the little map, on an iPad it hid the panel's top line, and with the little map
 * in the top right corner the panel hid all of it (seen on the owner's iPad).
 *
 * Here, whenever one of them changes, the bar and the panel are moved where they would meet something: the
 * bar below the little map; the panel below the bar, and beside the little map where there is room,
 * else below it. Where nothing is met they stay where the style sheet puts them.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** room left between them (px) */
const GAP = 8;
/** nothing goes nearer the edge of the screen than this (px) */
const EDGE = 12;

const meet = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const across = (a: Box, b: Box) => a.left < b.right && b.left < a.right;
const moved = (b: Box, top: number, right = b.right): Box => ({ left: right - (b.right - b.left), top, right, bottom: top + (b.bottom - b.top) });

/**
 * Where the bar and the panel go, from where the style sheet puts them (`bar`, `panel`; null when not
 * shown) and where the little map is (null when hidden): the bar's top, and the panel's top and right
 * edge, all in px from the top left of the screen.
 */
export function clearOf(map: Box | null, bar: Box | null, panel: Box | null): { bar: Box | null; panel: Box | null } {
  let b = bar;
  if (b && map && meet(b, map)) b = moved(b, map.bottom + GAP);
  let p = panel;
  if (p) {
    // under the bar, where the bar is above it
    if (b && across(p, b) && b.top < p.bottom && p.top < b.bottom + GAP) p = moved(p, b.bottom + GAP);
    if (map && meet(p, map)) {
      // beside the little map, where there is room left of it; under the bar still, if the bar reaches there
      const right = map.left - GAP;
      if (right - (p.right - p.left) >= EDGE) {
        p = moved(p, panel!.top, right);
        if (b && across(p, b) && b.top < p.bottom && p.top < b.bottom + GAP) p = moved(p, b.bottom + GAP, right);
      } else p = moved(p, Math.max(p.top, map.bottom + GAP));
    }
  }
  return { bar: b, panel: p };
}

/** Keep the bar and the panel clear of the little map and of each other, whenever any of them changes. */
export function keepClear(bar: HTMLElement, panel: HTMLElement, map: HTMLElement): void {
  const box = (el: HTMLElement): Box | null => {
    if (el.hidden || !el.offsetParent) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  };
  // the panel's whole height, scrolled or not: its max-height is left alone, so where it scrolls to stays
  const whole = (b: Box | null): Box | null => (b ? { ...b, bottom: b.top + panel.scrollHeight + (panel.offsetHeight - panel.clientHeight) } : null);
  /** whether they were last moved from where the style sheet puts them */
  let styled = false;
  const place = (): void => {
    if (bar.hidden && panel.hidden && !styled) return;
    // where the style sheet puts them, then moved from there
    for (const el of [bar, panel]) {
      el.style.top = '';
      el.style.right = '';
    }
    panel.style.left = '';
    panel.style.transform = '';
    const was = { bar: box(bar), panel: whole(box(panel)) };
    const { bar: b, panel: p } = clearOf(box(map), was.bar, was.panel);
    styled = false;
    if (b && was.bar && b.top !== was.bar.top) {
      bar.style.top = `${Math.round(b.top)}px`;
      styled = true;
    }
    if (p && was.panel) {
      if (p.top !== was.panel.top) panel.style.top = `${Math.round(p.top)}px`;
      // beside the little map: put by its left edge, as on a phone the style sheet centres it
      if (p.right !== was.panel.right) {
        panel.style.left = `${Math.round(p.left)}px`;
        panel.style.right = 'auto';
        panel.style.transform = 'none';
      }
      // on a low screen (a phone on its side) it scrolls rather than run off the bottom
      panel.style.maxHeight = p.bottom > innerHeight - EDGE ? `${Math.max(120, Math.round(innerHeight - EDGE - p.top))}px` : '';
      styled = true;
    }
  };
  // once a frame at most, when the bar, the panel, the little map or the screen changes
  let asked = 0;
  const soon = (): void => {
    if (!asked) asked = requestAnimationFrame(() => {
      asked = 0;
      place();
    });
  };
  const watch = new MutationObserver(soon);
  for (const el of [bar, panel]) watch.observe(el, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true, characterData: true });
  watch.observe(map, { attributes: true, attributeFilter: ['data-corner', 'style', 'hidden'] });
  // the body's class (the radio on, a touch screen) and its screen (back to play from a menu)
  watch.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-screen'] });
  addEventListener('resize', soon);
  // and now and then, for what moves the little map otherwise (the screen turned, the toolbar of a phone's browser)
  setInterval(soon, 1000);
}
