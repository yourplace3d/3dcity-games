# Plan: players who come back

Written 23 November 2026, after the owner's answer to the third-currency handoff. It sets the order of what
a player meets on their first visits, says what of it is built, and holds the brainstorm on what can happen
at the player's homes. Plain words; "estimate" marks anything assumed.

## 1. The owner's decision (23 November)

In their words: "we'd rather leave the second currency as well for a little longer on the wishlist and
instead should continue with missions and learning how to use bank and such."

- **Street cred goes on the wishlist,** like the third currency. Nothing of either was built. The documents
  stay on branch `claude/plan-plates-and-staff` for later: `docs/brainstorm-second-currency.md`,
  `HANDOFF-third-currency.md`, `HANDOFF-economy.md`.
- **The questions waiting there** (round 3's six, and the third currency's 1 to 3) now wait with cred. Nobody
  needs to answer them now.
- **Next are missions and the bank,** for players who come back: the order below.
- **Fire is left out for now** ("Maybe we leave burning out for now"): no burning building as an event.

Why this order fits the numbers: 87% of visits end within 5 minutes, and 12 of 98 new browsers came back
(play counts, 17 to 19 November). The second visit is where a player is won or lost, so it should show
right away what the first visit built.

## 2. The order of visits

| Visit | What happens | State |
|---|---|---|
| 1 | Two deliveries, then a cheap worn-down flat to buy (the first-home mission). | Live since 18 November |
| 2, at the start | A line: "Welcome back. Today your 3 homes paid you $1,320 rent." The first five times it adds "Tap here to see your homes", which opens the menu on its real estate. | Built, branch `claude/returning-players` |
| 2, after a delivery or a minute of play | A mission: you carry cash, the police take a quarter of it when they catch you, bring it to the bank. The arrow shows the nearest bank. | Built, same branch |
| From then on | When the cash carried grows large, a reminder and the arrow to the nearest bank, for a while. | Built, same branch |
| Always | ☰ pauses and opens the menu: ❚❚ (paused), "Real estate", "Trophies". A house button beside it opens the real estate; its ring fills with home points: one for each delivery, and a home takes points. | Built, same branch |
| 3 and later | Things happen at your homes: a flat needs renovating, and more. Missions solve them. | Brainstorm, section 4 |

## 3. What is built (branch `claude/returning-players`, not merged, not live)

### The rent line (changed on the owner's word, 23 November)

The owner: "Instead of showing it too long on the minimap and blocking it stick to the message rent was paid
only. First five times the sentence added click here to find the houses (the menu to the side opens)."

- On the first visit of a new day, about 3 seconds in (after the place's name has been read), a line:
  **"Welcome back. Today your 3 homes paid you $1,320 rent."** The game does not stop.
- **The first five times** it adds "Tap here to see your homes" ("Click" on a computer), and tapping the line
  opens the menu on its real estate. Of the three lines the screen holds at once, this one is the last to be
  pushed out.
- Not while a city is being guessed ("Where am I?"): the homes would give the city away.
- The first try, a card with a map of the homes and their amounts, is gone.
- Rent itself works as before: all of a day's rent comes in as cash on the first visit of that day.

### The menu: paused, real estate, trophies

The owner chose a house button, the game waiting while the menu is open, the big map and then the arrow for
a home, and trophies built now. Then, the same day: "Making the menu button the pause button and if there s
no necessary to keep it as a side menu and open while driving we can make it an over the window menu?" So the
side menu became a card over the game, one with the pause card.

- **☰ pauses** and opens the menu over the game, which waits. P and Esc do the same. The ❚❚ button is gone,
  and "Main menu" (the start screen) is now inside the menu. Three tabs:
  - **❚❚ (paused):** the tab shows the pause sign, not the word (the owner, 23 November). What is being played, "Continue", "Do open jobs instead" (or "Start a run of three"), "Main
    menu".
  - **Real estate:** the home points at the top ("5 home points", and under it "You may buy 2 flats now; a house at 10 points"), what
    the homes pay and the cash carried, then the homes by town. A home in the part of town being played has
    "On the map": the big map opens with the home blinking in a yellow ring, and once the map is closed the
    arrow points the way. A home elsewhere has "Go there", which loads that place.
  - **Trophies:** 17, in four groups, each with how it is earned, and the date once it is.
- **The house button,** beside ☰ and the sound, opens the menu on its real estate. Its ring fills with home
  points toward a house (10 points), green, then yellow when a house is in reach. A green number on it says
  how many flats the points buy now.
- On the start screen, "Real estate (3) & trophies" opens the menu without the paused tab. While a city is
  guessed, only the paused tab shows, as the homes would give the city away.

### Home points: the limit on buying homes

The owner liked the limit that grows with missions best, and asked for a counter that fills up (section 5).

- **One point for each delivery** (a run's, an open job's, a mission's package). Up to 20 wait.
- **A flat takes 2, a house 10, a whole building 2 for each flat it adds.** A building that would take more
  than 20 (more than 10 flats) shows "too big for now".
- **The first home, and the rest of its building in the first-home mission, take none.**
- **One flat or house a day takes none,** once a delivery has been made that day (the owner, 23 November:
  "one flat/object should be buyable anyways per day"). The "for sale" panel says "no realtor needed",
  and under it "Today one flat or house can be bought without a realtor: no points needed" (the owner's
  wording; first "free today", which sounded as if the home cost nothing). The number on the house button
  counts it. Never a whole building.
- **Buying the rest of a building** takes points only for the flats it adds: the flat you own already took
  its points (a building of 5 flats: 4 × 2 = 8).
- The "for sale" panel says what is missing ("Buy a flat $2,100: after 1 more delivery") and how many points
  you have; so does the offer after a run.
- Kept under `3da-points`, with the day the free home was last taken and the last day a delivery was made.
  Points start at 0 for everyone, also for players who have homes already.

**Points wait from day to day, or start at 0 each day?** The owner thought "maybe start at zero" and asked for
a recommendation (23 November). The model (estimate, as in section 5; homes after 365 visit days):

| Rule | 5 min a day | 60 min a day | 100 date changes without playing |
|---|---|---|---|
| Points start at 0 each day, one free a day | 729 | 4,016 | +100 homes |
| Points wait (up to 20), one free a day | 731 | 4,016 | +100 homes |
| **Points wait (up to 20), one free a day after a delivery that day (built)** | **731** | **4,016** | **+0** |

The totals hardly differ, because players spend their points each day. But starting at 0 means a
five-minute player (2 deliveries a day) can never save the 10 points for a house, and points lost at midnight
punish a short day. And a free home with no delivery brings one home for each change of the phone's date. So
points wait, and the free home comes after the day's first delivery: one line each to change if the owner
prefers otherwise.

### Trophies

Nothing is paid for them and nothing can be bought with them. Called trophies, not badges, because "the
badge" is already the police station's symbol. Our own flat discs, grey until earned (`src/trophies.ts`).

| Group | Trophies |
|---|---|
| Getting started | First car · First delivery · A run of three · First home · Money in the bank |
| Real estate | Five homes · A whole building · A fresh coat (paint one) · Two towns · $1,000 a day |
| Driving | Shaken off (lose the police) · A clean run (three with no fine) · Time to spare (rush job, 30 s left) · 100 deliveries |
| Places | Five places · Twenty places (each a town or more apart) · City guessed (Where am I?) |

A new trophy brings a line ("Trophy: First car"); tapping it opens the trophies. A player who already has
homes earns the ones that fit at once, in one line.

### The mission to the bank

- **When:** on a visit after rent has come in on a return (so never on the day of the first home), in the
  home town, after the first delivery of that visit or after 60 seconds of play, whichever comes first,
  with at least $100 carried and no package on board.
- **The card:** "Mission: to the bank. You carry $1,660 in cash. If the police catch you, they take $420 of
  it, and a wreck costs a share too. Money in the bank is safe from fines, and it still pays for homes in
  Nuremberg. The arrow shows the nearest bank: stop beside it and pay in." Buttons: "Show me the bank",
  "Later".
- **"Later"** asks again on another day. A player who leaves the game on the way is pointed to the bank
  again on the next visit to the home town.
- **Done:** paying in brings "Your money is safe", and says reminders will come.
- **No reward** besides the safe money (my choice, to be confirmed: question 2).
- A player who has paid in before (anyone with savings) never gets the mission, only the reminders.

### The reminder

- When the cash carried reaches **$1,000, or one day of rent from all homes if that is more** (a player
  with $5,000 rent a day is reminded at $5,000), in the home town, with no package on board.
- A line: "You carry $4,200. Caught by the police, you'd lose $1,050: the arrow shows the nearest bank."
  The arrow shows the bank for 45 seconds; a package taken on the way has its own arrow.
- **At most once every 4 minutes of play,** and the first one not before a minute into a visit.
- These numbers are a first guess (estimate), in `src/game/bankMission.ts`.

### What else changed

- The big map can make one point blink (`src/game/minimap.ts`).
- The game tells listeners about deliveries, fines, the police shaken off and runs finished
  (`Game.events`), for the trophies.
- Fixed on the way: a map canvas exactly 300 pixels wide stayed 150 high and drew stretched.
- The radio button (a trial, `?try=radio`) stays where it was: the house button took the place of ❚❚.
- Nothing new is counted: new count words need the owner's yes on the live server's whitelist.
- Kept in the browser, so saving online carries them along: `3da-banklesson`, `3da-points`,
  `3da-trophies`, `3da-rentnotes`.

### Tested

- 115 tests pass (`tests/bankMission.test.ts`, `tests/homePoints.test.ts` are new), type check and build
  pass.
- Played through in headless Chromium on the Nuremberg map: three flats bought (the first free, then 2
  points each), the clock set a day on, the page opened again. The rent line came with "Click here"; clicking
  it opened the side menu; the trophies showed 3 of 17; "On the map" opened the big map with the home
  blinking, and after closing it the arrow pointed to the home, 192 m away; beside a flat for sale with 1
  point, the panel said "after 1 more delivery". Then the menu: ☰ opens it on "Paused", Esc closes it, the house
  button opens it on "Real estate", the start screen opens it without "Paused"; checked on an iPhone-sized
  screen too. The
  mission to the bank and the reminder were played through before the rent card became a line.
- Not tested: a real iPad; a real player's reaction.

## 4. Brainstorm: things that happen at your homes

The owner: "After a couple random missions being played at the next visit or after a certain time you can
decide such things happen. Next will be a flat needs renovation after a certain time. If buildings are owned
there will be a brainstorm about [what] can be done as missions like painting the house or needing the police
to bring people living in the apartment not paying to justice or the trash is on the street stuff like that or
even an ambulance because somebody got sick."

### Rules for all of them (built with step 1, 23 November)

- **When:** from the second day with a home on, or on the first after 30 minutes of play (the owner: "we can
  start with from visit 2 on or even with visit 1 if visit 1 is longer than say 30 minutes"), after the
  first delivery of the visit, and not within 30 seconds of another card. At most one new event a day,
  and at most one open event per home. Not while the first-home mission still uses the stations' packages.
- **Where:** only at homes in the town being played, so the mission can be driven now.
- **What it costs:** while an event is open, that one home's rent **waits** at the building. It is not lost:
  it is paid out when the event is solved. So nothing is lost for missing a day (the house rule), and no
  event grows worse while the player is away.
- **Chosen at random** among the player's homes, never by the part of town: the game makes no statement
  about real neighbourhoods, and the police behave the same everywhere.
- **Each event is a mission** built from parts the game has: the three station symbols (pump, flame,
  badge), a package to the building, the arrow, the clock, the police.
- **The pay:** the rent that waited, plus a small tip from the tenants (estimate: a quarter of a day's rent,
  as on the tenants branch).

### The missions

| # | Event | The mission | Built from | Build (estimate) |
|---|---|---|---|---|
| 1 | **A flat needs renovating** (the owner's "next") | After a while (suggest: 7 visit days after it was bought or last renovated) the flat's walls wear down, grey like the first-home flat. A package from any station repairs it. | The first-home mission's repairs (`src/game/renovation.ts`) | 1 day |
| 2 | **The house needs painting** | Whole houses and buildings only. The colour fades. Paint from the pump, a heavy load (careful driving pays more), then choose the colour at the building. | The supply run and the paint panel | half a day |
| 3a | **The tenants stopped paying: go and settle it** (the owner, 23 November: "the tenants are not paying anymore go there and have a dispute") | The home's rent waits at the building until you go there. Stop beside it: the tenants say why (the heating has been broken for weeks, say). You decide on a card, and each choice can go two ways, so there are always at least four outcomes (the owner's design, below). | Rent that waits at the building (the tenants branch's idea), a card | 1 day |
| 3b | **The court's order** (police) | When the tenants still will not pay, the court orders them to move out, and the police carry out the order. Pick up two officers at the badge and drive them to your building without breaking the law (the clean-run rule). The tenants leave; new ones move in with the next delivery. No arrest, no fight. **The bill is high** (the owner): the court's and the officers' costs, several days of the home's rent (estimate: 5). | The clean run at the badge | 1.5 days |

**The dispute's four outcomes** (the owner, 23 November: "We need both options to have an escalation variant
… so you have always at least four different outcome possibilities"):

| You choose | It goes well | It escalates |
|---|---|---|
| **Insist on all of it** | They pay everything they owe: settled. | They still will not pay: you come back with the police (3b), and the bill is high. |
| **Accept part of it** (a lower rent for now) | They pay what they agreed: settled, the rent a little lower for a while. | The broken thing is still broken and gets worse: now the whole of it must be replaced, which costs more than the rent you gave up, and a repair mission follows (a package from the matching station, as for renovation). |

Which way it goes is chance, the same for every home and every part of town (estimate: an even chance at
first; to be tuned from play). Nothing in the wording blames the tenants or the neighbourhood.
| 4 | **A tenant got sick** (ambulance) | Take the ambulance at the flame (in many countries the fire service runs them), fetch the tenant at your building, and drive to the hospital: a short clock, and bumps cost (both rules exist). The tenant thanks you with a bigger tip. | The rush job, a new vehicle, hospitals on the map | 2 days |
| 5 | **Trash on the street** | Bags piled in front of your building, and the neighbours complain. Take the small truck at the pump, pick up three bags around the block, drop them at the recycling yard. | A job with several pickups (new), a made-up yard | 2 days |

Not now: fire (the owner). Smaller ones from the tenants branch fit here as well: a burst pipe (the flame),
new locks after a break-in (the badge), furniture on moving day (the pump).

### Suggested order (23 November, after the owner's answers)

1. **Renovation after a while** (1 day): the owner named it next, and the repairs exist.
2. **Tenants who stopped paying: the dispute** (1 day): the owner's own idea, and the first time a mission
   sends you to one of your homes rather than to a station. It also tries out rent that waits at a building,
   for one home, before any wider change to rent.
3. **The court's order with the police** (1.5 days): what happens when a dispute fails, so it comes right
   after.
4. **The ambulance** (2 days): hospitals on the map (yes, 23 November), a new vehicle.
5. **Painting** (half a day): cheap, but much like renovation, so it comes later, for variety.
6. **Trash** (2 days): needs a job with several stops, the most that is new.

About 8 build days in all (estimate). The rules for all of them are as above: from the second day with a
home (or after 30 minutes on the first), at most one new event a day, after the first delivery, at a home in
the town being played, chosen at random, and the home's rent waits (it is not lost) until the event is
solved. The owner agreed to this order on 23 November.

### Step 1, renovation: built (branch `claude/returning-players`, not live)

- **When:** a home bought or last renovated 7 days ago or more (estimate), in the part of town being
  played, under the rules above.
- **What you see:** a card, "Your flat needs renovating": its walls are worn down, its rent waits at the
  building (it is not lost), and a package from any fuel, fire or police station brings what it needs. The
  walls turn grey, the station symbols blink (once a run is over), and the list of homes says "Needs
  renovating".
- **Solved:** the package delivered to the building. The rent that waited is paid out, the tenants thank you
  with a quarter of a day's rent, and the walls get their colour back.
- On a new day while it is open: "$456 waits at your flat on Königstraße until it is renovated."
- Kept under `3da-events`. Played through in headless Chromium in Nuremberg.

## 5. A limit on buying homes (the owner, 23 November)

The owner: "We need to also assure that per turn not too many houses can be bought otherwise buying a few flats
and leaving and returning after a year would let you buy the whole city." Asked: a limit that grows with visits
or missions, or a fixed limit per visit?

**Where the leak is.** Coming back after a year pays one day of rent, not 365: rent is paid once for each day
you come back (`rentDue` in `src/game/homes.ts`). The leak is that the rent snowballs. A home pays 24% of its
price on each visit day, so it pays for itself in about 4 visit days, and every home bought with rent brings
more rent. Two more ways in: setting the phone's date to another day brings another day's rent at once (known
since 21 November), and one whole building can hold hundreds of flats.

**The model** (estimate: a flat costs $1,500, a job is 800 m, all money goes into flats, no fines; cash is
capped at $1,000,000 carried plus $1,000,000 in the bank). Homes owned after so many visit days:

| Rule | 5 minutes a day: 30 days | 90 days | 365 days | 60 minutes a day: 30 days | 90 days | 365 days |
|---|---|---|---|---|---|---|
| No limit (as now) | 2,783 | 81,242 | 447,817 | 21,119 | 101,099 | 467,674 |
| Fixed: 2 per visit day | 57 | 177 | 727 | 60 | 180 | 730 |
| Grows with visits: 1, plus 1 more per 10 visit days | 63 | 459 | 6,881 | 63 | 459 | 6,881 |
| Grows with missions: 1 per 2 deliveries, up to 5 saved | 31 | 91 | 366 | 150 | 450 | 1,825 |

The date trick (10 real days of 5 minutes, then the date changed 100 times without playing): no limit 30 → 106,477
homes; fixed 17 → 217; grows with visits 11 → 671; **grows with missions 11 → 11.**

**Decided (the owner, 23 November): the limit grows with missions,** shown as a counter that fills up.
Built as below; see section 3, "Home points".
- **One home for every 2 deliveries** (a run's, an open job's, or a mission's package). Up to 5 can wait, so
  a long drive without buying still counts, but not without end.
- **A whole building counts as its flats:** a building of 8 flats needs 16 deliveries. Otherwise one purchase
  could be 400 flats.
- **The first home, and the rest of its building in the first-home mission, are free of the limit:** they are
  how a new player learns.
- **On screen** only where it matters, on the "for sale" panel: "Your next home: after 1 more delivery." No
  counter in the corner, so it doesn't look like a second currency.

Why: it ties homes to playing, not to waiting or to the calendar. Coming back after a year gives one day of
rent, and that rent still needs deliveries to become homes. The date trick then only brings cash, which the
$1,000,000 cap already limits. A fixed limit treats the 5-minute and the 60-minute player alike, and a limit
that grows with visits pays for showing up rather than for playing, and lets the date trick through.

## 6. Questions for the owner, and the answers of 23 November

1. **Rent as cash on return, or waiting at the building?** Answer: "leave it arriving as cash for now but
   note the idea to differ may get necessary to collect can also be used as from time to time mission. In
   you apt at that location the tenants are not paying anymore go there and have a dispute." So rent stays
   cash on return. Rent that waits to be collected may come later; for now it is the dispute mission
   (section 4, 3a), for one home at a time.
2. **A reward for going to the bank?** Answer: "No. And it s not a mission per se it just makes sure money
   stays in the bank." So no reward, and it no longer calls itself a mission: the card says "Good to know"
   above "Keep your cash safe", and the line on the way "To the bank: the arrow shows the nearest one".
   Then: "it must be somehow selectable so the bank 'mission' is showing the navigation to the next bank".
   Built: tap "Bank $… ›" in the money box, or "Show the way to the nearest bank" in Real estate, and the
   arrow leads to the nearest bank until you are there (asked again, it is turned off). Outside the home
   town, a line says where the banks are.
3. **Which event first?** Answer: "show me which order you d suggest", then "the Event order is fine". The
   order is in section 4; renovation is built. Events start from visit 2, or on visit 1 after 30 minutes.
   A flat needs renovating 7 days after it was bought or last renovated (estimate).
4. **Hospitals on the map for the ambulance?** Answer: "Sounds like a plan." Big ones only, a symbol and no
   name; made up where a part of town has none, as with the stations.
5. **The tenant who stopped paying:** a court's order carried out by the police, no arrest, no chase.
   Answer: "I assume like this yes", and later "that s fine but the bill should be high". The tone, in
   short: the tenants are told by the court to move out, the officers you drive there hand over the order,
   the tenants leave, new ones move in; and it costs several days of the home's rent.

6. **Home points:** a flat 2 and a house 10 (yes, 23 November), up to 20 waiting, so buildings of more than 10
   flats are out of reach for now. One flat or house a day needs no points, after the day's first delivery. Points
   wait from day to day rather than starting at 0 (the owner's "maybe"; see section 3). Agreed?

## 7. Going live (23 November 2026)

The owner: "Ok review it and bring it live if the review passes."

- **Four code reviews** of the whole branch against `main`. The first three each found problems marked
  important, all fixed and checked in the browser: tappable lines lay over the steering pad on touch screens
  (they now take no taps there; the house button pulses and leads where the line would); a new plain line
  could vanish at once; the bank's arrow went missing behind a way to a home elsewhere; the bank's card named
  the city in Where am I?; the offer after a run ignored points; a line could do nothing on a tablet with a
  trackpad. The fourth found only small points; the quick ones were fixed too.
- **Said once to players who had homes before:** "New: home points. Each delivery earns one; a flat takes 2,
  a house 10. After your first delivery each day, one flat or house can be bought without a realtor."
  Players whose first home comes after this never get it.
- **Left for later** (small, from the fourth review): the menu opened from the start screen before any place
  is loaded leaves out the day's flat without a realtor; the menu's checks against opening over the result
  card apply only while playing (nothing opens it there today).
- `claude/tenants` (never merged) also changes `src/homesUi.ts`: merging it later needs care.
