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
| 2, at the start | A card: "Your homes paid you $X rent", each home with what it paid and where. Homes in the part of town being played are on a map in the card, each with its amount. | Built, branch `claude/returning-players` |
| 2, after a delivery or a minute of play | A mission: you carry cash, the police take a quarter of it when they catch you, bring it to the bank. The arrow shows the nearest bank. | Built, same branch |
| From then on | When the cash carried grows large, a reminder and the arrow to the nearest bank, for a while. | Built, same branch |
| 3 and later | Things happen at your homes: a flat needs renovating, and more. Missions solve them. | Brainstorm, section 4 |

## 3. What is built (branch `claude/returning-players`, not merged, not live)

### The rent card

- On the first visit of a new day, about 3 seconds in (after the place's name has been read), the game
  waits behind a card: **"Welcome back. Your 3 homes paid you $1,320 rent."**
- Under it, the homes by town, as in the list of homes: "A flat on Königstraße +$384". A flat still worn
  down shows no amount. More than 8 homes in one town: "and 12 more homes: $4,100".
- **The map:** if any of the homes stand in the part of town being played, the card shows a map of them,
  zoomed to fit the homes and the player, with a green tag beside each home: "+$384". Homes in another
  city are only listed.
- **The last line** says the rent is cash in your pocket now, that the police take a quarter of the cash
  carried, and that money in the bank is safe. Away from the home town, it says where the banks are.
- While a city is being guessed ("Where am I?"), the card waits until the guess is over, so the homes
  don't give the city away.
- Rent itself works as before: all of a day's rent comes in as cash on the first visit of that day.

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

- The map drawing can put short tags beside points, and show a part of the square (`src/game/minimap.ts`).
- Fixed on the way: a map canvas exactly 300 pixels wide stayed 150 high and drew stretched. Only the new
  card's map was that size.
- Nothing new is counted: new count words need the owner's yes on the live server's whitelist.
- Kept in the browser under `3da-banklesson`, so saving online carries it along.

### Tested

- 106 tests pass (9 new, in `tests/bankMission.test.ts`), type check and build pass.
- Played through in headless Chromium on the Nuremberg map: three flats bought, the clock set a day
  on, the page opened again. The card showed the three homes on its map with their amounts; after a minute
  the mission came; the arrow led to a bank; paying in ended it; later, $4,200 carried brought the reminder.
  Also checked: homes in Nuremberg while playing in Berlin (list, no map), on a phone-sized screen.
- Not tested: a real iPad; a real player's reaction.

## 4. Brainstorm: things that happen at your homes

The owner: "After a couple random missions being played at the next visit or after a certain time you can
decide such things happen. Next will be a flat needs renovation after a certain time. If buildings are owned
there will be a brainstorm about [what] can be done as missions like painting the house or needing the police
to bring people living in the apartment not paying to justice or the trash is on the street stuff like that or
even an ambulance because somebody got sick."

### Rules for all of them (suggested)

- **When:** from the third visit day on (visit 2 belongs to the rent and the bank), after the first delivery
  of the visit. At most one new event per visit day, and at most one open event per home.
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
| 3 | **A tenant stopped paying** (police) | The court has ordered the tenant to move out; the police carry out the order. Pick up two officers at the badge and drive them to your building without breaking the law (the clean-run rule). The tenant leaves; a new one moves in with the next delivery. No arrest, no fight. | The clean run at the badge | 1.5 days |
| 4 | **A tenant got sick** (ambulance) | Take the ambulance at the flame (in many countries the fire service runs them), fetch the tenant at your building, and drive to the hospital: a short clock, and bumps cost (both rules exist). The tenant thanks you with a bigger tip. | The rush job, a new vehicle, hospitals on the map | 2 days |
| 5 | **Trash on the street** | Bags piled in front of your building, and the neighbours complain. Take the small truck at the pump, pick up three bags around the block, drop them at the recycling yard. | A job with several pickups (new), a made-up yard | 2 days |

Not now: fire (the owner). Smaller ones from the tenants branch fit here as well: a burst pipe (the flame),
new locks after a break-in (the badge), furniture on moving day (the pump).

### Suggested order

1. **Renovation after a while,** because the owner named it next and the repairs exist.
2. **Painting,** because the paint exists.
3. **The tenant who stopped paying,** the first one with the police on your side.
4. **The ambulance,** once hospitals may be on the map (question 4).
5. **Trash,** which needs a job with several stops.

## 5. Questions for the owner

1. **Rent as cash on return, or waiting at the building?** This plan keeps rent coming in as cash on the
   first visit of a day, as it is live now, so there is cash to bring to the bank. Branch `claude/tenants`
   (built 18 November, never merged) makes rent wait at each building until you stop by. Suggestion: cash on
   return, and only a home with an open event keeps its rent waiting (section 4). The tenants branch's
   stars, asks and upgrades can then join section 4.
2. **A reward for the bank mission?** Suggestion: none; the money kept safe is the reward.
3. **Which event first, and how long until a flat needs renovating?** Suggestion: renovation, after 7 visit
   days.
4. **Hospitals on the map for the ambulance?** You allowed big hospitals later, without names (14 November).
   Suggestion: yes, big ones only, with a symbol and no name; made up where a part of town has none, as with
   the stations.
5. **The tenant who stopped paying:** the police carry out a court's order, with no arrest and no chase.
   Is that the tone you want?

## 6. Before anything goes live

- The owner plays branch `claude/returning-players` (a test build, or after merging), and says yes.
- Then a pull request, merged by the owner, and a deploy only after the owner says so.
- `claude/tenants` and this branch both change `src/homesUi.ts`: whichever is merged second needs care.
