# Handoff: trying 3DA as an app in Xcode

Written 14 November 2026 for a Claude Code session on the owner's Mac. The aim is to find out how
3DA behaves as an iPhone and iPad app: built, run in the simulator and on the owner's own device,
with a list of what works and what doesn't. Nothing is to be submitted to a store.

Read `README.md` and `HANDOFF.md` first. They say what the game is, what the owner has decided and
how they like things written.

## What you are testing

3DA is a web game: `npm run build` makes a static site in `dist/` that runs from any folder
(`base: './'`). It has touch controls already and the owner plays it in a browser on an iPad.

The quickest way to an app is a shell that shows that same web build inside a native window.
Capacitor does this and gives an Xcode project. This handoff assumes Capacitor. If the Mac
session knows a better current way, say so to the owner before taking it.

## Before you start

- **Check the current Capacitor instructions.** The commands below were written from memory in a
  cloud session that could not open Capacitor's site. Versions and steps change; follow the
  official "Getting started" and "iOS" pages over this file.
- Needed on the Mac: Xcode with an iOS simulator, Node 22, and whatever Capacitor's iOS page
  lists (it has needed CocoaPods).
- Running on a real iPad or iPhone needs the owner's Apple ID signed in under Xcode → Settings →
  Accounts. A free account is enough for the owner's own device. Ask the owner to do the signing
  in; don't handle their password.

## Steps (verify each against the current docs)

Work on a branch, `ios-shell`. Don't change how the web game builds.

```bash
git checkout -b ios-shell
npm install
npm install @capacitor/core @capacitor/ios
npm install -D @capacitor/cli
npx cap init 3DA net.yourplace3d.threeda --web-dir dist   # the app id is a placeholder: ask the owner
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios        # opens the project in Xcode
```

In Xcode: pick an iPad simulator, press Run. Then the owner's own device.

After every change to the game: `npm run build && npx cap sync ios`, then Run again.

The build makes two pages, the game and `full/` (a page about a paid version, switched off). Only
the game matters here.

## What to find out

Play a whole run and some open jobs in two or three cities (Hamburg, Paris, San Francisco) and
note for each point: works, broken, or not tried.

**Does it start and load**
- The start screen, the city buttons, the search box.
- A city loads: the map comes from `tiles.openfreemap.org`, the terrain from AWS, the place search
  from `photon.komoot.io` and `nominatim.openstreetmap.org`. All are https. If nothing loads,
  look at the app's network rules first.
- The opening look from above, the place's name across the screen.

**Does it play**
- The drag stick on the left, **In / out** and **Brake** on the right.
- Frames per second: add `?fps` to the address the shell loads, or set
  `localStorage['drive-it-3d-fps'] = '1'` from Safari's web inspector and reload. The game lowers its resolution below 48
  frames a second; note whether it does, and on which device.
- Memory over ten minutes of driving, across several map squares (Xcode's memory gauge). A square
  holds about 600,000 triangles.
- The notch and the home bar: the top buttons (pause, sound, menu), the little map, the money box.
  The page uses `viewport-fit=cover` and `env(safe-area-inset-*)`.
- Both orientations.

**Sound** (`src/sound.ts`)
- It starts after the first touch, not before. On the iPad browser it stayed silent until the
  game asked on finger-up as well as finger-down.
- With the ring switch on silent: the game sets `navigator.audioSession.type = 'playback'` where
  that exists. Note whether sound plays.
- Leaving the app and coming back: the game pauses when hidden; sound should stop and return.

**The parts that lean on the browser**
- "Challenge a friend to beat this" on a run's result: on touch devices it calls
  `navigator.share`, otherwise it copies to the clipboard, otherwise it shows the link to copy.
  Note which happens in the shell. The link it makes points at the web address of the shell,
  which will be wrong in an app (`capacitor://…` or similar): write down what it produces. A
  real app would have to make `https://yourplace3d.github.io/3dcity-games/?c=…` links instead.
- Opening such a link in the app is not set up and needs the owner's domain to cooperate. Don't
  build it; just note it.
- What is kept on the device (`localStorage`): scoreboard, money, sound off, the chosen way to
  play, "tour seen". Quit the app fully and start it again: is it all still there?
- Links to outside (OpenStreetMap, the `full/` page): do they open in Safari or trap the player
  inside the app?
- The pause card on `P` / `Esc` and the ❚❚ button; a hardware keyboard if one is at hand.

**The known iPad fault to watch for**
- Dark streaks that stay put on the screen. On the iPad browser they were the on-screen arrow's
  shadow left behind as it moved; the arrow was rebuilt (`#arrow` in `styles.css`). If streaks
  show in the app, say exactly when (the owner noticed them right after a pickup).

## What an app would need beyond a shell

Apple turns away apps that are only a website in a wrapper (review guideline 4.2, "minimum
functionality"). List, with a rough size each, what would make 3DA more than that. Candidates:
- playing without a connection in a city already visited (the tiles are cached by the page; see
  `src/geo/mapCache`),
- game controller support,
- haptics on a crash and a delivery,
- the native share sheet and links that open the app.

This is a list for the owner to decide on. Don't build any of it without asking.

## What the owner has decided that touches this

- **Ask before anything goes public.** No TestFlight, no store upload, no pushing to `main`
  without the owner's yes.
- **Privacy:** no accounts, no cookies, no analytics. Don't add an SDK that phones home. If
  Capacitor or a plugin sends anything by default, find out and tell the owner.
- **Its own thing:** no imitation of, or reference to, any existing game in names, icons or text.
- **The app's name and id** are the owner's to choose. `net.yourplace3d.threeda` above is a
  placeholder.
- **Keep signing out of the repository:** no certificates, profiles or team ids committed. Add
  the usual Xcode user files to `.gitignore`.
- Plain, specific wording in anything the player or the owner reads.

## Where the game stands (14 November 2026)

All of this is live on the web: two ways to play chosen on the start screen (a run of three
deliveries to compare with friends, or open jobs from fuel, fire and police stations), challenge
links, sound, trains and trams on sharp tracks, roofs in local colours, named sights, hills that
show and are felt, a pause card, a look from above at the start and end of a run.

Not live: a waiting list for a paid version (branch `claude/waitlist`, switched off until the
owner supplies an Impressum). The paid version the owner has chosen is a garage and cars with a
friends league. It is not built.

## What to hand back

A short report for the owner, in plain words:
1. Did it build and run, in the simulator and on the device? With which versions of Xcode, iOS
   and Capacitor?
2. The list above, each point marked works, broken or not tried, with one line on anything broken.
3. Frames per second and memory, per device.
4. The list of what a real app would need, with rough sizes.
5. Anything the owner must decide.

Commit the shell on `ios-shell` and push the branch. Leave `main` alone.

## Android (added 18 November 2026)

The same Capacitor project now has an Android app in `android/`, made with `npx cap add android`
(Capacitor 8.6.2). It has not been built yet: the cloud session that made it has no Android SDK.

On the Mac:

```bash
git checkout ios-shell && npm ci
npm run build && npx cap sync      # copies the game into both apps
npx cap open android               # opens Android Studio; let Gradle sync, then Run
```

Android Studio installs the SDK and an emulator on first start. A real phone needs USB debugging
switched on (Settings → About phone → tap the build number seven times), no Google account.

What the app does differently from the browser (`src/native.ts`; nothing of it loads on the web):
- **Share:** "Challenge a friend", "Send this city on" and the saved-game link use the phone's share
  sheet through `@capacitor/share`. Android's in-app browser has no `navigator.share`.
- **Back button:** closes the big map, otherwise pauses or resumes like Esc. On the start screen it
  sends the app to the background instead of closing it.
- **Play counts:** a visit from the app is counted with the source `app`. The server takes that word
  only once `docs/supabase/play_counts.sql` is run again; until then it is counted as `other`.
- **Location:** Where I am asks Android for the location (permissions in `AndroidManifest.xml`).
  No location plugin, so nothing from Google Play services is added.

Symbol and splash: the road symbol on yellow (adaptive icon on Android), and the game's dark
background with the symbol while it opens, on both phones. Signing keys (`*.jks`, `*.keystore`,
`keystore.properties`) are kept out of git.

The app id is still the placeholder `net.yourplace3d.threeda`, in `capacitor.config.ts`,
`android/app/build.gradle` and the Xcode project. It can't change after the first store upload.
