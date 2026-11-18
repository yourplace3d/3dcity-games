/**
 * The few places where the game, run as a phone app (Capacitor), does something other than in a
 * browser. On the web none of this loads: the app's own parts are fetched only inside the app.
 */

/** Whether the game runs inside the phone app rather than in a browser. */
export function inApp(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * Hand a link to the phone's own list of apps to send it with. In the app this is the phone's share
 * sheet (Android's in-app browser has no `navigator.share`); in a browser on a touch device the
 * browser's. Returns false where neither is offered, so the caller copies instead. Throws when the
 * player closes the sheet, as `navigator.share` does.
 */
export async function shareLink(text: string, url: string): Promise<boolean> {
  if (inApp()) {
    const { Share } = await import('@capacitor/share');
    if (!(await Share.canShare()).value) return false;
    await Share.share({ text, url });
    return true;
  }
  if (document.body.classList.contains('touch') && navigator.share) {
    await navigator.share({ text, url });
    return true;
  }
  return false;
}

/**
 * Android's back button (or back gesture). `back` does what Esc does and says whether it did
 * anything; when it did nothing (on the start screen) the app goes to the background instead of
 * closing, so a game in progress is still there when the player comes back.
 */
export function onBackButton(back: () => boolean): void {
  if (!inApp()) return;
  void import('@capacitor/app').then(({ App }) =>
    App.addListener('backButton', () => {
      if (!back()) void App.minimizeApp();
    }),
  );
}
