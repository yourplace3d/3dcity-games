/**
 * What the player sees of saving (`cloud.ts`): a line on the start screen to save the game under
 * a name, carry it to another device, or stop.
 */

import { cleanName, deviceLink, fitsOnline, savedName, savingOn, startSaving, stopSaving } from './cloud';
import { T } from './i18n';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

async function hand(text: string, url: string): Promise<'shared' | 'copied' | 'shown'> {
  try {
    if (document.body.classList.contains('touch') && navigator.share) {
      await navigator.share({ text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'shown';
  }
}

/** The line on the start screen: save the game under a name, carry it to another device, stop. */
export function wireCloud(box: HTMLElement, home: string, suggested: () => string): void {
  box.hidden = false;
  const draw = (note = '', retry = false): void => {
    if (!savingOn() || retry) {
      box.innerHTML =
        `<form id="cloud-form"><input type="text" maxlength="16" placeholder="${esc(T.yourName)}" autocomplete="off" required /><button>${esc(T.saveOnline)}</button></form>` +
        `<p class="small" id="cloud-note" aria-live="polite">${esc(note) || esc(T.cloudWhy)}</p>`;
      const form = box.querySelector<HTMLFormElement>('#cloud-form')!;
      const input = form.querySelector('input')!;
      input.value = savedName() || suggested();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = cleanName(input.value);
        if (!name) return;
        form.querySelector('button')!.disabled = true;
        const saved = await startSaving(name);
        draw(saved ? '' : T.cloudFailed, !saved);
      });
      return;
    }
    box.innerHTML =
      `<p class="small">${T.cloudSavedAs(`<b>${esc(savedName())}</b>`)}</p>` +
      `<div class="row"><button type="button" id="cloud-link">${esc(T.cloudOtherDevice)}</button><button type="button" id="cloud-stop">${esc(T.cloudStop)}</button></div>` +
      `<p class="small" id="cloud-note" aria-live="polite">${esc(note || (fitsOnline() ? '' : T.cloudTooBig))}</p><input id="cloud-url" type="text" readonly hidden aria-label="${esc(T.cloudLinkLabel)}" />`;
    const say = (t: string): void => {
      box.querySelector('#cloud-note')!.textContent = t;
    };
    box.querySelector('#cloud-link')!.addEventListener('click', async () => {
      const url = deviceLink(home);
      const how = await hand(T.cloudShareTitle, url);
      const field = box.querySelector<HTMLInputElement>('#cloud-url')!;
      field.value = url;
      field.hidden = how !== 'shown';
      if (how === 'shown') field.select();
      say(T.cloudKey(how));
    });
    let sure = false;
    box.querySelector('#cloud-stop')!.addEventListener('click', async (e) => {
      if (!sure) {
        sure = true;
        (e.target as HTMLButtonElement).textContent = T.cloudSure;
        say(T.cloudSureNote);
        return;
      }
      draw((await stopSaving()) ? T.cloudDeleted : T.cloudFailed);
    });
  };
  draw();
}
