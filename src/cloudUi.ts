/**
 * What the player sees of saving (`cloud.ts`): a line on the start screen to save the game under
 * a name, carry it to another device, or stop.
 */

import { cleanName, deviceLink, fitsOnline, savedName, savingOn, startSaving, stopSaving } from './cloud';

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
  const draw = (note = ''): void => {
    if (!savingOn()) {
      box.innerHTML =
        '<form id="cloud-form"><input type="text" maxlength="16" placeholder="Your name" autocomplete="off" required /><button>Save my game online</button></form>' +
        `<p class="small" id="cloud-note" aria-live="polite">${esc(note) || 'Optional. With a name, your game is kept online so you can go on with it on another device. No email, no password. Without a name nothing is sent. A game not played for six months is deleted.'}</p>`;
      const form = box.querySelector<HTMLFormElement>('#cloud-form')!;
      const input = form.querySelector('input')!;
      input.value = suggested();
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = cleanName(input.value);
        if (!name) return;
        form.querySelector('button')!.disabled = true;
        draw((await startSaving(name)) ? '' : 'That didn’t go through. Please try again in a moment.');
      });
      return;
    }
    box.innerHTML =
      `<p class="small">Your game is saved online as <b>${esc(savedName())}</b>.</p>` +
      '<div class="row"><button type="button" id="cloud-link">Go on with it on another device</button><button type="button" id="cloud-stop">Stop saving and delete it</button></div>' +
      `<p class="small" id="cloud-note" aria-live="polite">${esc(note || (fitsOnline() ? '' : 'Your game has grown too big to save online: the online copy is from before. It is all still kept on this device.'))}</p><input id="cloud-url" type="text" readonly hidden aria-label="Link to your saved game" />`;
    const say = (t: string): void => {
      box.querySelector('#cloud-note')!.textContent = t;
    };
    box.querySelector('#cloud-link')!.addEventListener('click', async () => {
      const url = deviceLink(home);
      const how = await hand('My 3DA game', url);
      const field = box.querySelector<HTMLInputElement>('#cloud-url')!;
      field.value = url;
      field.hidden = how !== 'shown';
      if (how === 'shown') field.select();
      say(`${how === 'copied' ? 'Link copied. ' : how === 'shown' ? 'Copy this link. ' : ''}Open it on the other device. It is the key to your game: keep it to yourself.`);
    });
    let sure = false;
    box.querySelector('#cloud-stop')!.addEventListener('click', async (e) => {
      if (!sure) {
        sure = true;
        (e.target as HTMLButtonElement).textContent = 'Yes, delete the online copy';
        say('The game on this device stays. The online copy is deleted.');
        return;
      }
      draw((await stopSaving()) ? 'The online copy is deleted.' : 'That didn’t go through. Please try again in a moment.');
    });
  };
  draw();
}
