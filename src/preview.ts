/**
 * A preview: a build of a pull request, published beside the live game at `preview/pr-<n>/` so it can
 * be played before it reaches players. It keeps its own store in the browser (tools/preview-storage.js),
 * does not count visits or links, and never writes to the online save: it may read a saved game, but
 * whatever is played in a preview stays in it.
 */

export const previewName = (): string => String(import.meta.env.VITE_PREVIEW ?? '');
export const isPreview = (): boolean => previewName() !== '';

/** A small mark at the top, so a preview is never mistaken for the live game. */
export function markPreview(): void {
  if (!isPreview() || typeof document === 'undefined') return;
  const tag = document.createElement('div');
  tag.textContent = `Preview · ${previewName().replace('pr-', 'PR #')}`;
  tag.setAttribute('aria-hidden', 'true');
  tag.style.cssText =
    'position:fixed;left:50%;top:env(safe-area-inset-top,0);transform:translateX(-50%);z-index:99999;' +
    'pointer-events:none;padding:2px 10px;border-radius:0 0 8px 8px;background:#e0457b;color:#fff;' +
    'font:600 11px/1.4 system-ui,sans-serif;letter-spacing:.04em;opacity:.85';
  document.body.appendChild(tag);
}
