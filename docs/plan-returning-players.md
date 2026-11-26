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

## 6b. From the owner's play in Salvador and Rio (23 November, evening)

- **Hills:** on a steep bend with a heavy load the car stopped dead (Salvador; in Rio uphill by the beach it
  barely moved). On a touch screen the throttle is how far the stick is pushed, and less in a bend, and the
  hill's pull could match it. Now, uphill under power and below about 13 km/h, the hill always leaves the car
  something to climb with: slow, never stuck. A light touch still feels the hill, a wreck still rolls back,
  and backing up a hill works the same way. Tests in `tests/hills.test.ts`.
- **Jobs at the stations, on a card** (the owner: "starting the job by walking or driving towards the
  building it gets a card to read and you can accept the job or cancel it. Once you accepted doing the job
  the other standard runs are not shown and no other jobs and no buying of places is possible"). Stopping at
  a fuel, fire or police station (at its ring, or by its symbol) shows a card: "Supply run", "Rush job" or
  "Clean run", what it asks, and "Take the job" or "Not now". Before, each kind had one package at whichever
  station was nearest, and none at a station you stood at, so driving to the symbol you saw often gave
  nothing. Now the package comes to the station you stop at. Only when stopped (driving past brings no card),
  not at the very start of a visit, and "Not now" holds until you drive off. While on the job there are no
  other jobs and nothing to buy, until it is delivered or gone. Runs of three keep their plain packages,
  taken by driving onto them.
- **Has anyone played a station job?** Not counted: the counts are runs, homes, rent and guesses only. A
  count word for job kinds needs the owner's yes on the live server.

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

## 8. Parties at the homes: a reason to share (the owner, 23 November, night)

**Why.** Sharing hardly happens. Up to 23 November the counts held 47 runs of three and 28 Where am I? rounds
finished, and 1 link counted as made (the link counter was down from 15 to 17 November); 4 visits came in by a
sent link.
Only the run of three and a Where am I? round can be sent; station jobs and homes could not.

**The owner's idea:** "you buy a flat and the first thing you can do on it is 'build' (first automatic, later
literally build) an own little pickup run. A point to pick up and deliver to the home address. Let's call it
the pizza delivery for a friends' evening or a party. You need to pick up something fast (maybe even a
geo-logged restaurant or supermarket)." Asked whether station jobs or homes should be shareable: homes,
through this. Then the owner's rules (23 November): "two points you gain as soon as you play the party round;
we will see if the wording makes them already link it after… we do not reward or count the actual played
links yet." And for the end: invite more friends to whatever the event is, or say no: "somebody missing still
for tonight's party? Send this link, or no, we are already a full house, so it doesn't feel like pushing too
much."

**Built (branch `claude/party-run`; live since 24 November 2026):**

- **Where to start one:** the panel beside a home you own ("Throw a party · 2 home points", pink), or
  *Party* beside the home in the menu's Real estate, for homes in the part of town being played. Not at the
  first home while its flat is still worn down (the first-home mission), not with a package on board, not in
  Where am I?. A run of three under way stops (the card says so).
- **The card:** "Games night at your flat. Friends are coming over tonight, and nobody got the food. Fetch
  the pizza from the restaurant: the pink sign, and the arrow shows the way. Then bring it to your door before
  it gets cold: the clock starts when you pick it up. A party is worth 2 home points, once a day." The evening
  is one of party, games night, film night, birthday party, picked each time.
- **The food place** comes from the map: restaurants and fast food (the pizza), supermarkets and corner
  shops (drinks and snacks), a symbol and never a name, as decided on 14 November. Where the map has none
  near, one is made up beside a street, with a dashed ring, by the stations' rule. Counted in one map tile
  each: Nuremberg 397 restaurants and 72 supermarkets, central Berlin 212 and 16, New York 1,169 and 111,
  Tokyo 830 and 161, a Black Forest village none. The one picked is real where it can be, 450 to 1,200 m from
  the door by road, nearest 800 m. It is kept with the home, so each home's party run stays the same ("built"
  once; picking the place yourself is the later step). The food goes to the street at the door; where the
  lane at the door is a yard's driveway no road leads to, to the street in front.
- **The clock** runs from the pickup to the door: 20 s plus a second for every 9 m by road (about 110 s for
  800 m), quicker than a plain job, not a rush job. While it is on there are no other jobs and nothing to
  buy, as with a station's job. ☰ says what is on and offers "Call off the party". If the clock runs out:
  "The pizza got cold … Try again?"
- **The pay:** no cash. The first party of a day pays 2 home points (one extra flat a day at most, like the
  flat without a realtor); later ones that day pay nothing and say so. A party counts as the day's play, so
  the flat without a realtor is there after it too. Each home keeps its best time.
- **The end:** "Games night can start. The pizza got to your flat on Karl-Liebknecht-Straße in 1:21 from
  the pickup, still warm. +2 home points." Then one question: **"Someone still missing for tonight's games
  night?"** with a name field (optional), **"Send them a link"** and **"No, we're a full house"**. After a
  link is sent the buttons read "Send it to someone else" and "That's everyone". The first time, a line
  says the link shows where the flat is in the game. On a phone the phone's own share list opens.
- **The friend's side** (`?p=…`): a card "Adam's film night. Adam has friends over tonight, and the pizza
  is still missing. Take a car, fetch it from the restaurant with the pink sign … Adam did it in 1:21." The
  friend starts at Adam's home, fetches from the same place, and is timed the same way. At the end: "You
  brought the pizza to Adam's film night … 15 s faster than Adam", for a player without a home "A party of
  your own needs a home of your own: do a couple of deliveries, and you'll be shown a cheap flat", and "Let
  Adam know you made it?" with "Send Adam your time" or "No, just keep driving". The friend gets no points,
  and the link leaves the address once the card is closed.
- **Not counted, not rewarded:** no count words for party links made or opened, as asked. Visits and the
  city played are counted as for every visit.
- Kept under `3da-party` (the food place of each home, the day the points were last paid, best times), so
  saving online carries it.

**Tested:** 15 new tests (`tests/party.test.ts`): the food place picked, the clock, points once a day, what is
kept, the link both ways, and the party in the game (one ring only, no pay, the time from the pickup, cold
food, calling it off, the arrow). All 156 tests pass. Played through in headless Chromium on real Berlin map
tiles, at desktop size and on an iPhone-sized screen: a flat bought, the party thrown from the panel and from
Real estate, driven by the autopilot (1:21 and 1:03), +2 points, the second party of the day without points,
the link made, opened in a fresh browser as the friend (1:06, "15 s faster than Adam"), called off from ☰.
In Nuremberg's old town the test's autopilot wedged in a lane before any party (as it does there in plain
play too). Not tested: a real phone's share list, a real player.

**Narrow lanes: walk the last bit, never far (the owner, 24 November):** "with narrow lanes it might also be
possible to walk then instead. Just make sure it wouldn't become an endless walk." Built:

- The way from the food place to the door is looked at over its last 300 m: where a car does not fit for
  4 m or more (clear of walls by its half width and a little), the lane counts as too narrow. A corner or gate
  post grazing the way does not count. Further out the player picks their own way, so it is not looked at.
- A walk of up to **150 m** (`WALK_MAX`): the food still goes to the door. The card says "The lane to your
  door is too narrow for a car: park where it gets narrow and walk the last 80 m. The clock allows for it."
  The clock adds 6 s to get out and a second for every 6 m walked. As the car gets near, a line says "Leave
  the car here and walk the last bit".
- Longer than that, never an endless walk: the food goes to the corner where the car stops ("the friends
  meet you at the corner where a car can go"), or to the street in front if a car gets nearer the home there.
- The link carries the walk and the corner, so a friend plays the same, and a link can never ask for more
  than 150 m.
- Measured on real tiles, 50 to 150 flats each: Nuremberg (two spots) and Berlin, none narrow at the door;
  Paris 1 in 50; Florence's old town, of 150 flats, 120 to the door by car, 25 with a walk (35 to 125 m), 5
  at the corner (209 to 244 m from the building), with the rules as they stand after the fifth review.
- Played through in Florence (Via dei Pandolfini, walk 10 m): the line to leave the car came, the autopilot
  got out 13 m before the door and walked, 2:10; the friend from the link the same way, 1:14.
- The autopilot (for tests and filming), on a party with a walk only, leaves a car that gets no nearer the
  door by road for 4 s, within the walk and 80 m more, and walks the rest along the road. Other jobs are
  driven as before.

**Reviews (24 November).** Code reviews of the branch against `main`.

- The first found four important points, all fixed and checked in the browser: a friend's party from a link
  followed the player to another city when the invited place did not load (now it stays with its place, and
  the link leaves the address); a time sent back without a name was read as the host's own; food lost to a
  fine was quietly replaced (now a card: "The pizza is gone … Try again?"); the autopilot walked on every
  kind of job. And three small ones: the party button made "Buy the rest of the building" look secondary;
  it promised points when home points were full; a note was not saved online at once.
- The second found one important point: a home's food place was picked again (and its best time compared
  with another route) when it lay outside the part of town loaded now. It now stays the home's; a new one
  is picked only where the roads no longer lead to it, and then the old best time goes. Small ones, fixed
  too: the line to leave the car now goes by the way by road, not by a street passing near; the host opening
  a friend's returned link plays it as their own party ("A friend's time to beat: 1:04", points and best
  time as their own); the map's restaurants are told apart in a grid, so a city centre with thousands of
  them does not slow the next square.
- The third found narrower cases, all fixed: the line to leave the car measured from an earlier party's
  door; a home whose food place lies outside the part of town loaded now lost its walk (the end of the way
  at the door is now kept with the food place); a food place near the edge of that part of town was picked
  again; the autopilot could not get out between lane walls (it now backs up first); a party with room for
  only 1 point promised 2; a guest with the host's own name sent a link that read as the host's (the link
  now says it is a time sent back).
- The fourth found two more: a home with two possible doors could keep the food place of the door it did
  not use (and lose its best time); a lane narrow for longer than the 300 m looked at put the corner inside
  it. Fixed: only the door used keeps its food place; the narrow part is followed back to where it really
  begins. Small ones fixed too: no food place nearer than 150 m by road (it would be delivered at once); the
  invitation line stays with its place and shows as long as a sent run's; a host opening their own link is
  spoken to as the host; a run to an older food place sets no best time.
- The fifth found three more in the new narrow-lane rules, all fixed: lanes narrow all the way from the
  food place could put the corner at the pickup (such a door is now passed over); a home's food place could
  still be picked again where the road to it leaves the part of town loaded now, and that was kept before the
  card was answered (now a home keeps its food place for good, and it is kept only on "Let's go"); a gate or
  an arch on the way, with an ordinary street after it, counted as a walk to the door (now a narrow bit with
  60 m where a car fits after it is passed over: a car gets round it). Small ones fixed: a run a friend sent
  ends cleanly when a party starts (and leaves the address), and the card says so for any run; a link for the
  first flat while it is still worn down is played as a guest's; the road search runs once per door; "+1
  home point".
- The sixth found three more, fixed: where no door can be reached by car from a home's own food place, as
  seen from this part of town, the party now fetches from another place for that once (the home keeps its
  own, and its best time); a best time is kept only for the home's own food place; a made-up food place is
  never more than 1.6 km away by road. And a new player arriving by a party's link gets "Walk to a car and
  press E" instead of the tour of the deliveries, which says nothing true of a party.
- The seventh found nothing important, five small points, all fixed: the way to the bank or a home asked
  for during a party now says it comes after the party; the one-time note on home points waits for the party
  to end; the autopilot starts each new goal afresh; party links work far north and far south; names with
  emoji are never cut in half in a link. The branch passed, and went live on the owner's word ("review it
  and bring it live if the review passes", 24 November).
- Played through again after the fixes, in Berlin (host 1:03, friend 1:00, host on the friend's returned
  link 1:14, "A friend was 14 s faster") and in Florence (walk at the door, the line to leave the car at the
  lane: host 1:19, friend 1:27, host on the returned link 1:36; earlier, the card for food lost to the police). The autopilot's own driving varies from run to run in
  Florence's lanes and on longer ways in Berlin; real players were not tried.

**Questions for the owner:**

1. The evenings (party, games night, film night, birthday party) and the foods (pizza; drinks and snacks):
   more, or other words?
2. 2 points once a day: right, or should every home's first party of the day pay?
3. Later: should a friend who plays a party bring something to the host (the owner said not yet)?

## 9. From the owner's play in Kiel and Rio (24 November, evening)

The owner: "The gardens and green are still a little unsharp. The jobs at the departments now in the same
colour as the regular jobs seem to completely take over. The rings shouldn't have the same color … I'd even go
for the fire dept (red ring) police (blue ring) gas station (orange ring) house jobs (? ring)." And on the
plain packages after a run: with the new jobs from the houses "maybe they can stay out and it can continue as
is (the three runs from the beginning)". Read as: no plain packages among the open jobs (as now), and the run
of three at the start stays as it is.

**Built (branch `claude/ring-colours`, not live; with the fix for trains below):**

- **A ring in the colour of who gives the job** (`RING` in `src/game/services.ts`, the colours of the signs):
  turquoise for a plain package (the run of three, a sent run's plain legs), orange at a fuel station, red at
  a fire station, blue at a police station, pink for the party's food (as its sign). While a home of yours
  needs a package (the worn-down flat, a renovation), the stations' rings flash **green**, the colour of homes
  in the game, instead of blinking out (first pink; the owner: pink for the party is fine, "but I wouldn't put
  it regularly for home missions"). Where to deliver stays yellow, always. A run's packages, a sent
  run's too, stay turquoise: they are taken by driving through, with no card.
- The arrow, the way on the little map, the dots on both maps and the line on the road (`G`) take the colour
  of the ring they lead to. The start screen's legend and the big map's key show the colours; the tour says
  "turquoise ring" (it said blue, which is now the police's); the open jobs' note and the renovation lines
  ("their rings flash green") say so too.
- **Sharp green** (`src/game/sharpGround.ts`): parks, gardens, lawns, woods, water and the paths painted with
  them are one picture over the square, 4096 px for 1.5 km on a computer and 2048 on a tablet: 0.37 or
  0.73 m a pixel, stretched over 20 to 30 pixels of the screen from the street. Painting more finely would cost
  memory the iPad lacks. Instead a step in the ground's shader finds where the picture blends between two
  colours, reads the colour on either side, and cuts the blend down to about a pixel of the screen. Left soft
  on purpose: lines about a pixel of the picture wide, spots where three colours crowd together, faint
  shades, and the high look from above. `?try=softground` in the link turns it off, to compare.
- **Checked in headless Chromium on real Kiel tiles** (screenshots before and after, at walking and driving
  height, at computer and iPad size): edges of parks, lawns, paths and squares crisp; a few faint specks
  where faint shades meet. A browser that paints the picture with only 4 samples a pixel (the test browser's
  GPU canvas) made the half-way line wavy; averaging along the edge fixed it. The cost on a real GPU was not
  measured: two more reads of the picture for every pixel of ground, four more at edges. The test browser draws
  without a graphics chip and showed 5 frames in 3 s against 8 without it, at iPad size: a rough sign that
  it is not free. On the iPad it needs the owner's eye (`?try=softground` to compare).
- **Rings checked in the same browser:** open jobs in Kiel, an orange, a red and a blue ring at their signs,
  the arrow blue towards the nearest (police), the little map's dots and way in the same colours. Tests:
  `tests/rings.test.ts` (6).

**A train going to and fro across a square in Shibuya** (the owner's screenshot, 24 November). The map has
bits of railway 5 to 6 m long where the Keio Inokashira line comes up between tunnels, and the game put its
25 m train on one. Now a connected stretch of track shorter than 200 m (80 m for trams) gets no train or tram;
the bit is still drawn. In that square of Shibuya, 11 such bits (165 m of 34 km of track); the trains still
run on the viaducts. Tests in `tests/roads.test.ts`.

**Feedback from Dresden (via the owner, 24 November): "The street-level train is slanted."** A tram was
steered like a car, towards a point 7 to 15 m ahead of its middle: inside its own 19 m. On bends and after
points it stood across its rails. Measured over 150 s of play at Postplatz: one sample in ten 15° or more off
the rails, at worst 70°. Now the front bogie runs along the rails (at points it takes the branch the tram is
headed for), the back bogie follows where the front has been, and the body lies between them; speed, braking
and knocks are as before. Afterwards: one in ten under 1.7°, at worst 15°, where several tracks branch and
the measure takes the wrong branch (the screenshot shows the tram on its rails). At the main station, trains
and trams: at worst 37° before, 7° after. Test: a tram round a 25 m bend stays within 4° (18° before),
`tests/rails.test.ts`.

**Feedback from Dresden: "Encountering traffic on one-way streets too."** The game had no one-way streets:
traffic went both ways on each, and Dresden's big streets are mapped as two one-way carriageways. The map
tiles say which streets are one-way (`oneway`); Dresden's centre has 54 km of them in 210 km of streets. Now
traffic is put on one the way it goes, never turns into one the wrong way while there is another way on, and
leaves one at the first way out if it got on wrongly (where the map leaves a one-way street at a dead end and
the car turns round). Such a car out of sight goes, as cars that drive off do. The player may still drive
any way, unfined, and the arrow's way does not mind one-way streets (the owner: "It's fine if the arrow
points against it"). Counted over
4 minutes of play each in two parts of Dresden's centre, the player walking about: of the cars seen on
one-way streets, 19 of 41 drove against the arrow before, 0 of 38 after. Tests: `tests/oneway.test.ts`.

**Reviews before going live (24 to 25 November).** The owner: "Yes review and put it live". Eleven code
reviews of the whole branch against `main`; most important findings were in the new rails: a tram put on
mid-bend or near points, two trams head on on one track, a tram on the parallel track taken for one head on,
short stubs that touch long track, the front and the driver's look ahead parting at points, a wreck still held
on its rails, a knock that pushed the tram as well. One-way streets: a sharp legal turn before a wrong-way
straight on, wrong-way cars leaving by a street and keeping far enough over to pass. All fixed, each with a
test (`tests/rails.test.ts`, `tests/oneway.test.ts`, `tests/roads.test.ts`; 204 tests in all). Checked in the
browser in Dresden after each round: both ends of every tram and train within about half a metre of a rail
(at a buffer stop a train's back may hang past the end for a moment); no car seen driving against a one-way
street for more than a second; against `main`, three runs each, trams cover the same distance and traffic is
the same. Roundabouts: the tiles mark them one-way (checked at Albertplatz). Browser regressions
(`tools/ui-test.mjs`) passed.

**The radio:** a trial, on in a browser once its link has `?try=radio`, and remembered there until
`?try=noradio`. On the iPad it was switched on that way; on the Mac it never was, so there is no FM button.
Whether to turn it on for everyone is the owner's call.

## 10. From the owner's play in Edinburgh (25 November)

**"I guess the street should go in a tunnel there. The restaurant for the party mission seems to not be
reachable from this side. As well on foot not."** The street is North Bridge, which crosses Waverley station
high up. The map has the station's roof below the bridge (an outline 15 m tall), but the game lays every
street on the ground, and bridges cut nothing out of buildings: from the north end, 113 of the bridge's
170 m ran into the station and two low buildings under it, by car and on both pavements. The party's food
was picked up on the bridge, 30 m in.

- **A street bridge up in the air cuts away what it crosses,** open to the sky along its deck (the street and
  2 m either side), and so do its pavements (footpath bridges beside it, within 14 m nearly all the way), but
  only what the street itself cuts. Up in the air: the ground under it lies 3 m or more below the line between
  the heights where the whole bridge meets the ground (North Bridge: 6.6 m); a bridge the map or the tiles cut
  in pieces, or with a side bridge joining it in the air, is measured whole. A building standing more than
  12 m above the deck rises up through it, as the towers of Tower Bridge: the bridge goes through it under a
  roof, as a street through a house. From above the street now crosses the station's roof, as on a photo from the air; the
  station's tracks show under it. A footbridge on its own is left alone: walkways from house to house are
  footpath bridges too, and on Hong Kong's slopes some lie 4 m over the line between their ends, enough to cut
  towers open. Where a bridge ends inside a building it must be up in the air in there itself. Compared with
  `main`, building by building: Minneapolis, Calgary, London, Paris and Lisbon unchanged; Edinburgh the
  station and the two buildings under the bridge; Shibuya four, where the expressway crosses railway buildings
  over Route 246; Genoa three small ones in the way of the elevated road; Hong Kong three, a slab across a main
  road under a flyover among them. Now a car and a walker get
  along all of North Bridge and both its pavements.
- **No ring where a car can't stand:** run packages, station jobs, drop-offs (a mission's too) and the party's
  food go only where a circle of 1 m is clear of walls and water, else up to 24 m along the street where it is:
  a station's spot against its kiosk still has its package. A home's food place kept from before that turns out
  to lie in a building: that party fetches from another place, and the home keeps its own. Replayed runs and
  parties from a link keep the sender's places.
- **Trains and trams pass under a road bridge,** or over a street on theirs, without meeting the cars or the
  people there, and don't wait for them; at a level crossing they meet as before. The game has no heights for vehicles: on
  `main` a train under North Bridge carried a car stopped on it 273 m along the tracks. Told from the tracks
  and streets where they meet: only where every track there is on one level, every street on the other, and
  they cross rather than run side by side. So a railway or a station under a road bridge; but where a road
  bridge crosses a street with tram tracks in it, the place alone can't tell the bridge from the street, and
  a tram meets the cars there as before (as under a road on stilts along its street); and whoever walks along
  the tracks right under a bridge is taken to be on it. In Dresden, three runs
  each against `main`: traffic the same, trams a little further (0.45 to 0.69 km against 0.25 to 0.45).

Tests: `tests/passages.test.ts`, `tests/rings.test.ts`, `tests/party.test.ts`, `tests/rails.test.ts`.

**Code review (25 November):** nine findings, all fixed: the level of a car told from the nearest road
alone (a road on stilts over a tram's street), a tram and a street on one bridge, a mission's drop-off and a
station's spot against a wall, bridges in pieces, a walkway beside a flyover through a tower, the pavement
check's cost while a square loads, a carried-over train's track in the new square, a real food place dropped
for one bad spot.
A second review: seven findings, fixed but for one left as it is (a run sent by link keeps the sender's
places, so that runs compare): towers far above a bridge, a side bridge joining in the air, a bridge drawn as
a ring, a dense old town with no place for a ring (after many tries one goes where asked, as before), wide
bridges, and pauses while the bridges are worked out.
A third review: seven findings, fixed: a ring in a building after many tries (the fallback is gone: a station
with nowhere to stand within 24 m gives no package, as others do), a bridge's roofed way through a tower
keeping a building's own passages from being cut, bridges leaving the square loaded, pavements as high as
their street, people on a bridge over the tracks, the frame's cache, a comment.
A fourth review: a pavement's height taken from a bridge elsewhere off its street's reach, a wreck of a
train no longer on its tracks, a home's kept food place against a wall (now a step along, and kept so):
fixed. Left as they are, and said above: a tram in a street crossed by a road bridge, someone on the tracks
under a bridge. The bridges take 3 to 23 ms of a square's loading (Hong Kong, Tokyo, Chongqing, Edinburgh),
in steps of their own.

**Going live:** on the owner's word ("Put the bridge fix live", 25 November), by pull request #19.

## 11. The radio: for everyone asked, held back for the law (the owner, 25 and 26 November)

"Before putting the live weather in i would put the radio live for everyone." It was a trial, on in a browser
with `?try=radio`: the owner had it on the iPad, never on the Mac. It was built for everyone (an FM button for
all, off until tapped, Radio Browser credited on the start screen), and then held back before going live:
"Don't put it live yet check the legal obstacles first."

**The law, as far as it was looked into (not a lawyer's advice):**
- A plain link to what is freely online with the rights holders' consent is no new "communication to the
  public" (EU Court of Justice, *Svensson*, 2014); one who links for profit is taken to know when what he
  links to is unlicensed (*GS Media*, 2016).
- Warner and Sony against TuneIn (England, 2019; Court of Appeal 2021, on those European rulings): a radio app
  linking listeners in the UK to stations licensed for the UK did no wrong; to foreign stations licensed only
  at home it did, bringing them to a new public, and its checks of licences did not save it, as it ran for
  profit. TuneIn then shut its foreign stations off in the UK.
- GEMA and GVL hold web radio licensable; GVL asks a licence for several countries once listeners come from
  abroad. Stations are mostly licensed at home.
- The game's radio plays stations of any town on earth to players wherever they are: the case found
  infringing. In Germany the likely trouble is a lawyer's letter with costs (Abmahnung); more so if the game
  earns money.
- No trouble with Radio Browser itself: its free service may be used in commercial software.
- Apart from the radio: the site has no privacy policy and no legal notice (Impressum), though it already
  contacts OpenFreeMap, AWS, Photon, Nominatim and Supabase; tapping FM would add Radio Browser and stations
  worldwide (the player's address goes to them). For the owner, with a lawyer.

**The owner's word (26 November):** "I'm really sad there's no work around but let's do it like you suggest."
So the radio stays a trial; for everyone only with a media lawyer's word. A way round to weigh then: FM opening
the station's own page in a new tab, a plain link, instead of playing in the game.

**What goes live from the work, for everyone:**
- **The top right of the screen kept clear** (`src/clearOf.ts`), measured on an iPad (both ways round), a
  phone (both ways round), a narrow window and a computer: with the little map in the top right corner, a
  building's for-sale panel hid it (the owner's iPad); now it sits beside the little map where there is room,
  else under it, scrolling on a low screen. For the radio's trial too: on a phone its bar lay over the little
  map, on an iPad it hid the panel's top line; now the bar goes under the little map and the panel under the
  bar. Placed again whenever one of them changes (and once a second besides).
- **On a narrow phone (360 px)** the four buttons at the top are a little smaller and closer, so that FM, in
  the trial, stays clear of the cash. On the narrowest phones (320 px, the first iPhone SE) it still touches
  the cash panel by a few pixels.
- **"next ›"** shows only while a station plays.

Checked in the browser with a stand-in for the directory and the stations (this session's network reaches
neither): nothing is asked of anyone before FM is tapped; then a station plays and its name shows, next ›
moves on, and out of the car the bar says the radio plays in a car. Tests: `tests/radio.test.ts`,
`tests/clearOf.test.ts`. Two code reviews: a for-sale panel that scrolls on a low screen jumped back to its top
four times a second; beside the little map it stayed put on a narrow screen (centred by the style sheet); next
› while looking for stations; the bar and panel shown a moment in the old place; work done while nothing
shows; FM over the cash on a 360 px phone; placed again on coming back from a menu: all fixed.

**Going live:** the layout fixes, on the owner's word (26 November), by pull request #21; the radio stays a trial.
