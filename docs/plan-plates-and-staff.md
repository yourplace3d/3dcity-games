# Plan: plate by plate, a team for every town (3DA, 18 November 2026)

This plan answers the owner's second message: money is for automation, each next level of automation costs
more than the last, and every plate beyond the first must be run on its own by its own staff, hired and paid
there, so the player plays plate by plate instead of buying from afar. Fines stay at 25% of the cash carried
(15% when wrecked or knocked out), never from the bank, and the game warns while the player carries a lot of
cash. The cash ceiling goes.

Every pacing and money number below comes from the economy simulator (`sim/variant-final.mjs` on
`sim/econ-final.mjs`, 5 seeds per case, the middle result reported, 180 visit days unless said). It plays the
real lots measured in the built game (Nuremberg old town, Pottenstein, Manhattan, Berlin-Zehlendorf,
Titisee); the place numbers come from the same measurements. Its minutes per action are estimates (a job 2.5
minutes, collecting rent at a building 1 minute, a bank stop 1 minute, buying half a minute), and so is the 5%
chance of a fine per job. Treat its days as a guide, not a promise.

Words used throughout:
- **Visit day**: a calendar day on which the player opens the game. Rent comes only on visit days (today's rule).
- **Casual**: 5 minutes a visit, 5 visits a week (multiply its visit days by 1.4 for calendar days).
  **Regular**: 15 minutes, every day. **Heavy**: 60 minutes, every day.
- **Buyer**: the simulated player buys the cheapest affordable home, the dearest costing at most half its money
  ("half"), or the dearest affordable. Cells written a / b / c are cheapest / half / dearest.
- **Chores**: answering tenants' asks (a 2.5-minute package each) and collecting rent at buildings (1 minute each).

---

## 1. The problem in numbers

Today's rules (branch `claude/tenants`), simulated for 120 visit days with no staff:

1. **Time runs out long before money.** Each home costs a moving day (one 2.5-minute package), then about 1.6
   minutes per visit day (half an ask at 2.5 minutes, plus collecting every third day). Chores pass the visit's
   length by visit day 3 to 8 in all 9 runs. With 6 homes a regular player needs 7.5-8.3 minutes and a casual
   one about 15 (of 5); with 20 homes 50-54 minutes; with 60 homes 131-191 minutes. A 5-minute visit cannot
   even finish the run of 3 (about 6 minutes), so the first flat comes on visit day 2. 87% of real visits so
   far were under 5 minutes (77 visits on 17-18 November).
2. **Then money outruns what can be spent, and the $1M ceilings decide.** The ceiling binds on visit day 40
   (regular, Nuremberg), 65 (heavy) and 80-97 in Manhattan. On day 120 the bank holds $986k-1M in 7 of 9 runs.
   Rent lost in full buildings: $650k (regular Nuremberg) to $364M (heavy Manhattan). Fines on cash that can
   no longer go to the bank become the main way money leaves: $2.42M for regular Nuremberg against $225k spent
   on homes.
3. **Income stops growing once chores fill the visit.** Regular Nuremberg earns $20k on visit day 10, $41k on
   day 20 and $41k on day 120, while its homes grow from 32 to 86; new homes wait for moving day and old ones
   sink to 1 star (1.06-1.18 stars on day 120 for regular and heavy players).
4. **Effort counts homes, rent counts price.** A $1M Manhattan block (one home, $240k a day) takes the same
   1.6 minutes a day as a $650 flat ($156 a day). The measured squares differ 360 times in value, from
   Titisee ($0.22M, 76 lots) to Manhattan ($80M, 943 lots). The 30 dearest homes of a square pay $31k a day
   in Titisee and $5.25M in Manhattan, a 170-fold spread.
5. **The cities themselves** (from the cities plan): the same building changes price by more than 25% for
   11-69% of the buildings two neighbouring squares share; Titisee has no fuel station, police station or
   bank, central Lisbon no fuel station, Sydney's centre no police station; one map number can stand for
   1,086 buildings (Freiburg); 2,400 roof marks cost 4,045 draw calls and about 50 ms a frame (headless test);
   finding homes in a square takes 190 ms at 2,600 homes; the online save fills at about 1,150-1,200 homes.

---

## 2. What a plate is, and the team that runs it

### A plate is a town or city

A plate is everything within 25 km of the plate's first home: the circle `bank.ts` already calls the home
plate (`PLATE_KM`). It is what a player calls "Nuremberg" or "Pottenstein". It is not the 1.5 km square,
for three reasons:
- squares are loading windows 1,500 m wide on a 750 m grid, so each overlaps its neighbours by half;
- the same building changes price between neighbouring squares (until A1 below is built);
- the code, the bank and the owner already use the 25 km plate.

A home belongs to the plate whose first home is nearest, within 25 km. A plate holds many squares, and its
team works in all of them. The owner's "run a full city tile and leave it to conquer the next one" becomes:
hire the town's team, and when it runs on its own, found the next town.

### The team: six hires per plate, in this order

The player runs **4 homes by hand** in each plate. Every home beyond that needs room from the team. Hires are
made in person at a bank of that plate, and each new hire goes on a **ride-along**: one delivery with the
player (2.5 minutes, paid like an open job). **The newest hire works two of your visit days in the plate
before the next one can be hired.**

| # | hire | opens when the plate has | what it takes over | homes the player may own in the plate after it | new play it opens |
|---|---|---|---|---|---|
| 1 | Rent collector | 4 homes, and its first worn-down building repaired and painted (plate 1: the first-home renovation) | Every visit day, takes the rent waiting at every home of the plate into the bank, where fines cannot reach it. No more collecting by hand. | 4 | Rent arrives from homes in squares and towns you are not in; no cash to carry. |
| 2 | Housekeeper | 4 homes | Answers every ask of 8 homes (the oldest moved in). Their stars stay at 3; no tip, no package for the player. | 12 | More than 4 homes; whole buildings (open from the 6th home) without their asks landing on you. |
| 3 | Housekeeper | 12 homes | 8 more homes. | 20 | A plate of 20 homes, mostly whole buildings: enough to open a shop in one. |
| 4 | Letting agent | 16 homes and 1 shop open | Does the moving day of every new home in the plate: the tenant is in by the next visit day. | 20 | Buying a street of houses or a block in one visit. The second worn-down building is offered at the bank. |
| 5 | Housekeeper | 20 homes | 8 more homes. | 28 | The last step before the manager. |
| 6 | Manager | 26 homes, 2 shops open, the second worn-down building repaired | Looks after the last 6 homes (30 in all) and runs the plate's books. | 30 (then the plate runs on its own) | The next town opens once every plate runs. More housekeepers (+8 homes each) can be hired here to grow it. |
| 7+ | Housekeeper | room full but 2 homes | 8 more homes each. | 38, 46, ... | Growing a plate past 30 homes. |

**Price of hire k in plate n** (n = 1 for the first plate): the larger of
- a floor: $2,000 / $5,000 / $20,000 / $60,000 / $160,000 / $430,000 for hires 1-6 (then x2.5 per hire),
  times 1.5 for each plate after the first; and
- days of rent: 1 / 1.5 / 2 / 2.5 / 3 / 4 days (then 6, 8, 10, ...) of what **all** the player's homes earn
  in a visit day at 3 stars, times 1.25 in plate 2, 1.5 in plate 3, 1.75 in plate 4, and so on.

So the price rises with every level and every plate, and it is always at least a few days of the player's
own income: a village player and a Manhattan player both face a real decision. The bank panel must say it that
way: "Letting agent: 2.5 days of what your homes earn ($79,000)".

What the team cost in the simulation (regular player, half buyer, one seed; hire prices in order):
- Nuremberg as plate 1: $2k, $5k, $38k, $79k, $160k, $430k = $714k. Berlin-Zehlendorf as plate 2: $106k to
  $1.49M, $3.54M in all. Manhattan as plate 3: $0.92M to $15.4M, $34.0M in all.
- Pottenstein as plate 1: $677k (the floors). Titisee as plate 2: $1.28M. Nuremberg as plate 3: $6.63M.
- Manhattan as plate 1: $1.0M. Nuremberg as plate 2: $15.2M.

**Wages**, per visit day: each housekeeper 8% of the rent of the 8 homes in their care; the rent collector 4% of the
plate's rent; the manager 3%; the letting agent one day's rent of each home the agent lets. That is about 13% of a
full plate's rent; in the simulation, 11.5-14.4% of all income. Because the collector comes first and wages
are taken from the rent the collector brings in, no team ever stopped for lack of wages in the simulation. If a team cannot be
paid (a player who empties the bank), it does nothing that day: rent waits at the buildings up to 3 days,
open asks cost a star, and nothing owned is lost.

### How many staff run a plate

Arithmetic, with the estimated minutes:
- By hand, one home costs 0.5 asks x 2.5 minutes + 1/3 collect x 1 minute = **1.58 minutes per visit day**,
  plus a 2.5-minute moving day when bought. 30 homes therefore take 47.5 minutes a day: three regular visits,
  or ten casual ones.
- A housekeeper takes the asks of 8 homes: 8 x 1.25 = **10 minutes a day**, about what a daily player can
  give to chores. Three take 30 minutes; the manager's 6 homes another 7.5.
- The rent collector takes all the collecting: 30 x 1/3 = **10 minutes a day**.
- The letting agent takes the moving days: 2.5 minutes for each new home, about 65 minutes per plate.
- The player keeps 4 homes: 5 minutes of asks on an average day, 10 minutes on the 1 day in 16 when all four ask.

So **three housekeepers, plus a rent collector, a letting agent and a manager (6 people) run a plate of 30
homes anywhere.** That answers the owner's "three, maybe more": three housekeepers carry the tenants; the
other three take the collecting, the moving days and the books.

"Maybe more" depends on the place. Owning a quarter of the square's value takes this many housekeepers
(30 homes, plus 8 for each housekeeper after the third), measured on the lots files:

| place (its 1.5 km square) | lots for sale | value of all lots | the 30 dearest homes: cost / rent a day / share of the square | lots holding a quarter of the value | housekeepers to own that quarter |
|---|---|---|---|---|---|
| Titisee (small town) | 76 | $0.22M | $129k / $31k / 59% | 10 | 3 |
| Pottenstein (village) | 424 | $1.23M | $209k / $50k / 17% | 50 | 6 |
| Berlin-Zehlendorf (suburb) | 1,295 | $14.2M | $3.50M / $839k / 25% | 31 | 4 |
| Nuremberg (old town) | 2,412 | $43.8M | $7.69M / $1.85M / 18% | 62 | 7 |
| Manhattan Midtown (towers) | 943 | $80.0M | $21.9M / $5.25M / 27% | 27 | 3 |

Old towns made of many small buildings need the most hands; a centre of a few big towers needs the fewest.

---

## 3. Playing a plate, and moving on

### The first plate

It starts as today: the run of 3, then the worn-down flat for what the player has, repaired package by
package, the rest of its building bought and repaired, then painted (`renovation.ts`). That finished building
is what the rent collector waits for. In the simulation a regular player hires the collector on visit day 4
and the first housekeeper on day 6, and has 12 homes on day 7.

### A new plate

1. **Its worn-down building.** The first home in a new town is a worn-down building at half its whole price:
   min(14, 2n + 2) flats in plate n (6 in plate 2, 8 in plate 3), never more than the largest building of
   flats in that square (Pottenstein's largest has 5, Titisee's 3). Each package from a station repairs one
   flat, one more brings the paint. Rent comes flat by flat as they are repaired. The town's banks open to
   the player with this first home. (The simulator counts its packages but not its price, a few thousand
   dollars: estimate.)
2. **Its first tenants.** Homes bought by hand, moved in by hand (a furniture delivery each) until the
   letting agent comes. Houses from the 3rd home and whole buildings from the 6th, as today.
3. **Shops downstairs.** In a whole building the player owns there: pay 2 days of that building's rent, then
   deliver 3 packages (shelves from a fuel station, a cold counter from a fire station, the till and alarm
   from a police station). The building's rent rises 15% and a sign goes on the ground floor. Two shops are
   needed for the manager.
4. **The second worn-down building**, offered at the bank once the letting agent is hired: min(14, 2n + 6)
   flats (8 in plate 1, 10 in plate 2), capped the same way, one package per flat plus the paint.
5. **Its team**, hired one by one as above.

In the simulation, renovations and shops took 32-80 minutes of play per plate, the six ride-alongs 15 and the
moving days before the agent about 40 (estimates): roughly 1.5-2.5 hours of play in every plate.

### When a plate runs on its own

A plate runs on its own when **its manager is hired, every home in it is looked after by its team (no home
left to the player, no moving day waiting), and its team was paid that visit day.** The plate card shows it
as a checklist on the way (homes 22/26, shops 1/2, second building 6/11 packages, next hire and its price).
The first time it runs, the plate gets a badge with the date. If the player later buys past what the team
covers, the plate stops running until the next housekeeper is hired; nothing is taken away, but no new town
can be founded meanwhile.

### Moving on: the next town, city and continent

- Playing stays free everywhere, as today: jobs, runs, challenge links and the city search.
- **Owning** in a new town (more than 25 km from every plate) opens only when every plate the player has runs
  on its own. Until then the offer box says what is missing ("Nuremberg: manager, needs 2 shops (1)").
- **Another continent needs a pilot**, hired at any of the player's banks: the larger of $250,000 and 5 days
  of all rent, doubling for each further continent. Continents are rough boxes, like the left-hand-traffic
  list in `world.ts` (Europe, Africa, Asia, Oceania, North America, South America). The pilot gates owning,
  never playing. In the simulation pilots cost $0.3-8M and the player waited 0-8 visit days to afford one.
- Plates left behind keep earning: their teams work every visit day wherever the player is, and bank the rent.

### The world map of plates

A map of the player's plates as pins: green for a plate that runs (with its rent a day), blue for the one in
progress (with its stage: "Pottenstein: 3 of 6 hired, 1 shop"), amber for a plate that is stalled (homes
past its team, or a team not paid). A header sums it up: "4 plates running, 1 in progress, 2 of 6 continents,
146 homes, $2.7M a visit day". Tapping a pin shows the team, the next hire and its price, and "Go there".

---

## 4. What brings players back each day (no timers to skip, no paid shortcuts)

- **Payday.** Each visit day every team banks its plate's rent. A missed day is not made up (today's rule), so
  coming back is worth a full day of rent.
- **The next hire is always in sight.** It costs a few days of rent, and the newest hire must work two of your
  visit days in the plate first. Nothing can be bought to skip that; it only counts days you come and play.
- **The order of the day.** Each open shop asks for one delivery a day, paying the job plus a quarter of the
  shop building's day rent (like a tenant's tip). Shops in old plates have orders too: a reason to drop by
  (the simulator only does the orders of the plate in progress).
- **Your own four homes:** their asks, tips and stars, painting and upgrades.
- **The plate in progress:** a renovation package, a shop to fit out, a ride-along.
- **The morning report** on the first visit of the day: what each team banked and answered, which hire can be
  made today, the orders waiting.

Nothing decays while the player is away: results per visit day are the same at 7, 2 or 1 visits a week.

---

## 5. Money

### Every number that changes

| what | now | proposed | why |
|---|---|---|---|
| Cash ceiling (`game.ts` `MAX_CASH`) | $1,000,000; pay and rent above it are lost | none; cash kept a safe whole number | owner's decision: money is for automation |
| Bank ceiling (same constant in `homesUi.ts` `collect()`, `payIn()`) | $1,000,000 | none | the bank is what keeps money safe; hire prices in days of rent keep it moving (held: 1.5-4 days of rent in the middle run) |
| Fines (`fine()`) | caught 25% of cash, wrecked or knocked out 15%, at least $50, never from the bank | **unchanged** | owner's decision |
| Cash warning (new) | none | amber line under the cash from $10,000 carried, red from $100,000 (texts below) | owner: fines stay at 25% if a warning is carried |
| Where the bank works (`bank.ts`) | only in the home plate | at the banks of every plate the player owns in; one savings account | each team is hired at its plate's bank and pays its rent into it |
| Where homes can be bought | anywhere with cash | inside the player's plates; a new town only when every plate runs | plate by plate, not from afar |
| Homes per plate | no limit | 4 by hand + what the team covers (4, 12, 20, 28, then 30 once it runs) | chores stay at or under 10 minutes |
| Team hires (new) | none | floors $2k-$430k x1.5 per plate; 1-4 days of all rent x(1 + 0.25 per plate after the first) | a rising price per level and per plate |
| Wages (new) | none | housekeeper 8% of the rent of the homes in their care, collector 4% and manager 3% of the plate's rent, agent 1 day's rent per tenant | a running cost that grows with the plate |
| Shops (new) | none | 2 days of the building's rent + 3 packages; +15% rent; one order a day paying the job + 25% of a day's rent | the owner's "renovating and shops" |
| Worn-down buildings (new beyond plate 1) | only the first-home arc | plate n: min(14, 2n + 2) flats at half price; a second one of min(14, 2n + 6) flats; both capped at the square's largest building of flats | every plate starts with in-person work |
| Pilot (new) | none | max($250k, 5 days of all rent), x2 per further continent | the owner's pilots |
| Asks answered by staff | (no staff) | no tip and no job for the player | tips stay a reward for hands-on play |
| Rent 24% a visit day, 3 days held, ask chance 0.5, tip 25%, upgrades 2/3/5/8 days, houses at the 3rd home, buildings at the 6th, open-job pay, the run of 3 | | unchanged | standing decisions; challenge links stay comparable |

### The cash warning

- Hidden below $10,000 carried (a fine is then at most $2,500, about one to four open jobs).
- **Amber from $10,000**: "At risk if caught: $3,000 · bank 350 m". The figure is a quarter of the cash; the
  distance is to the nearest of the player's banks. Outside the player's plates: "No bank of yours here. Your
  banks are in Nuremberg."
- **Red from $100,000**, same text.
- The first time it shows, a one-time card: "Cash you carry can be fined: a quarter if the police stop you,
  15% if you are wrecked or knocked out. Money in the bank is never fined, and your rent collectors pay
  straight into it."
- After a fine, the flash adds what was safe: "Caught! −$12,000 ($2.1M in the bank is safe)".

Simulated over 180 visit days (Nuremberg and Manhattan, cheapest and dearest buyers, all three player types):
- A player who pays in whenever the amber line shows loses **0.0-0.8% of income** to fines.
- The simulated player who pays in only when it saves more than the bank stop costs loses 0.04-1.6%.
- A player who waits for the red line loses 0.01-13.7%.
- A player who never pays in loses 0.04-28% (heavy, cheapest buyer: $5.6M of $20M income).

The rent collector paying straight into the bank is what keeps rich players safe; the cash at risk is mostly
the day's job pay, tips and shop orders.

### What money buys at each wealth level

| money | what it buys |
|---|---|
| under $10,000 | flats, the first-home renovation, the rent collector ($2k) and the first housekeeper ($5k) |
| $10k-$500k | houses and whole buildings, housekeepers 2 and 3, the letting agent, the first plate's manager ($430k floor), shops, upgrades |
| $0.5M-$20M | the second and third plates' teams, the first pilot, dearer homes to fill each plate's 30 places |
| $20M and up | later plates (each team about 14 days of all rent and rising), more housekeepers in a plate (6, 8, 10 ... days of rent each), pilots for further continents (x2 each); later: floors on top, a park or fountain, cars |

Over 360 visit days, hires and wages took **93-98% of all spending** in every run; homes, shops, upgrades and
pilots the rest.

### Simulated pacing (180 visit days; cheapest / half / dearest buyer)

Plates in this order: from Nuremberg: Nuremberg, Berlin-Zehlendorf, Manhattan (a pilot), Pottenstein,
Titisee. From Pottenstein: Pottenstein, Titisee, Nuremberg, Berlin-Zehlendorf, Manhattan (a pilot). From
Manhattan: Manhattan, Nuremberg (a pilot), Berlin-Zehlendorf, Pottenstein, Titisee.

| first plate | player | first flat | homes on visit day 7 | 6 homes | plate 1 runs (visit day) | days spent in plate 2 | plate 2 runs (visit day) | plates running by day 180 |
|---|---|---|---|---|---|---|---|---|
| Nuremberg | casual | 2 | 4 | 16 / 17 / 17 | 51 / 59 / 59 | 40 / 40 / 40 | 90 / 99 / 100 | 4 / 3 / 4 |
| Nuremberg | regular | 1 | 12 | 6 | 31 / 33 / 30 | 26 / 33 / 34 | 57 / 65 / 65 | 4 / 5 / 5 |
| Nuremberg | heavy | 1 | 20 | 3 | 16 / 16 / 16 | 17 / 20 / 20 | 33 / 35 / 37 | 5 |
| Pottenstein | casual | 2 | 3 / 3 / 4 | 14 / 14 / 15 | 98 / 58 / 54 | 66 / 33 / 34 | 164 / 91 / 87 | 2 / 3 / 3 |
| Pottenstein | regular | 1 | 12 | 6 | 50 / 39 / 36 | 44 / 29 / 27 | 93 / 69 / 63 | 3 / 4 / 4 |
| Pottenstein | heavy | 1 | 20 | 3 | 17 / 15 / 15 | 20 / 17 / 17 | 37 / 32 / 33 | 5 |
| Manhattan | casual | 2 | 4 | 16 / 17 / 17 | 63 / 60 / 62 | 39 / 42 / 40 | 107 / 110 / 110 | 3 |
| Manhattan | regular | 1 | 10 / 11 / 8 | 6 / 6 / 7 | 37 / 37 / 37 | 20 / 35 / 34 | 63 / 82 / 79 | 5 |
| Manhattan | heavy | 1 | 20 | 3 | 17 / 17 / 19 | 15 / 23 / 22 | 37 / 45 / 46 | 5 |

Other players:
- **10 minutes a day:** 4-6 homes on visit day 7, 6 homes on day 7-9, plate 1 on day 37-65.
- **3 minutes a day:** stays at 4 homes with about 1.85 stars. A 2.5-minute package plus the asks of 4 homes
  do not fit (as today, short visits cannot run homes).
- **A rich newcomer** who drops $1 billion into the bank when founding plate 2 still needs 11 visit days
  (heavy) or 12-14 (regular) there: the in-person work and the two days between hires hold.
- **A player who stays** in plate 1 and grows it with more housekeepers has 50-82 homes by day 180 and earns
  less than a player who moves on.
- **Later plates** (360 visit days): days spent per plate 1 to 5 were, for example, 31, 26, 32, 40, 50
  (regular, cheapest buyer, from Nuremberg) and 33, 33, 40, 29, 33 (half buyer). Every route had all five
  measured plates running by day 360, except casual cheapest buyers from Pottenstein (four).

### Chore minutes per visit

| player | typical visit | 9 visits in 10 at most | worst visit | visits over 10 minutes | stars of the player's own homes |
|---|---|---|---|---|---|
| regular | 4.0 | 7.5 | 10.0 | none | 2.85-2.89 |
| heavy | 4.5-5.0 | 7.5 | 10.0 | none | 2.91-2.94 |
| casual (5 minutes) | 2.5-3.0 | 7.5-8.5 | 10-12 | 0-1.7% | 2.43-2.60 |

Moving days before the letting agent add little: worst visit 10 minutes for regular and heavy players,
10-14 for casual ones. The plan's own work (ride-alongs, renovation and shop packages, shop orders) is play,
not chores, and the player chooses when to do it; on 9 visits in 10 it takes up to 10-12.5 minutes of a
regular visit. Casual players' chores still pass their 5 minutes on about 1 visit in 5, so the stars of their
own homes slip to about 2.5; the team's homes stay at 3.

### Money in and out per visit day over time (regular player, half buyer)

Means per visit day over each stretch, middle of 5 seeds. "Jobs" includes open jobs, the run, renovation,
shop and ride-along deliveries. "Other" is shops, upgrades and the pilot.

| first plate | visit days | in: jobs | in: tips and orders | in: rent collected by hand | in: rent banked by staff | out: homes | out: hires | out: wages | out: other | out: fines | cash + bank at the end | rent a day at the end | homes at the end |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nuremberg | 1-7 | $5.0k | $53 | $320 | $954 | $3.6k | $1.0k | $91 | $990 | $211 | $3.6k | $6.5k | 12 |
| Nuremberg | 8-28 | $11k | $1.9k | $0 | $30k | $7.2k | $13k | $3.2k | $7.0k | $1.0k | $236k | $50k | 28 |
| Nuremberg | 29-56 | $10k | $4.1k | $3.5k | $125k | $22k | $68k | $14k | $27k | $1.1k | $772 | $217k | 50 |
| Nuremberg | 57-90 | $10k | $16k | $27k | $490k | $115k | $197k | $64k | $115k | $1.2k | $99k | $1.35M | 77 |
| Nuremberg | 91-120 | $10k | $65k | $302 | $2.12M | $163k | $1.35M | $268k | $231k | $2.7k | $4.63M | $2.69M | 102 |
| Nuremberg | 121-180 | $11k | $1.1k | $129 | $2.73M | $4.2k | $2.15M | $409k | $5.0k | $1.2k | $14.5M | $2.76M | 154 |
| Pottenstein | 1-7 | $4.8k | $46 | $338 | $879 | $2.7k | $714 | $84 | $1.0k | $171 | $4.5k | $4.9k | 12 |
| Pottenstein | 8-28 | $11k | $631 | $0 | $13k | $3.3k | $3.8k | $1.7k | $4.2k | $939 | $93k | $24k | 28 |
| Pottenstein | 29-56 | $11k | $818 | $230 | $34k | $3.7k | $13k | $4.4k | $4.1k | $1.1k | $199k | $54k | 50 |
| Pottenstein | 57-90 | $10k | $3.6k | $4.6k | $121k | $22k | $42k | $15k | $29k | $1.0k | $595k | $282k | 78 |
| Pottenstein | 91-120 | $10k | $14k | $18k | $474k | $68k | $234k | $61k | $79k | $1.5k | $1.52M | $869k | 102 |
| Pottenstein | 121-180 | $10k | $61k | $72k | $2.28M | $245k | $1.19M | $283k | $324k | $2.4k | $11.1M | $5.41M | 138 |
| Manhattan | 1-7 | $5.0k | $84 | $324 | $959 | $3.9k | $1.0k | $87 | $987 | $201 | $1.7k | $7.0k | 11 |
| Manhattan | 8-28 | $11k | $864 | $0 | $19k | $3.8k | $3.8k | $2.3k | $4.1k | $960 | $165k | $30k | 28 |
| Manhattan | 29-56 | $11k | $4.9k | $21k | $179k | $48k | $65k | $24k | $38k | $1.1k | $312k | $427k | 41 |
| Manhattan | 57-90 | $10k | $33k | $18k | $1.06M | $156k | $632k | $138k | $188k | $2.1k | $1.32M | $1.94M | 71 |
| Manhattan | 91-120 | $10k | $39k | $302 | $2.25M | $48k | $1.64M | $321k | $92k | $2.0k | $5.99M | $2.44M | 102 |
| Manhattan | 121-180 | $11k | $1.1k | $32 | $2.48M | $4.2k | $1.91M | $372k | $5.9k | $1.2k | $16.3M | $2.51M | 154 |

What it shows: from the second week the teams bank almost all income; hires take the largest share of it; the
money held is typically 1.5-2 days of rent for a regular player (4 for a casual one in Manhattan). Casual and
heavy players are in `sim/final-money.md`.

### Against the pacing targets

| target | result |
|---|---|
| First flat right after the first run | Yes for 10-60-minute players (day 1). Casual: day 2, as today (a 5-minute visit cannot finish the run of 3). |
| About 6 homes in the first week (10-15 minutes a day) | 15 minutes: 6 homes on visit day 6, 8-12 on day 7. 10 minutes: day 7-9. Borderline for 10-minute players. |
| Chores never more than about 10 minutes | Yes for regular and heavy (worst visit 10.0). Casual: 10-12 at worst against a 5-minute visit. |
| First plate runs in 4-8 weeks (15 minutes daily) | Yes: visit day 30-50 (4.3-7.1 weeks). |
| Heavy not in under about 2 weeks | Yes: visit day 15-19. |
| Next plate needs real play there, roughly as long or faster, never in a day | Yes: plate 2 took 15-44 visit days for regular and heavy players (casual 33-66) against 15-50 for plate 1 (casual 51-98), with 1.5-2.5 hours of play in it. A $1B newcomer still needs 11-14 days. |
| Automation prices rise per level and per plate; money always has a next thing | Yes for regular and heavy players: 0 days holding 10+ days of rent with nothing to hire. No: casual cheapest buyers hold money with nothing to hire on 57-84 of 150 days, waiting for their own in-person work. |
| Staff never make the game play itself | Every hire, renovation and shop needs the player there. A plate that runs earns without play (by design). |
| An unpaid or missing team stalls, never loses what was bought | Yes: no team stopped for lack of wages in the simulation; the rule stops the team for the day and takes nothing. |
| Fun at 6 homes, no chore list at 60 | The player never runs more than 4 homes by hand; players own about 105-170 homes by day 180 (half buyer). |
| A reason to come back each day without timers | Payday, the next hire, orders, own homes; nothing decays while away. |

Where the pace comes from, honestly: a hire costs 1-4 days of all rent, so on most visit days (109-112 of
180 for a regular player) the next hire waits for money, not for play. From the third month, open jobs are
under 1% of a regular player's income. Playing more speeds up the in-person parts (renovations, shops,
moving days), which is why heavy players finish plates about twice as fast as regular ones, but money still
sets most of the rhythm.
Rent at 24% of the price per visit day is the reason; changing it would change everything above.

---

## 6. Where this plan comes from

Three designs were written and each was tested independently in the simulator. This plan takes the
strongest as its spine and grafts on the best of the others.

| | Economist: "plates and their teams" | Player loop: "a team for every square" | Builder: "a team per town, priced in days of rent" |
|---|---|---|---|
| plate | town (25 km) | the 1.5 km square | town (25 km) |
| plate 1, regular player | 25-52 visit days | 24-37 (29-45 after fixes) | 30-41 |
| plate 1, heavy player | 18-39 (Titisee 12) | 23-26 | 14-20 |
| chores: 9 visits in 10 / worst visit | 10 / 12.5-14.5 (casual 13-14.5 / 17.5) | worst 7.5 (casual 8.5-10.5) | 10-12.5 / 12.5-28.5 |
| money sitting with nothing to buy | 7-34 days of rent while later plates are built; a fixed $10M pilot stopped many players | 2-29 times what was left to buy, until a rent-based manager fee was added | 1-2 days for daily players |
| main flaw found in testing | prices set from the base square (a cheap square next to a city buys the city on a village price list) | squares overlap and change prices; income needs no play once a plate runs | chore spikes before the collector; villages lack the buildings for its renovations |
| build cost (its own estimate) | about 6-6.5 days | about 8 days plus prerequisites | about 9 days |

**Spine: the builder's design.** Its prices in days of the player's own rent work across the 170-fold
spread between a village and Manhattan, so money never piles up for daily players. Both other designs left
money sitting in their tests; the player-loop test fixed it with a manager fee of at least 15 days of all
rent, which is this same idea. Its plate is the town the code already knows. Every hire needs work in that
plate (renovations, shops, moving days), and its build steps name the files and the measured save size.

**Taken from the builder's own test:** the rent collector first (the worst chore visit dropped from 28.5
minutes to 12.5; 4 homes by hand then brought it to 10); hire floors x1.5 per plate instead of x2 (x2 stalled cheap buyers in plates 4-5); worn-down
buildings never larger than the largest building of flats in the square (Pottenstein has none above 5 flats).

**Taken from the player-loop design:** hiring in person with a ride-along delivery; its 7 "learning days",
cut to **two visit days between hires** (without it, a player with saved money took a new plate in 6 visit
days; with it, 11-14); the shop's order of the day; the world map with pins; the morning report.

**Taken from the economist's design:** the warning's detail (the amount at risk, the distance to the nearest
bank, "your money in the bank is safe" after a fine); the plate card on arrival and the badge; fewer homes
by hand for short visits (it proposed 3; this plan uses 4); and the lesson of its fixed $10M pilot, so the
pilot here is priced in days of rent.

**Changed by me after running the merged rules:** 4 homes by hand instead of 5 (worst chore visit 12.5 → 10.0
minutes, plate timing unchanged); cheaper first hires ($2k and $5k) but a dearer manager floor ($430k), so a
heavy player cannot finish plate 1 in under 15 visit days while beginners still hire early; the pilot at 5 days
of rent instead of 10 (the wait for it fell from 5-13 visit days to 0-8); a hire can be made at the end of a
visit, when its needs were met during it; shop orders never take the minutes a hands-on ask or the next
purchase needs (without that rule, 5-minute players never finished plate 1).

**Dropped, and why:**
- Plate = the 1.5 km square (player loop): squares overlap by half and prices change between them.
- Price lists set from the base's square, a goal of 21-80 homes from the square's size, managers needed before
  leaving a plate's team to work alone (economist): the cheap-square trick, and more rules to explain.
- A fixed $10M pilot (economist): a wall for anyone who buys cheap homes.
- 7 learning days per level and fees x2 per plate (player loop): every plate took the same 23-25 days, and the
  x2 made a wall around plate 11-12.
- The shop as a savings counter (player loop): banks in every plate are simpler.
- Staff tips going into the player's pocket (player loop): it filled pockets and fed fines.
- The earlier cities plan's housekeeper (10 homes from the 8th home) and its $100k pilot with a 2% fee per
  flight: replaced by this ladder and pilot.

---

## 7. Cities: individualise and optimise, ranked, and how each ties into plates

From the cities plan (measured in the built game), ranked by value for the player against cost:

1. **B1. A fuel, fire and police station and a bank in every square** (half a day). Needed before shops and
   hires: hires happen at a bank, shops need all three station kinds, moving day needs fuel. Fixes Titisee,
   central Lisbon and Sydney.
2. **B8. Load time on the owner's iPad** (1 hour). There is no real-device number yet; plates bring more homes
   and marks.
3. **B3. Key homes, worn-down picks, shops and staff on position, not the map number** (1 hour). One map number
   stands for up to 1,086 buildings.
4. **B4 + B5. Finding homes with a 50 m grid; roof marks as one instanced mesh per symbol** (1 day). Each plate
   adds about 30 homes; simulated players own about 100-200 by day 180. Today 2,400 marks cost about 50 ms a frame
   (headless) and finding homes 190 ms at 2,600 homes; the builder measured the grid at 1.5-5.6 ms in Node.
5. **A1 + B2. Price from where the building stands, plus worn-down flats** (1.5 days). Ends the 11-69% price
   jumps between squares and gives each city its own level (a whole square worth $118k in Titisee, $287M in
   Manhattan). Hire prices in days of rent follow on their own; with no ceilings the "$2M per building"
   question in the cities plan disappears. The simulation must be run again after it.
6. **A3. Best address, the 10 best addresses, the city card** (1 day). Becomes the plate card on arrival:
   the place's character, its best address, and the plate's team and checklist.
7. **A5. Open jobs pay by the square's price level** (under an hour; x0.75 in Titisee to x1.95 in Manhattan).
   Makes play in dear cities pay more. Runs of 3 stay unchanged.
8. **A4. Climb pay in hill towns** (2-3 hours; 9 of 20 squares have steep streets).
9. **A6. The last bit on foot in old towns** (1 day; drop-offs more than 50 m from the door for 34% of lots
   in Istanbul, 14% in Freiburg, 10% in Nuremberg).
10. **B6. A smaller save** (1 day): a team-run home saved as one row of about 20 characters (measured by the
    builder: 16-22 against 99-106 today), so about 6,000 homes fit instead of about 1,200. Needed before
    anyone nears 1,000 homes; simulated players reach about 100-200 by visit day 180 (10,000-20,000
    characters in today's format, against the 120,000 limit), so it can follow the first release.
11. **A10. Beat the tram** (1.5 days, 8 tram squares), **A8. Harbour runs** (half a day, 10 waterside
    squares), **A9. Local paint colours** (2 hours): each makes a plate's own place feel different and gives
    the plate's shops and orders local flavour.
12. **A11. Local price data** for 17 of 60 cities (4-5 days plus licence checks), later.
13. **B9. Places with no roads (Venice)**: a clear message now, play on foot later.

Dropped from the cities plan: A2 (housekeepers) and A7 (plates and pilots), replaced by this plan.

---

## 8. Build order

Each step can ship on its own. Estimates in working days. Ask the owner before each deploy.

1. **Money (half a day).** `src/game/game.ts`: delete `MAX_CASH`; the cash setter keeps cash between 0 and
   `Number.MAX_SAFE_INTEGER`; drop the $1M toast. `fine()` keeps its rule; its flash adds "($X in the bank is
   safe)". `src/homesUi.ts`: `collect()`, `payIn()`, the bank panel and the "Collect the rent" button lose
   their clamps. `src/main.ts`: the rich test build sets $1,000,000 directly. `src/game/bank.ts`: `WARN_CASH`
   10,000, `LOUD_CASH` 100,000 and `cashWarning(cash, bankHere, nearestBankM)`. `index.html` a line under
   `#cash`; `styles.css` amber and red. Tests in `tests/bank.test.ts`. If the owner agrees to question 5, the
   run score's deduction in `fine()` changes here too. Ships alone: the owner already decided it.
2. **Stations and a bank in every square, and timing on the iPad (half a day).** B1 in `src/game/world.ts` /
   `src/game/services.ts`; B8 as a `?try=timing` note.
3. **Fast with many homes (1 day).** B3, B4 (`src/game/homes.ts` `homesIn` with a 50 m grid, homes more than
   1.1 km away skipped), B5 (`src/game/world.ts` one instanced mesh per symbol; `src/homesUi.ts`
   `markHome()` updates one mark, `remark()` only on entering a square).
4. **Plates as data (1 day).** New `src/game/plates.ts`: the plate record (centre, place, continent, team
   level, last hire day, renovations, shops), `plateOf(lat, lon)`, continent boxes, reading and migrating old
   saves (the first home founds plate 1). `bank.ts` `homePlate()` / `inPlate()` read plates; banks show in
   every plate. Key `3da-plates`. Ships alone: banks in every town the player owns in.
5. **Rent collector and housekeepers (2 days).** New `src/game/staff.ts`: the ladder, `hirePrice`, `covers`,
   the cap of 4 + covers, `canHire` with what is missing, wages, the two-day gap. `src/game/tenants.ts`
   `newDay`: housekeepers answer asks (no tip), the collector banks rent. `src/homesUi.ts`: the team in the
   bank panel, the next hire, its price in days of rent, a Hire button that starts the ride-along as a
   special job (as `renovation.ts` does), `buy()` refusing homes past the cap with the reason.
6. **Shops, the order of the day, the letting agent, the second worn-down building (2 days).** New
   `src/game/shops.ts`; `src/game/renovation.ts` keeps a list of projects keyed by position instead of the
   single first home, capped at the square's largest building of flats; the agent answers moving days in
   `tenants.ts`.
7. **Manager, "runs on its own", the next town, the plate card and morning report (1.5 days).** `staff.ts`
   `runsOnItsOwn`; `homesUi.buy()` refuses a home more than 25 km from every plate unless every plate runs, and
   offers that town's worn-down building at half price as its first home.
8. **Pilots and the world map of plates (1 day).** `plates.ts` continents; `staff.ts` `pilotPrice`; the map
   with pins and the header.
9. **Smaller save (1 day).** B6: team-run homes as compact rows in the plate; old saves read as before.
10. **Cities:** A1 + B2, then A3, A5, A4, A6 and the rest of section 7, rerunning the simulator after A1.

Steps 1-9: about 10.5 days.

**Existing saves.** Homes owned when the update ships stay where they are and keep their tenants. The first
home founds plate 1. Homes beyond what a team could cover count as covered for the "runs on its own" check
(otherwise a save with 86 homes would need 7 extra housekeepers before it could found a second town). Live
players own 5 homes in all today, so this matters mostly for test saves.

## 9. What to tune after the owner plays

Add `play_counts` kinds for hires, shops, orders, plates founded, pilots, and fines with the cash carried,
and compare real days with the tables above. Then tune, in this order:
- the minutes everything takes (the simulator's are estimates; all pacing scales with them);
- homes by hand per plate (4; 5 gives more homes in week 1, 3 helps 5-minute players but needs the ladder's
  thresholds moved);
- the days of rent per hire (1 / 1.5 / 2 / 2.5 / 3 / 4) and the floors ($2k ... $430k);
- the two visit days between hires (3 makes a rich newcomer take 16-18 days for plate 2, and 6 homes come a
  day later);
- the warning lines ($10,000 and $100,000);
- the shop order (a quarter of a day's rent; a whole day's rent made plates only 1-3 days faster);
- the pilot (5 days of rent);
- wages (8% / 4% / 3%).

---

## 10. Open questions for the owner

1. **Banks in every plate you own** (today: only the home plate). Each team is hired at its plate's bank and
   pays rent into it. *Recommendation: yes, one savings account usable at the banks of every plate.*
2. **The bank's $1M ceiling** uses the same constant as the cash ceiling you removed. *Recommendation: remove
   it too, with no other limit; prices in days of rent keep money moving.*
3. **Buying only inside your plates**, and a new town only when every plate runs (today: anywhere with cash).
   The first flat stays anywhere: it founds plate 1. *Recommendation: yes; it is what makes play plate by
   plate.*
4. **A limit of 4 homes run by hand per plate**, beyond what the team covers. Nothing owned is taken away;
   new purchases past the limit are refused with the reason and the next hire. *Recommendation: 4. Choose 5
   if 6 homes in the first week for 10-minute players matters more than a hard 10-minute chore limit.*
5. **The run score after a fine during a run of 3.** Today the score loses the cash the fine takes, so with
   no ceiling a rich player's score drops to 0 and challenge links stop being comparable. *Recommendation:
   the score loses a quarter of itself (15% when wrecked or knocked out); the cash fine stays exactly as it
   is.*
6. **Plate = town (25 km), not the 1.5 km square.** *Recommendation: town, as `bank.ts` already has it; the
   square overlaps its neighbours and its prices move.*

---

Files (all under /tmp/claude-0/-home-user/19d968bc-3916-40c7-b8c9-654318434293/scratchpad/sim):
- `variant-final.mjs` (the merged rules; every number is a default of `make()`), on `econ-final.mjs` (a copy of
  the builder test's simulator that also counts open jobs apart).
- `final-run.mjs grid | money | fines | edge | hires`, `final-year.mjs 360`, `final-pilot.mjs`.
- Outputs: `final-grid.md`, `final-money.md`, `final-fines.md`, `final-edge.md`, `final-hires.txt`,
  `final-year.md`.

---

## 11. Changes after review (18 November 2026, late)

Re-running the merged rules showed two problems, and both fixes below were then tested in the simulator
(Nuremberg, Pottenstein, Manhattan; half and cheapest buyers; casual, regular and heavy players; 180 visit
days; 3 seeds; the headline case re-run separately and matching).

### Problem 1: playing more made players poorer

Each plate holds only as many homes as its team covers, and homes could never be sold. Heavy players found
each plate 17-57 visit days earlier than regular ones, while still poor, filled its places with homes 3 to 13
times cheaper, and were stuck with them. Started in Nuremberg, half buyer, the regular player paid $269k on
average for a Manhattan home, the heavy player $20k. On visit day 180 the heavy player earned $388k rent a day,
the regular one $2.71M. Once all plates ran, heavy players had nothing left to buy but more housekeepers in
their last, cheapest plate ($19-23M spent in Titisee for $11k a day of rent).

**Fix: trade up.** In a plate that already runs, a home can be sold back for **80% of what was paid** and a
**dearer** lot in the same plate bought in the same action. Rules that keep it from becoming a money pump:
- a sale pays a share of the price paid, never today's price;
- selling and buying are one action, and only to a dearer lot (no selling before a hire, which is priced in
  days of rent, and buying back after);
- no sale of shop buildings, the first home or single flats;
- the trade-up button works only with money above the price of the next hire (or the pilot), so trading does
  not push the ladder back. Without this, plate 1 ran about twice as late (regular visit day 63-75 instead of
  33-35) and plate 2 slipped by 17-22 days;
- the new lot should cost at least twice the old one, which halves the number of trades for similar rent.

80% rather than 100% or 50%: all three give the same rent within about 3%. At 100%, heavy players trade
1,300-2,000 times in 180 days, because picking again costs nothing. At 50%, they lose $10-24M to sales.

### Problem 2: driving stopped paying

From the third month, open jobs brought under 1% of a regular player's income.

**Fix: a pay floor.** Every delivery (open jobs, renovation and shop packages, ride-alongs, shop orders)
pays at least **2% of what all the player's homes earn in a visit day**, or today's formula if that pays more.
Runs of 3 stay as they are, so challenge links still compare.

Jobs then bring 5-6% of a regular player's income from visit day 90 (0.4-0.6% before) and 26% of a heavy
player's. Casual players get only 1.7-1.8%, because they play few jobs. A 1% floor gives regular players
about 3%. A 5% floor let heavy plates run in 14 days (12 for a cheapest buyer in Manhattan), which is too fast.
Jobs get large in dollars: from visit day 120 a regular player's delivery pays $21-68k (about $1.5-2.8k before).
So the cash warning matters more, and fines rise to 0.2-0.9% of income for regular players and about 1% for
heavy ones (0.1-0.5% before).

### Both together (half buyer; Nuremberg / Pottenstein / Manhattan)

| | player | plate 1 runs | plate 2 runs | fastest plate | rent a day, visit day 120 | rent a day, visit day 180 | jobs, share of income, days 90-180 |
|---|---|---|---|---|---|---|---|
| before | regular | 33 / 38 / 35 | 65 / 66 / 77 | 29 / 28 / 29 | $2.69M / $0.93M / $2.25M | $2.76M / $5.41M / $2.31M | 0.4-0.6% |
| before | heavy | 16 / 15 / 17 | 35 / 32 / 45 | 16 / 15 / 17 | $0.38M / $0.94M / $0.73M | $0.39M / $1.42M / $0.75M | 3.5-9.9% |
| after | regular | 33 / 38 / 35 | 65 / 66 / 76 | 28 | $3.41M / $1.06M / $2.07M | $7.49M / $6.68M / $7.79M | 5.1-6.2% |
| after | heavy | 16 / 15 / 17 | 35 / 32 / 41 | 16 / 15 / 17 | $3.86M / $4.96M / $5.54M | $7.38M / $12.4M / $7.65M | 26% |

Pacing is unchanged. Tenant chores stay at 7.5 minutes on 9 visits in 10 and 10 at worst. Trading adds up to
24 minutes on a heavy player's busiest visit, but it is a choice, not a chore. Casual players hardly trade
(0-1 trades in 180 days). Cheapest-buying regular players gain little.

### Added to the build order

- After step 7 (when plates can run on their own): **trade up**, in `src/game/homes.ts` (sale price, rules) and
  `src/homesUi.ts` (the panel of an owned home in a plate that runs). About 1 day.
- In step 1 or with step 5: **the pay floor**, in `src/game/game.ts` where open-job pay is set (`const base =`),
  given the day's rent from `homesUi`. About 2 hours.

### Two more open questions for the owner

7. **Trade up at 80%, only in plates that run, only to a lot at least twice as dear, and only with money above
   the next hire?** *Recommendation: yes. Without it, the players who play most end up with the poorest plates.*
8. **Plate size in big cities.** With 25 km, all of Berlin, or Manhattan with Brooklyn and Queens, is one plate
   of about 30 homes. A big city could instead be split into district plates, so "conquering Berlin" means
   running several. Not simulated. *Recommendation: keep 25 km for the first release, as `bank.ts` already has
   it, and decide after the owner has played a plate.*
