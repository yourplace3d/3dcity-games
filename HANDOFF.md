# Handoff: 3DA, from the cloud session to a local one

Written 12 November 2026 for a Claude Code session running on the owner's Mac. Everything the cloud session
knew that isn't obvious from the code is here. Read `README.md` first for what the game is and where the code
lives.

## Right now (26 November 2026, night)

- **Live:** `main` at `1114856`, deploy run 73 (26 November, 20:07 UTC), checked on the live site. In it, the
  same day: **the story, step A** (pull request #24, below); trees in woods, parks and gardens, standing on the
  ground (#23 and #25, another session: `docs/trees.md`); rivers with quay walls and real bridges (#12); the
  thin-map warning under the search field (#20); police following a player they see going the wrong way (#13).

### The story (owner, 26 November: "improve the gameplay aka story now")

- **What is live (step A):** eight chapters that put what the game had in order: Arrival, Making rent, A roof
  over your head (the worn-down flat), Safe money (the bank), The regulars (a job at each kind of station),
  Housewarming (a party), The whole building, and Landlord (chapter 8, shown as "Coming"). The first visit
  plays straight through to the first flat; then one new chapter on each new day you play. The game speaks
  plainly; whoever gives a task writes a message on a paper of their own (the pump a till receipt, the fire
  station a pager, the police a notebook, the neighbour a card, the friends text bubbles). Nobody calls. First
  names come from the region of the first home. The menu has a **Story** tab. How it all works: README, "A story
  in eight chapters"; every decision and its reason: `docs/brainstorm-story.md` (sections 1 to 15).
- **Put live on the owner's word** ("Yes" to "review it and put it live if the review passes") after five code
  reviews, whose fixes are listed in the brainstorm, section 15. The owner looked at it live: "looks good".
- **Code:** `src/game/story.ts` (the rules, no screen: chapters, the day gate, what each says),
  `src/storyUi.ts` (messages, the Story tab, the way), `src/game/names.ts` (34 lists of 20 first names by
  rough boxes), hooks in `src/homesUi.ts` (`atHomeTown`, `homeTownName`, `homeTownAt`, `dropWay`, the cards'
  `kicker`, `wayToBank(toggle)`) and `src/main.ts` (`storyQuiet`, `goHome`, `showEl`). Kept as `3da-story`.
- **Tests:** `tests/story.test.ts`, `tests/names.test.ts` (all 60 built-in cities and 89 border towns get the
  right list); `node tools/story-test.mjs` plays it in a browser on real tiles (`SHOTS=<folder>` for
  screenshots). In the software-rendered test browser a screenshot takes 10 to 20 seconds and the game runs
  slowly: the test sets the story's played seconds by hand, and the gap between messages is in real time.
- **Counted:** `chapter` with its number, once a browser for each chapter finished in play (not the ones ticked
  for a player who was further on). On the server since 18:58 UTC, 26 November (migration
  "play_counts_chapter", by the session "3DA: connecting and getting online", which keeps the database). Read:
  `select day, detail, n from play_counts where kind = 'chapter' order by day desc, detail;`
- **How it behaves, on purpose:** a player who is further on starts at chapter 5, which introduces the people;
  messages wait while a card, the menu, the map or the tour is up and while a run of three is on; the station
  people and the neighbour write only in the home town (their messages are kept until then), the friends
  wherever a home of the player's stands; the bank chapter waits for the home town, chapter 6 only where no
  home stands, chapter 7 only while the first building is being finished; no story in Where am I? or while a
  friend's run or party from a link is on; the Story tab shows once a place has been played on the page.
- **Built, not live: step B, chapter 8 Landlord** (branch `claude/story-brainstorm`, pushed; waiting for the
  owner to look at it and say yes before it goes live). The tenants' dispute as the owner chose it ("4c"): a
  note in one of two moods; stopped beside the home, insist (a rush job, the part from a fire station) or
  accept part (a supply run from a pump), or "Not now"; the choice that fits the note gets more time or a
  lighter load; the drive decides. Insisting too late brings the court's order (a clean run with the police
  officer and a colleague, a bill of 5 days' rent, new tenants with the next delivery); accepting part and
  arriving dented, a new boiler at 3 days' rent. Settling the first ends the story ("That's the whole story so
  far") with the trophy "The whole story"; after it, disputes come as events at the homes too. Also: the Story
  tab's "The story so far", tenants who bring dessert to the next party. Every number is an estimate to tune
  from play. Code: `src/game/dispute.ts`, the dispute's part of `src/homesUi.ts`, chapter 8 in `story.ts` and
  `storyUi.ts`; the mission package can now be limited to one kind of station (`Game.special.kinds`). One code
  review, its fixes in; unit tests (`tests/dispute.test.ts`) and `node tools/story-test.mjs`, which now plays
  chapter 8 on Nuremberg's tiles, pass. Everything decided and why: brainstorm, section 16.
- **Built, not live: find the car** (branch `claude/find-the-car`, on top of step B; pushed). The owner's
  answers on chases (27 November): the edge of the loaded map and a dead end are natural ends of a chase, a
  chased car going the wrong way takes you with it (fine), and the order is find the car and drive it back,
  then an undercover chase (a tail, where offences count), then a wild one. The first is built: the pump
  attendant's scene, from the day after chapter 5, a car in an orange circle on the maps, seen when near,
  driven back to her pump. Brainstorm, section 17. Waiting for the owner's look, with step B.
- **To ask the owner with step B:** the numbers (court's bill 5 days' rent, new boiler 3 days', a fifth less
  rent for 7 days, the part's clock ×1.4, half the load), and whether disputes as events after chapter 8 should
  come as often as renovations (now: a home bought 3 days ago or more, none there for 14 days, and at most
  one thing open in a part of town).
- **Next, in the owner's order** ("1-3 consequential", the daily story kept in view):
  - *Step C, the people's own stories:* five jobs each for the pump, the fire station and the police, one scene
    a day, one choice each; after a couple of jobs each sends you to another town (the nearest built-in city,
    "Go there"); **car chases** go into the story (the owner: "definitely"), the first in the pump's story (a
    driver leaves without paying: stay close until the bar fills). The pump's choice is tied in order (the
    owner's yes): lending opens free repair at her pump now; buying in pays a share like rent, and the garage
    comes with cars of your own. Sections 7, 13 (10) and 14. About 3 days, plus 2 to 3 for the chase.
  - *Step D, a short story each day:* the same for everyone that day, filling the gaps (the owner's "6 yes"):
    offered once the day's chapter is done or where it can't be played. Section 10. About 3.5 days.
- **Open, waiting on the owner:** the police officer's "Was it you?" (a choice with nothing to win): keep it,
  only when it really happened, or drop it for a choice with something at stake such as a chase (section 14).
- **To check:** the name lists come from general knowledge of common names, not from each country's
  statistics; check them before they grow. Not tested on a real device.

### Also open, waiting on the owner

- *Live weather:* on hold, the owner's call (26 November). If it comes back: Open-Meteo is free and needs no
  key, but its free tier is for non-commercial use and asks for a credit line ("Weather data by
  Open-Meteo.com"). GTW, a sandbox on the real Earth, was looked at for ideas only; the owner wants no credit
  to it, and none is owed as no code was taken.
- *The radio for everyone:* only with a media lawyer's word (the plan, section 11). A way round to weigh then:
  FM opening the station's own page in a new tab, a plain link, instead of playing in the game.
- *A privacy policy and a legal notice (Impressum):* the site has neither, though it contacts OpenFreeMap,
  AWS, Photon, Nominatim and Supabase. For the owner, with a lawyer.

- **Known limits, left as they are:** where a road bridge crosses a street with tram tracks in it, trams and
  cars still meet there (the place alone can't tell the bridge from the street); someone walking along the
  tracks right under a bridge counts as on it; on the narrowest phones (320 px) the radio trial's FM button
  touches the cash panel.

- **The owner put street cred on the wishlist,** like the third currency: missions and learning to use the
  bank come first, for players who come back. The plan and the brainstorm of what happens at the player's
  homes: `docs/plan-returning-players.md`.
- **Going live on the owner's word** ("review it and bring it live if the review passes", 23 November):
  branch `claude/returning-players`, merged into `main` by pull request after four code reviews. In it: a
  line on return saying what the homes paid, the mission to the bank and its reminder, ☰ as one menu
  (❚❚, "Real estate", "Trophies") with a house button beside it, 17 trophies, and home points (a delivery
  earns one; a flat takes 2, a house 10; one flat or house a day without a realtor, after the day's first
  delivery). Live since 23 November (pull request #14, deploy run 61, checked on the live site).
- **The owner's answers of 23 November** are in the plan, section 6: rent stays cash on return; the bank
  is a tip, not a mission, with no reward; hospitals may go on the map; the police mission's tone is right.
  The order of the events at the player's homes is in section 4 (agreed). Step 1, renovation, and the way to
  the bank on demand go live on the owner's word ("Put it live", 23 November) after three code reviews.
  Next is step 2, the tenants' dispute with its four outcomes.
- **Then, from the owner's play:** hills never stop a car under power, and jobs at the stations come on a
  card (take it or not; then only that job). Live on the owner's word ("then you can push both") after two
  code reviews: the plan, section 6b.

- **Parties at the homes, to reward sharing (owner, 23 November, night):** stop beside a home you own to throw
  a party: fetch the pizza (a restaurant) or drinks and snacks (a supermarket) from the map and bring it to the
  door against the clock. 2 home points for the day's first party, no cash. At the end, softly: "Someone still
  missing for tonight's party?" with a link, or "No, we're a full house". Links are neither rewarded nor
  counted (the owner's word). Up a lane too narrow for a car you walk the last bit, never more than 150 m;
  further than that the friends meet you at the corner (the owner, 24 November). Seven code reviews, live
  on the owner's word since 24 November 2026: the plan, section 8.

- **Ring colours and sharp green (owner, 24 November, after Kiel and Rio):** each giver's ring in its sign's
  colour (fuel orange, fire red, police blue, a plain package turquoise), pink for the party's food, green
  flashing on a station's ring while a home of yours waits for its package, yellow to deliver; parks and
  gardens drawn with sharp edges by a step in the ground's shader. Branch `claude/ring-colours`, merged by
  pull request #18 and put live on the owner's word ("Yes review and put it live", 24 November) after
  thirteen code reviews: the plan, section 9. The radio was then a trial switched on per browser
  (`?try=radio`); that is why it played on the owner's iPad and not on the Mac. On the same branch, from the
  owner's next round: home missions flash green (pink only for the party), no train on bits of track
  shorter than 200 m (Shibuya), trams and trains on two bogies so they lie on their rails, and traffic
  keeping to one-way streets (feedback from Dresden).
- **Bridges over buildings (owner, 25 November, Edinburgh):** North Bridge ran into the roof of Waverley
  station below it, and the party's food lay on it. Street bridges up in the air now cut what they cross open
  to the sky, with their pavements; no ring goes where a car can't stand; trains pass under road bridges
  without meeting the cars and people on them. Branch `claude/edinburgh-cuttings`, four code reviews, merged
  by pull request #19 and put live on the owner's word ("Put the bridge fix live", 25 November): the plan,
  section 10. Live weather (an idea from GTW, a sandbox on the real Earth) is on hold: the owner's call.
- **The radio stays a trial (owner, 25 and 26 November):** asked for everyone, built, then held back on the
  owner's word after a look at the law ("let's do it like you suggest"): playing stations of any town to
  players elsewhere is what a court found infringing in Warner and Sony against TuneIn. Not for everyone
  without a media lawyer's word. What went live from the work: the for-sale panel no longer hides the little
  map in the top right corner, and the radio's bar keeps clear of both (`clearOf.ts`); the top buttons fit
  a 360 px phone. Branch `claude/radio-for-all`, merged by pull request #21 and put live on the owner's
  word (26 November): the plan, section 11. The site has no privacy policy and
  no legal notice (Impressum) yet, though it contacts map, search and save services: for the owner, with a
  lawyer.

- **Wrong way down a one-way street (owner, 26 November, from the Salzburg comment):** costs nothing by itself;
  a police car that sees it follows you (one heat, so a clean run is gone too). Crossing one at a junction
  doesn't count. `wrongWay` in `src/game/game.ts`, tests in `tests/oneway.test.ts`. Put live on the owner's
  word ("Oneway streets go up too", 26 November).

## Where things stand

- **The game is live** at https://yourplace3d.github.io/3dcity-games/ (public repo, GitHub Pages).
  Any city: search box, city buttons, or a link such as `…/#Hamburg` or `…/#52.5163,13.3777`.
- **Always ask the owner before deploying.** Push freely; publish to the live site only after the owner has
  seen what changed and said yes. This is their standing rule (12 November 2026).
- **Deploys are by hand.** `.github/workflows/pages.yml` runs only from the Actions tab ("Run workflow") or
  through the GitHub API. Pushing to `main` publishes nothing. The owner may want this switched to deploy on
  every push; ask before changing it.
- **The owner has played it** on an iPad and on the Mac, in Berlin, New York and Nuremberg, and likes it.
  They have not yet tried the countryside.
- **Name:** 3DA (working title was "Drive it 3D"). Wordmark, icons and social card are in `brand/`; the brand
  sheet with colours, type and voice is a private Claude artifact the owner has.
- An older copy of the game sits in a private scratch repository of the owner's. It is stale; this repo is
  the one to work in.

**A second handoff, `HANDOFF-ios.md`,** is for a session on the Mac that tries the game as an app in Xcode.

## First job for the local session

The owner recorded three play sessions on the Mac: Berlin, then New York, then Nuremberg. They are in a folder
called `3DA` on the desktop (`~/Desktop/3DA`) and were too large to send to the cloud session.

1. **Look through the recordings for bugs.** A way that worked before: pull frames with ffmpeg and read them as
   images, for example one frame a second as a contact sheet:
   `ffmpeg -i clip.mov -vf "fps=1,scale=480:-2,tile=5x4" sheet-%02d.jpg`
   Earlier recordings showed bugs that scripted tests had missed (a target behind a building passage, the
   player driving away from a target they couldn't see), so watch what the player is trying to do and where
   the game gets in the way.
2. **The owner mentioned lag** and thinks the screen recording caused it. If the clips stutter in a way the
   recorder wouldn't explain, measure: frame time in the browser's performance panel, with and without recording.
3. **A new teaser** is to be cut from these recordings, replacing the earlier one. The owner cuts video in
   their own tool; they asked for clips and a director's prompt, not a finished edit. Ask what they need.

## What the owner has asked for, and decided

- **The arrow alone shows the way.** A line on the road existed and was turned off after the owner's first
  real play ("that's pretty much how it worked" in the game that inspired this). It is still in the code:
  `game.showRoute = true`.
- **Bus stops are green**, because yellow read as a delivery target. Tram stops red, subway entrances blue.
- **The owner asked what the blue dots are.** They are subway entrances. Nothing on screen says so until you
  stand on one. A label or a first-time hint was offered and not yet answered.
- **Thin places get a warning** on the start screen, with links to OpenStreetMap and its beginners' guide, and
  a "Play here anyway" button. It sits right under the search field with the button first, so it is seen
  without scrolling on any screen (owner, 25 November). The owner asked for exactly this wording idea: you can play, but we recommend
  adding map material first, here is how, or play a recommended city.
- **Public transport came first among the data ideas**, without real schedules: "the lines might be set up as
  normal bus traffic". Done from map tiles alone (see below).
- **The long-term idea:** the game built from a city's own open data, using the layers of the sister app
  Your Place · Data (https://yourplace3d.github.io/3dcitydata/, source in `yourplace3d/3d-city`, branch `v2`):
  incomes and rents per area, timetables (GTFS), traffic counts, steepness. "You may be in a rich or poor
  borough, you might take the subway." Not started. One caution raised with the owner and left for them to
  decide: tie wealth data to prices, cars and pay, and keep police behaviour the same everywhere, so the game
  makes no statement about real neighbourhoods.
- **A run is three deliveries (five until 14 November 2026), with a scoreboard** (`RUN_JOBS` and `RUN_STEPS` in `game.ts`, `src/scores.ts`).
  The owner asked for simple missions because cities differ, and a board "where one can write their name
  if they want to". The board is kept in the browser only. A board shared between players needs a
  server; that was put to the owner and not yet decided.
- **Coming back more often (14 November 2026).** The owner asked how to make people return: a comparable
  scoreboard, a chat, leaving the take-a-car frame, a link to their "3D view social idea". Chosen first: the
  challenge link (`src/challenge.ts`, `Game.course`, `Game.newRun(course)`), because it needs no server. A
  shared daily board, home routes with a ghost car, a courier or bus-driver frame without police, and notes
  left at places were laid out and put off; live chat was advised against. A counter of opened links was
  wanted but left out for now, since it needs a service. Which project holds the "social idea" is still open.
- **Pay inside a run counts that run's deliveries** (not every delivery ever made on the device), so two
  players are paid alike for the same run. Fines still take a share of the player's cash, which differs.
- **Decided on 14 November 2026, all live.** A run is three deliveries. The challenge button is the one yellow
  button on the result card. The place's name is shown across the screen at the start. Trains run on the
  railway: one coach, no stations, no braking for cars (the owner: "trains don't brake"), turning back at a
  dead end. Streams slow a car; rivers still stop it. No counter of links for now: the owner will see from
  friends whether links come back; GoatCounter was suggested over Supabase if one is wanted later.
- **The smear on the iPad** (dark streaks of fine lines that stay put on the screen) is most likely the
  pointing arrow, not the 3D picture. The owner saw it appear right after driving over a package ring, which
  is when the arrow jumps from the ring to the edge of the screen. The arrow was a zero-size element moved
  every frame, with an SVG carrying a `drop-shadow` filter hanging outside it; the iPad's browser left the
  shadow behind along the arrow's path. It is now a 120 px box on its own layer with no filter
  (`#arrow` in `styles.css`), live since 14 November. It never showed in the headless test browser, so this
  is not confirmed: the owner says so only if it comes back. Two earlier tries were wrong guesses about
  shadows: the ground casting none (kept, harmless) and hard-edged shadows (taken back). If it returns:
  `?try=noshadow`, `hard`, `nosmoke`, `fullres` in the link each turn one suspect off.
- **Local colours (14 November 2026).** The owner's "3d data app" session found that open data records a
  colour for few buildings (43 % in Midtown Manhattan, 16 % central Hamburg, under 1 % central Barcelona) and
  that unmapped ones can take a neighbour's. Its patch for the 3d-city repo was not reachable from here (it
  sits in a private scratch repo), so the owner asked for the idea to be built in the game directly:
  `src/game/localColours.ts`. Decided here: greens and blues are never guessed, and a square with nothing
  recorded keeps the plain palette instead of turning white. Counted in the game's squares: Hamburg 16 %
  recorded and 58 % from neighbours or the square's mix; Freiburg 2 % and 78 %; Paris (Louvre) 1 % and 70 %;
  New York 64 % and 29 %; Barcelona 0 %.
- **Hills (14 November 2026).** In San Francisco the owner took streets that stop on Telegraph Hill for a fault.
  The map is right: 16 streets stop within 450 m of Coit Tower, half of them at a stairway. The answer was to
  make it readable: stairs drawn as stairs, round street ends, slopes shaded (`RELIEF` in `roadMesh.ts`),
  arrowheads on steep streets, and hills in the driving of the player's car (`cars.ts`). Cost measured before
  and after in three cities: about 5 % more triangles, no measurable change in the time to build a square.
  A tilted camera was advised against. Still open: letting a car bump down a stairway.
- **Which real places the game shows (decided by the owner, 14 November 2026).**
  Named, and only where a square has no well-known sight: public places (town hall, station, museum, theatre,
  library, stadium, bus station, ferry terminal, cinema, marketplace, pool, sports centre).
  A symbol and no name: fuel stations (may become part of play later), fire stations, police stations.
  Allowed later but unnamed and not shown yet, pending research into whether they fit the play: colleges,
  universities, hospitals and big clinics (only big ones).
  Left out for now, though they could serve as mission places later without names: restaurants, cafés,
  hotels, supermarkets, banks, pharmacies, repair shops.
  Never: schools and kindergartens (the owner's rule), places of worship, cemeteries, prisons, embassies.
  Dropped while building, because of what the map files under them: post offices (parcel shops and other
  businesses) and courts (juvenile and labour courts turned up). The famous cathedrals in the hand-picked
  list stay. Missions between real places are not built; the owner has not asked for them yet.
- **Missions at the three symbols: the owner's plan (14 November 2026), four steps.**
  1. Jobs at symbols, with made-up stations where a part of town has none, and three rules: supply run at
     the pump (heavy load), rush job at the flame (short clock), clean run at the badge (an offence loses it).
     Built: `services.ts`, `jobs()` in `game.ts`, `heavy` in `cars.ts`. Challenge links carry the kinds
     (version 2 of the link; version 1 still opens).
     The owner then set where they belong: a run stays three plain packages, so that runs and challenge
     links compare. The kinds of job open after a run, from "Continue with open jobs" on its result, with
     a short note on how to find them, and can be played as long as one likes.
     Later the same day the owner asked for the choice up front instead of an explanation: the start
     screen offers "Compare with friends" (the run of three) or "Do jobs" (open jobs, "story-mode style"
     in the owner's words), remembered in the browser. A pause card (P, Esc or the button) switches too.
  2. Repair for cash at fuel stations. Not built.
  3. Buying a fuel station as a garage where a car waits; a car park where a town has no fuel station
     (parking is in every tile counted). Not built.
  4. Was "challenge links carry the kinds": done with step 1, because a sent run would otherwise have played
     by other rules than the sender's.
  Each step is published only after the owner has seen it. On copyright the owner asked for a check: rules
  such as buying a garage are free to use, names and looks of other games are not; plain words only
  ("repair", "your garage"). Not legal advice.
  Counted in 210 tiles of big-city centres: police in 90 %, fuel in 88 %, fire stations in 76 %.
- **The "3D view social idea"** is the private repo `yourplace3d/yourplace-live`: friends shown live at their
  building and floor. Agreed with the owner: no live location in the game. The two can share links between
  friends later; a run that starts or ends at a place the player picks was offered and not yet decided.
- **Streets are drawn in a fixed order, not by height** (`roadMesh.ts`). Before, where streets crossed on a
  slope, the pale kerb of one cut through the dark surface of the other ("shards"), seen by the owner in
  Ottawa and clear in Hong Kong.
- **Keep it its own thing.** The name nods at a famous game; the look, the mark and the wording must not
  imitate that game or any other. No references to it in the product or its publicity.
- **Homes to buy, so players come back (owner, 16 November 2026).** Chosen over a visitor counter as the
  first thing to do: "make them come back by implementing a reason". Decided: houses before cars, because
  they are tied to the map ("cars belong to individuals, later"); personal ownership (each player their own
  copy of the city), not shared, because cash lives in the browser and could be faked, real people's homes
  would carry player names, and newcomers would find streets taken; rent by the real hour, offered right
  after the run of three, with an affordable flat near the end "but just enough", and bigger houses shown at
  higher prices. Prices from the map alone for now (works in every village); real rent or land-value data,
  where a city publishes it, is a later step and is to touch prices only. Numbers to tune after the owner
  plays: `FLAT_BASE` 900 and the rent (see below). Built on branch
  `claude/homes`, merged to main and live since 17 November 2026 (owner: "just put it live"). Checked in Nuremberg, Manhattan, Berlin and two
  Black Forest / Franconian places: cheapest flat $640–700 everywhere, 40–60 ms to price an area.
  The owner then set a ceiling on cash: $1,000,000 for now (`MAX_CASH`), so rent can't pile up without end.
  Then the numbers were checked: rent of 3.5 % an hour made money nearly double each day (the ceiling in 12
  daily visits), and open jobs paid more with every delivery ever made, without end ($18,000 a job after
  1,000). The owner chose rent "only paid per visit": once per calendar day on the device, 24 % of the price
  (`RENT_PER_VISIT`), none while playing, a missed day not made up; about 36 visit days from one run to the
  ceiling by rent alone. Open-jobs pay now stops growing at the 50th delivery (`OPEN_JOBS_GROW`).
  **Next time the owner is back: ask whether to start the test build again** so they can try homes. It was
  run in the cloud session (`VITE_TESTING=rich npx vite build --outDir <somewhere>`, then `vite preview` on a
  port reported to the app), starting with $1,000,000 on every load; the owner stopped it on 16 November
  before trying it. If the app shows no preview, offer a hidden test folder on mindmacher.com instead.
- **Counting play in Supabase, not GoatCounter (owner, 16 November 2026).** Asked what GoatCounter changes
  for privacy, the owner set one rule: no tick box, no banner; someone who opens an invite lands straight in
  the game. Both options passed that; the owner chose Supabase only, because it can count game events as
  well as visits. Table `play_counts` (day, kind, detail, n), written only by `count_play()`
  (`docs/supabase/play_counts.sql`): `new`/`back` visits once a day per browser with a one-word source,
  `start` (a run begun, first package on board), `run` (finished), `home` (flat/house/building), `rent`, `guess` (a Where am I? round) and `time` (time played per visit: under1/1to5/5to20/over20 minutes, sent once when the page is hidden or closed; the last three added 17 November). The owner reads it in the SQL Editor:
  `select day, kind, detail, n from play_counts order by day desc, kind, detail;`. The table is live in the
  project; the game code that writes to it went live on 17 November 2026. The table was empty
  on 16 November (the owner deleted three test rows). Deletes through the Supabase tool ask the owner to
  confirm and that answer did not arrive in time, twice; for a delete, give the owner the SQL to run instead.
- **Which city is played, counted (owner, 21 November 2026; live).** After a Reddit post that
  used the same short link as the video, so the two can't be told apart ("which cities were played"
  would say more). `count_play('city', …)`: when a place has loaded, once for each city in a visit and
  only after the first touch, the place a link opens in included (`countCity`, `src/linkCount.ts`; called in `go()`, `src/main.ts`). The
  detail is the well-known city the place lies in or beside (`nearCity`, 15 km, the same rule that names a place on
  the sign: the first name in `CITIES`), else its one-degree square such as `53,9`. Never what was typed or the
  name the place search gave. Not counted: "Where I am" (that is where the visitor is), Where am I?
  rounds, baked builds, test browsers. The database function takes the 60 names, a square on Earth (at most
  500 different ones a day), and puts anything else under `other`; `tests/cityCount.test.ts` fails if its list
  and `CITIES` differ, so a new city in `places.ts` needs a new migration with its name. Migration
  "play_counts_city" (21 November), tried in a transaction first (`docs/supabase/play_counts.sql`). Read it
  with the second query in that file's header. **Live since 21 November 2026, about 20:32 UTC** (the owner said
  yes; merged into `main` at `95e0f91`, Pages run 60; the deployed bundle is byte-identical to the one tested, and
  the browser check passed against the live page with Supabase blocked). Nothing before that can be looked up:
  the only older place data is `link_counts_at` (the square of each arrival by the video link). The short address's forwarder
  (`docs/mindmacher/3da/index.html`) sets `ref=youtube` whatever the link says, so everyone sent through it counts
  as YouTube; the game's own address posted elsewhere shows as `link` (or `direct` where an app hides the sender).
- **Saving online for everyone, with homes (owner, 16 November 2026).** The owner's worry was space and
  traffic, not names: a save belongs to its secret code, so two players may share a name (a number as a
  suggestion is for later, if names are ever shown publicly). Done: the box shows on every start screen
  (`?try=nosaving` hides it in a browser); homes are kept short (`packHomes`, about 45 characters a home, a
  thousand fit); the game stops at 120,000 characters a save and says so on the card; on the server
  (`docs/supabase/saves_limits.sql`, live in the project, which the live game also uses) up to 20,000 saves,
  150,000 characters each, and saves unchanged for six months are deleted when new ones are made (a visit
  changes the save). Found while testing: the map gives one number to a group of buildings mapped as one
  thing (87 in a Nuremberg square), so a home is matched to the nearest building with its number
  (`homesIn`), never by the number alone.
  Changed on 17 November (owner): saving online opens with the first home bought ("the first building
  bought is the one that starts allowing you to save"). The box shows once the browser owns a home or is
  already saving; a card "Your first home" says so (with a button to the name field, or "saved online as
  …" for a player already saving) and the game waits behind it; a link to a saved game works for everyone.
  Left out on purpose for now (owner, 17 November): showing players which buildings are for sale and
  where. Next is what happens after the first flat is bought.
  Ideas to brainstorm with the owner (17 November, nothing decided): tie homes to the shops, restaurants and
  cafés found earlier (left out of the map for now, see above); and building something on top of a bought
  building, so players slowly change their city.
- **Banks and savings, the home plate (owner, 17 November 2026).** Savings are kept at banks, and only
  in the player's **home plate**: the town of their first home (within `PLATE_KM` 25 km of it,
  `src/game/bank.ts`). Decided: one place for now, not every city ("the challenge atm is enough"); money is
  paid in by going to a bank (stop on its spot by the street, or walk up to it); no interest, since homes
  pay rent; rent still comes in as cash, not into the bank; savings pay for things ("whatever will come"),
  for now homes bought in the home plate, cash first and the rest from the bank. Fines take only cash, so
  the bank is what keeps money safe. Banks come from the map's points of interest (`bank`), with a
  made-up one (dashed ring) where a part of town has none, by the same rule as the fuel, fire and police
  stations; a symbol, never a name. They show only in the home plate, from the first home on; the HUD
  shows "Bank $…" under the cash. Kept in `3da-bank`, so saving online carries it. No taking money out.
  Built on branch `claude/bank`; live since 18 November 2026. Raised by the owner for later, not built: cash not paid in
  could be lost between visits ("you got to take it there or you will start with zero when you come back").
  Also seen on the owner's iPad: the panel beside a building sits over the minimap and under the radio
  hint, top right; kept clear since 25 November (`clearOf.ts`).
- **Flats first, painting, and the first-home mission (owner, 17 November 2026).** Asked for together:
  - *Flats first:* "First you need to buy floors/flats... the further the game the more you can buy houses
    as a whole." A first home is a flat; houses open with the 3rd home (`HOUSES_AFTER`), whole buildings
    (buy all, or the rest of a building one has a flat in) with the 6th (`BUILDINGS_AFTER`), in `homes.ts`.
    A locked button says when it opens. Homes bought before keep what they are.
  - *Painting* ("as soon as you bought a full house"): a house or a whole building one owns can be painted
    from the panel beside it: eight colours and the map's own again (`PAINTS`). Free for now. The colour
    is kept with the home (a ninth field in the packed homes; older saves read fine) and drawn on the 3D
    building (`CityModel.paintBuilding`, by the outline handed in).
  - *Private mission:* once a player with no home has the cash for the cheapest flat in the square,
    between runs and with no package on board, a card says "Private mission open now". "Show me the place"
    picks a part of town near the player where flats are cheap (several of the cheapest flats within
    150 m of each other, within 800 m), marks up to six of them with a green $ sign, and the arrow (green)
    points there (`Game.guide`); on arrival it says from what price. Done with the first home, however
    bought. "Later" asks again on the next visit. Kept in `3da-mission`.
  Built on branch `claude/bank`, with the banks; live since 18 November 2026, with the mission rebuilt as below.
- **The first home as a worn-down flat, and a list of homes (18 November 2026).** The private mission became
  the worn-down flat (`src/game/renovation.ts`, kept in `3da-reno`): after two deliveries, flats in buildings
  of 3 to 5 flats sell for what the player has; packages from the stations repair the flat, then the rest of
  the building flat by flat, and a last one brings the paint. A player who owns a home already skips it.
  Live since 18 November (deployed 16:24 and 16:39 UTC, main at 8d4844f).
  A debugging check the same day played the whole mission through in a browser on real Berlin tiles and
  found: a building whose nearest lane is a yard's driveway (Mühlendamm, the first one the mission picked)
  never got a package, so its flat could never be repaired; rent came in on the day of the repair, though
  the game says "from tomorrow"; two wording slips. Fixed on branch `claude/project-thread-sa8i1n`, not live
  yet. Left for the owner: the offer card says "one is yours for $<all your cash>" even where the flats cost
  far less ($50,000 against $1,400 for a player from before homes).
  The owner then played the live game on the iPad in a place never played before and found $10,998 and no
  guide to a first flat: the browser carried their earlier game (cash, deliveries and a home; the "Bank"
  line under the cash shows only with a home), and the mission is for players without one. Asked for "a
  menu to show where homes are owned already": "Your homes (n)" on the start screen and the pause card, once
  a home is owned, lists the homes by town (within 15 km of the town's first one), the home plate first,
  with what each pays and how far the repairs are. "Go there" starts beside one; "Show the way" points the
  arrow at one in the town being played (`src/homesList.ts`). Offered, not built: a "Show me flats nearby"
  button on a house that is still locked, since a player with one or two homes in a street of houses finds
  nothing to buy there and nothing says where the flats are.
- **Measured building heights: not now (owner, 18 November 2026).** The owner asked whether OpenHaystack
  (home-made tags found through Apple's Find My network) could serve as a design tool: positions clustered
  into walls and heights. No: a report is the passing phone's own position, with no height, usually 5 to
  50 m off (worst beside tall buildings), and only for one's own tags. Measured outlines, heights and roof
  shapes do exist free as official 3D building models (LoD2): all of Lower Saxony, Bavaria since 2023, and
  other German states. But they come state by state, and the game has to work anywhere in the world, so
  the owner judged it too complicated for now. Heights stay from OpenStreetMap, guessed where it has none
  (the engine counts the guessed share of each square, `estimatedShare`).
- **Supabase's GitHub link: not now (owner, 17 November 2026).** The dashboard shows "No repository
  connected"; that is Supabase's optional GitHub link (changes in `supabase/migrations/` on main go live by
  themselves, and test copies of the database per pull request on a paid plan). Not set up: the Supabase
  tool already reaches the project (MindMacher / 3da-waitlist), a merge going live by itself would skip
  asking the owner, and the history in `docs/supabase/` is not in its format. Worth it later, with more
  people working on the database or real players and Pro, e.g. alongside the mindmacher.com move.
- **The older link counter was broken from 15 Nov 23:46 UTC to 17 Nov ~21:25 UTC** (found 17 November):
  `count_link_at` refused every call ("kind" ambiguous), so no challenge links made/opened and no
  `?ref=youtube` arrivals were counted in that time; `play_counts` was fine. Fixed and tested
  (`docs/supabase/link_counts_fix.sql`). After any change to a counting function, call it once inside
  `begin; … rollback;` to see it works.
- **Discord: a small, feedback-first server (owner, 27 November 2026; replaces the line below).** The plan
  is the doc "3DA Discord: setup handoff". In the game (`src/discord.ts`): a small card that can be closed,
  once, after chapter `CARD_AFTER` (2 or 3, the owner's choice), and a line on the menu's first tab. Both
  stay hidden until `INVITE` holds a real invite; nothing on the first screen, nothing in a baked build.
  A click is counted as `discord` with the chapter or `menu`, once a browser for each place.
- **Discord: not yet (owner, 17 November 2026).** An empty server puts the first people off and needs
  looking after. The owner reserves a server and its name now, with no link in the game. Open it, and add
  an invite button to the menu (a plain link, nothing counted), once a handful of players come back daily
  (`back` in `play_counts`), or to ask players about an idea (such as building on top of a building), or
  once the YouTube channel has commenting viewers.
- **Planned: move the game's home to https://mindmacher.com/3da/ (owner, 16 November 2026), then SEO.**
  Today that address is only a forwarder to github.io, tagged `?ref=youtube`, with `noindex`
  (`docs/mindmacher/3da/index.html`; the site is Hostinger shared hosting). Checked: the build uses a
  relative base, the map, search, radio and Supabase services take any origin, and only `index.html`
  (og:image) and `WEB_HOME` in `src/challenge.ts` name github.io. Plan, not started:
  1. Build for mindmacher.com/3da/: canonical, og:url, og:image and the sitemap all on that address.
  2. The github.io copy becomes a forwarder that carries the browser's saves across once: it gathers the
     `3da-*` keys (as `gather()` in `cloud.ts` does, plus `3da-full-key`) into the link's `#`, and the new
     site writes them only where that browser has nothing yet. Old links and challenges keep working.
  3. YouTube visits get their own link (`…/3da/?ref=youtube`), as search visitors will arrive at the plain one.
  4. SEO: canonical, JSON-LD (VideoGame), robots.txt, sitemap, a short readable text, and a static page
     per built-in city (`/3da/hamburg/`) with its own title, description and card.
  5. The owner adds mindmacher.com to Google Search Console and submits the sitemap.
  Open question for the owner: deploy to Hostinger by FTP from the workflow (FTP login as a repo secret,
  still started by hand) or by uploading a built folder in the file manager.

## How the game is built, in the parts that surprised

- **One square at a time.** `World.load` builds a 1.5 km square on a fixed grid (750 m steps) from OpenFreeMap
  vector tiles and AWS terrain tiles; the next square loads when you are 450 m from the centre, and everything
  near you is carried over (`Game.swap`). Loading blocks for roughly 130 ms.
- **Streets connect where they cross**, not only where a map line ends (`RoadNet.cross`). Before this the
  network was nearly disconnected. Bridges and the roads under them don't meet, and a train or tram doesn't
  meet the cars on a road bridge over its track, or under its own bridge (`Game.apart`).
- **Ways through buildings are cut out** (`passages.ts`, 19 November 2026): passages, gateways, town walls.
  Every street or footpath that goes well into a building (not one that only grazes its front) gets a corridor
  cut out at ground level: walls either side stay solid, the part above starts at 4 m and is a roof you pass
  under, and a low gate or wall is opened to the sky. Streets get at least 3.6 m, footpaths 2.6 m (a car still
  squeezes through). The tiles call `tunnel=building_passage` a tunnel; ground-level "tunnels" (layer 0 or
  none) are kept when at least half of them runs under buildings. Under a roof, a yellow shape draws you on
  top of it. Homes for sale are still chosen from the buildings as before, so owned homes don't change.
  A street bridge up in the air (the ground under it 3 m or more below the line between its ends) cuts what
  it crosses open to the sky, with 2 m either side and its pavements (25 November, North Bridge over Waverley
  station); a footbridge on its own cuts nothing, as walkways from house to house are footbridges too.
- **Water is a shape of its own** (`river.ts`, 19 November 2026). Rivers, canals, docks, lakes and the sea are
  joined into one outline per square (tiles cut them at every tile edge), cut out of the ground picture (the
  ground material has `alphaTest`, so it has a hole there) and drawn 1.4 m below the bank (0.45 m for a lake or
  pond) on the ground's own grid squares. A granite coping covers the cut edge, with a quay wall down to the
  water (an earth bank for lakes). The ground under rivers and lakes is levelled with their banks before the
  square is built, so bridges run level. A bridge over the water gets a wider deck, side faces, parapets and
  piers, only over the water and a few metres onto each bank. Driving and walking still use `WaterMask`.
- **Routes** are a shortest-path field per target (`RoadNet.field`, `RoadNet.route`). Drop-offs are only placed
  where a route exists. The distances are a `Float64Array` on purpose: with 32-bit floats the search skipped
  nodes.
- **Transit comes from the tiles' `poi` and `transportation` layers:** tram tracks are narrow `rail` lines,
  stops are `bus_stop`, `tram_stop` and `subway_entrance` points. Bus and tram lines are not the real routes.
- **Tall buildings are squashed** (`gameHeight`) so the camera can stay close; the camera also rises above
  the roofs around you.
- **`game.auto = true`** makes the game drive the jobs itself. `tools/selfdrive-test.mjs` uses it to count
  deliveries per city, and `tools/film.mjs` to film scenes frame by frame. Both need Playwright
  (`npm i -D playwright && npx playwright install chromium`) and a preview server
  (`npm run build && npx vite preview --port 4173`).
- **A build with the map shipped beside the page** (`VITE_BAKED_AT`, see README) exists for hosts that allow
  no outside requests. The Berlin preview inside Claude uses it. Vector tiles go as base64 text there.

## What was tested, and what was not

- Scripted runs, in a headless browser with software rendering at about 5 frames a second: self-driving
  deliveries in Berlin, Hamburg, Paris, New York, London, Freiburg, Nuremberg and a German village; trams
  staying on track and waiting at stops; left-hand traffic in London; the subway ride; the thin-place warning
  on eleven places; a link by name.
- **Never tested by the cloud session:** the live site itself (its address was blocked there), the place
  search against the real Photon server (tested with a stand-in answer only), touch controls on a real
  device, and real frame rates. The owner's play sessions are the only real-device evidence.
- Self-driving results vary run to run: usually two to five deliveries in eight game-minutes; an occasional
  run makes none.

## Known rough edges

- Traffic can queue behind a pedestrian walking in the road, and behind a stopped car; cars hesitate at some
  corners.
- Left-hand traffic uses rough boxes of latitude and longitude; border regions can be wrong.
- No traffic lights. One-way streets for traffic since 24 November (the player may drive any way). Sound exists since 14 November 2026 and has only been checked for
  which sounds fire when: nobody has listened to it in the test browser. Volumes and tones need the owner's ear.
- Subway rides stay within the loaded square.
- The thin-place rule counts streets across the loaded tiles, not only the square, so its numbers are loose.
- `streetKm` and the building count are the only measures of "well mapped"; a real village with complete data
  can still be called thin if it is small.

## Working conventions the owner's projects follow

- Plain, specific wording in the app, the README and commit messages; say what a thing does for the player.
- Commit messages: a short title, then a few lines on why.
- The engine in `src/geo`, `src/scene`, `src/export`, `src/data` is a copy from Walk it 3D / Your Place (MIT).
  Changes there are few and listed in the README; prefer adding to `src/game`.
- Credit the map wherever the game or pictures of it appear: "Map data © OpenStreetMap contributors".
