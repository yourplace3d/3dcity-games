# A second currency, and why a player needs both countryside and city

Brainstorm for the owner of 3DA, 19 November 2026.

- A **plate** is a town or city, as in the plan: everything within 25 km of its first home.
- A **visit day** is a calendar day on which the player opens the game.
- Every crate amount, venue price and percentage below is an **estimate** to tune.
- **Modelled** means the number comes from the plan's economy simulator (5 homes by hand, half buyer, 3 seeds, medians) with the crate rules added. The files are listed at the end.

---

## The question

The caretaker comes after the first 5 homes run by hand, and what the caretaker is owed must not grow with the rent the caretaker brings in. What could the second currency be (something farmed, or a supply the runs build up; not drugs; diamonds?; best of all something regional), and does it need an economy simulation?

And how do countryside and city both become necessary later, while a start in a village and a start in a big city stay exactly the same?

Your newest message gives the shape. You start by opening the local pub, then a bar and club in a barn in the countryside. Later come five-star restaurants and hotels in the cities, then gala nights, and finally hosting a big touring award night that can come to any town, not to one real city.

---

## What the map can carry

What the game can read cheaply, the same for every player:

- **The land around a plate** (within 25 km, measured for 14 places).
  - Country land is forest, fields and meadow. Pottenstein is 46% forest and 7% fields. Titisee is 64% forest and 23% meadow. Bordeaux is 12% vineyards.
  - City land is housing, industry and water. Manhattan is 0% fields, 8% industry and 19% water. Hong Kong is 76% water. Paris is 51% housing.
- **Big low halls in the square being played** (barns, warehouses, sheds over 300 m²). They are everywhere. After leaving out halls on school, hospital, church, cemetery and military ground, the counts are: Tongue (a Scottish village) 4, Hampi 8, Titisee 11, Pottenstein 22, Manhattan 116, Tokyo 324.
- **Buildings of 6 or more floors**: none in Pottenstein or Titisee, 80 in Nuremberg, 1,192 in Manhattan.
- **Cafés, pubs and restaurants**: Lagos Island 0, Titisee 1, Pottenstein 14, Manhattan 825.
- **Farms, wineries, breweries and markets**: 0 in Pottenstein and Titisee, 9 in Manhattan. Most yards in villages would therefore be made up, the way stations already are.
- **Place names**: the map labels each settlement as a city, town or village. One look at 9 low-detail tiles tells whether a city lies within 10 km. Measured today, that look costs 0.3-1.1 seconds and 27 KB to 1.7 MB, once per plate. The game already has the lookup: `settlementsFromTiles` in src/geo/tiles.ts.

Two catches shape the whole design:

1. **Much land is not mapped at all.** Nothing (no forest, field, housing or water) is drawn on 30% of the land around Pottenstein, 39% around Manhattan, 55% around Des Moines (US farmland is mostly not drawn) and 68% around Tokyo.
   - A rule that counts amounts of land counts what volunteers drew, not what is there.
   - So the land must never set **how much** a player gets. It can only set what something is called and which kind of plate it is.
2. **Many city centres have no building heights on the map.**
   - In Kano none of 1,065 buildings has a height. In Kinshasa 97% have none. Kolkata's mapped buildings cover only 33% of its square.
   - A rule "a city has tall buildings" therefore calls 13 of 35 measured city centres countryside, among them Kolkata, Old Delhi, Kano, Marrakesh, Fez and Valletta.
   - **Place names get them right.** 25 places were measured, and 15 were re-checked today; every one came out as expected:
     - Cities: Kolkata, Kano, Manhattan, Tokyo, Hong Kong, Nuremberg, Des Moines.
     - Country: Pottenstein, Titisee, Tongue, Funafuti.

---

## The recommendation: crates

### What it is

**Crates**, kept in each plate's **cellar**. The plate card shows a line such as "Cellar: 46 crates of timber".

Every plate is either a **country plate** or a **city plate**. This is decided once, when the plate is founded, and saved: it is a city plate when the map has a place labelled "city" within 10 km of its first home.
- Country plates: Pottenstein, Titisee, Tongue.
- City plates: Nuremberg, Manhattan, Tokyo, Hong Kong, Kolkata, Kano.

**Country crates** hold what the land around the plate gives most, printed on the crate:
- timber (forest leads),
- grain (fields),
- milk (meadow; parks, gardens and golf courses do not count),
- grapes and fruit (vineyards, orchards),
- fish (lake, river or coast),
- "farm produce" where nothing is mapped.

Pottenstein and Titisee get timber; a village near Bordeaux gets grapes.

**City crates** hold fittings: glass, linen, lamps, sound and kitchen kit.

The label is the regional part. The game counts only two kinds: country crates and city crates.

Crates can never be bought or sold for money, and crates in the car are never fined. They look like a stack of wooden crates, not a coin or a gem. A crate is cargo you load, drive and stack, which suits a delivery game, and it says "goods from here".

### Where crates come from

The same amounts in every plate (estimates):

- **Your venues' suppliers** fill the cellar every visit day: the pub 6, the bar and club 10, the inn or restaurant 12, the top venue 16. In a country plate the farms around drop crates off; in a city plate the wholesalers do.
- **Each venue's order of the day**: one station package delivered to the venue. It pays like the plan's shop orders and adds +2 crates. Once the venue has a manager, the manager does it.
- **Yard runs**, the supply your runs build up: one delivery from a yard to your cellar, paid like a job, adds +3 crates.
  - In a country plate, yards are the map's farms, wineries, breweries and markets.
  - In a city plate, they are markets, workshop yards and warehouse halls.
  - Where the map has none nearby, a yard is made up at a fixed spot beside a road and drawn with a dashed ring, exactly as made-up stations are today.
  - A yard always gives the plate's own kind.
  - The cargo sets the kind of job: timber and fittings are heavy (a supply run), milk and fish spoil (a rush job), grapes and glass break (a clean run).
- **The cellar holds 300** (estimate). When it is full, suppliers wait and yard runs are not offered, so no drive is wasted.

### What crates pay for: the staff, starting with the caretaker

Wages per visit day, the same in every plate (estimates):

| who | crates a visit day |
|---|---|
| caretaker | 2 |
| each housekeeper | 2 |
| letting agent | 3 |
| plate manager | 4 |
| each venue manager | 2 |
| carrier (later) | 2 |

A full team of six costs 15 a day. With the club's manager it costs 17.

**The caretaker.** The caretaker comes once your 5 homes run by hand and the plate's first building is repaired and painted. The paint also opens the pub downstairs, so the cellar starts filling with 6 crates a visit day.
- To sign the caretaker on, you need the plan's money price (the larger of $2,000 and 1 day of all your rent) and 6 crates in the cellar (3 days' pay).
- The caretaker then takes 2 crates every visit day, paid in kind (food, fuel, tools). That is the same whether the homes in their care earn $50 or $50,000 a day.
- The pub makes 6, so the caretaker is paid even on a day you drive nothing.

Two rules keep pay safe:
- **A hire needs the venues to make the whole team's pay each day.**
  - The pub alone (6) covers the caretaker and two housekeepers.
  - The letting agent and the manager need the bar and club too. The full team plus the club's manager costs 17 a day; the pub (6), the club (10) and the club manager's order (+2) make 18.
  - Without this rule, the model hired faster than the cellar could pay, and teams stalled for about 100 visit days.
- **Each day, the cellar is filled before wages are taken.** If it is ever empty, the staff do nothing that day. Rent waits at the buildings for up to 3 days (the plan's rule), and nothing owned is lost.

Modelled:
- 0 unpaid days in 72 runs (4 starting places, 3 kinds of player, 3 seeds, with and without yard runs).
- For players who do yard runs, the cellar never fell below 17-51 crates after the first hire.

Money still buys every hire, at prices that rise per level and per plate as in the plan. Crates pay the wages. This replaces the plan's wages (a housekeeper 8% of the rent of the homes in their care, the collector 4%, and so on), which were exactly what grew with the money the staff make.

### The trip between countryside and city

The first two venues and a whole team run on a plate's own crates, so the first plate always finishes on its own, anywhere. From the third venue on, a plate needs the other kind:
- A city restaurant serves country food from a country plate: grain, milk, fish, grapes, or the game and honey that come with timber.
- A country inn needs the city's linen, glass and sound kit.
- The top venues, gala nights and the touring award night need both kinds.

Three ways to move crates (estimates):

1. **A haul.** When you use "Go there" on the plate map, the car can take up to 20 crates from the cellar of the plate you are leaving. You arrive at the edge of the other plate, and one delivery takes them to your cellar there.
2. **The carrier.** A hire costing 2 crates a day, available from your first plate that runs. The carrier moves 10 crates every visit day between two of your plates, so after you have driven the trip once, the carrier keeps it up.
3. **The market at the road out of town**, in every plate. It swaps 3 of your crates for 1 of the other kind, and you can receive at most 6 a visit day. This is the safety valve: a player whose plates are all country, or all city, is never stuck. They pay three times as much.

Real pairs lie within about 40 km of each other:
- Pottenstein (timber) and Nuremberg (fittings).
- Titisee and Freiburg (28 km).
- Manhattan and a village in the New Jersey hills (estimate).
- Hong Kong and Tai O on Lantau (estimate).

### What runs do

- Yard runs fill the cellar (+3 each).
- Each venue's order of the day adds +2 and a job's pay.
- Fit-out packages open each venue, 3 per venue as for the plan's shops: the bar counter from a fuel station, the cold room from a fire station, the till and locks from a police station.
- Hosting a night is three deliveries to the venue: the band's gear, the ice and the flowers.
  - The packages count as you bring them, over as many visits as you like.
  - The night happens on the visit when you bring the last one.
- A haul is one delivery at the end of "Go there".
- The run of 3 for challenge links stays exactly as it is.

In a 5-minute visit nothing is required: the cellar fills, wages are paid and managers do the orders. Reading the cellar line in the morning report takes about 10 seconds (estimate). Yard runs replace open jobs at the same pay, so they add no minutes.

### Why the start is the same everywhere

No amount depends on the land: every pub makes 6, every order adds 2, every yard run 3, and the caretaker costs 2. The land decides only the printed label and, from the third venue on, which kind of crate a plate lacks.

Modelled, regular player; casual and heavy players in brackets:

| | Pottenstein (country) | Manhattan (city) |
|---|---|---|
| kind and label | country, timber | city, fittings |
| fields within 25 km / land not mapped | 6.9% / 30% | 0.0% / 39% |
| pub opens (visit day) | 3 (9, 1) | 3 (12, 1) |
| pub makes | 6 a day, +2 per order | 6 a day, +2 per order |
| caretaker hired | 5 (13, 2) | 5 (14, 2) |
| the plan's money day for the first hire | 5 (13, 2) | 5 (14, 2) |
| caretaker's wage | 2 crates | 2 crates |
| bar and club open | 7 (21, 3) | 7 (23, 3) |
| full team of six | 23 (46, 12) | 22 (48, 12) |
| crates in the cellar on visit day 40 | 203 (193, 249) | 205 (164, 300, full) |

Visit by visit, for one regular player (seed 1), the two places run side by side:

| visit day | both places |
|---|---|
| 1 | the run of 3, then the worn-down flat |
| 2 | 5 homes |
| 3 | the building is painted and the pub opens |
| 4 | 14 crates in the cellar |
| 5 | 20 crates; the caretaker signs on for 6 crates and $2,000 |
| 7 | the bar and club is fitted out (30 crates) and the first housekeeper is hired |

The rent differs: on day 5 Pottenstein earns $1,348 a day and Manhattan $1,534.
- By visit day 56 the gap is $54,000 against $427,000 a day (the plan's table).
- The caretaker still costs 2 crates in both places.
- Under the plan's old wage (4% of the rent for this job), the caretaker would then have cost about $2,200 a day in Pottenstein and $17,000 in Manhattan.

The other places measured:
- Titisee and Nuremberg give the same days: the caretaker on day 5 (11, 2) and 5 (14, 2).
- Tokyo and Hong Kong have no lots file in the simulator. Nothing about crates reads the land, so they should match Manhattan (estimate).
- The casual spread (day 11 in Titisee, 14 in Manhattan) comes from when the first renovation ends, not from crates. In every run the caretaker came on the plan's own money day.

Where crates do bind:
- A player who never does yard runs opens the club on visit day 15-16 instead of 3-7.
- A heavy player who never does yard runs gets the full team on day 21 instead of 12.

That is intended: the runs build up the supply.

---

## The venue ladder

| step | country plate | city plate | what it needs | what it brings |
|---|---|---|---|---|
| 1 | **the pub**, ground floor of the plate's first building | **the pub**, the same | nothing extra: it opens with the paint | 6 crates a day; an order of the day; +2% on the rent of every home in the plate (estimate) |
| 2 | **bar and club in a barn** | **bar and club in a warehouse hall** | 30 crates; 3 packages; 1 day of the plate's rent; a venue manager (2 crates a day) | 10 crates a day; an order; nights and stars; +2% rent |
| 3 | **country inn**, in a whole building of flats you own (rooms upstairs) | **restaurant**, downstairs in another whole building you own | 40 crates of its own kind + 20 of the other; 3 packages; 2 days of the plate's rent; a venue manager; then 2 crates of the other kind each visit day to serve | 12 crates a day; +4% rent; from the second plate on, the plate manager needs one (proposal) |
| 4 | **festival barn**, a second hall with a marquee | **five-star restaurant or grand hotel**, in the biggest whole building you own (by floor space) | 80 own + 40 other; 3 packages; 3 days of the plate's rent; a venue manager; then 4 of the other kind each visit day | 16 crates a day; +6% rent; gala nights once it has 5 stars |
| gala night | at the festival barn | at the restaurant or hotel | 5 stars; 20 crates of each kind; three deliveries | 1 day of the plate's rent (estimate); guests' cars arriving, lights on |
| **the Touring Gala** | any of your plates with a 5-star step-4 venue, country or city | | 100 crates of each kind, gathered from at least 3 of your plates, including at least one country and one city plate; five deliveries (the award statues as a clean run from a police station, the guests' cars from the edge of town) | 3 days of all your rent; the trophy in the venue window and on the plate's pin; once per plate |

All money prices and percentages are estimates and were not modelled; the model counted only the club's crates.

Notes on the ladder:
- **The pub and the bar and club are the plan's two shops** that the manager needs. The pub costs nothing beyond the paint, so it never delays the caretaker.
- **Where the club goes.** Halls that hold or stand on reserved ground are left out: churches, schools, hospitals, cemeteries and military land. Pottenstein has 3 churches among its 30 halls, and Kano has 22 of 67 halls on school, hospital, cemetery or military ground. Where a square has no clear hall, the club goes in the ground floor of a whole building you own.
- **The grand hotel** goes in your biggest building, not "a building of 6+ floors". Kano, Fez and Marrakesh have no such building on the map, and the hotel must exist wherever buildings can be bought. Where your biggest building does have 6+ floors, it shows as a tower with lit windows.
- **Stars.**
  - Every venue starts at 1 star and gains 1 for every 5 nights hosted, up to 5. A night uses 3 crates.
  - You host by driving the three deliveries. A venue manager hosts one night every second visit day, paid from what is spare after wages.
  - Modelled with managers alone, the club reaches 5 stars on visit day 42-46 (casual 60-62) and the pub on day 51-63 (casual 85-93). Your own nights bring it sooner.
  - The stars are the game's own, never a guide's or a rating body's.
- **A step-3 or step-4 venue that has none of the other kind on a day** is closed that night: it makes nothing and its manager is not paid. Nothing else stops.
- **The touring award night** is called **the Touring Gala**: a made-up award night for the year's best hosts that tours from town to town. You invite it to whichever of your plates is ready; nothing runs on a clock. Check the name against real events and brands before release.
- **Drinks** are never named or shown by brand; the venues serve "the menu".

### Management ideas borrowed from business and crime-family management games

Borrowed, without crime:
- Venues as the backbone of the business, opened one by one up a ladder.
- A manager for each venue, who runs it while you are away (orders and nights).
- Wages owed every day, paid from what the venues bring in.
- Reputation as stars, earned by hosting nights; galas only at 5 stars.
- Events that draw guests: nights, gala nights and the Touring Gala, with an invitation to host.
- Supply between your towns: hauls and the carrier.
- The plate map as the map of your business: each pin shows country or city, its crate label, its venues' stars and a Touring Gala trophy.

Left out on purpose: protection money, extortion, bribes, smuggling, money laundering, rival families, turf and police payoffs. Police behave exactly as today.

---

## Does it need an economy simulation?

No. Crates are counters, like rent.

**Computed once, when a plate is founded, and saved:**
- Its kind: whether a "city" label lies within 10 km, from 9 low-detail tiles (0.3-1.1 s, up to 1.7 MB, measured today), using `settlementsFromTiles`, which the game already has.
- Its label: from the land cover of the square that is already loaded. Later it can come from the 25 km land.
- Both are frozen, so a map edit never flips a plate.

**Placed from the map, like stations:**
- Yards: the real farms, wineries, breweries and markets, plus made-up ones at spots worked out from the earth cell, the same for every player.
- Venue spots: the halls that homes.ts already finds and leaves out of the homes for sale.

**Each visit day, per plate:**
1. Add what the venues make.
2. Take the wages.
3. Serve the other kind at steps 3 and 4.
4. Add the managers' orders and nights.
5. Move the carrier's 10 crates.

That is a handful of additions per plate.

**Not simulated:** prices, supply and demand, a market shared between players, other businesses, and exchange rates that move.

**Why that is enough:**
- The regional part is what the crates are and which plate lacks what. That is what the player sees and drives for.
- A real economy simulation would make amounts depend on mapped land. That land is missing in large parts of the world, so it would break the equal start.
- It would need a state shared between players, but each player has their own copy of the city.
- It would ask for price-watching that a 5-minute visit cannot do.

The save needs about 60-100 characters per plate.

---

## The alternatives

How the five concepts ranked, after each critique's fix and by fit with your words:

| | concept | critique score | after its fix | fit with your words |
|---|---|---|---|---|
| 1 | Crates (recommended) | 7 | Sound once the plate kind comes from place names and the hotel goes in your biggest building | Farmed and built by runs, regional label, both kinds needed, carries the ladder |
| 2 | Supply lines | 6.5 | Needs a small cellar for events, which brings it close to crates | The most literal "runs build up a supply industry"; regional only in the label |
| 3 | Guests and the tip jar | 6.5 | Works once hires are checked against the plate's new size | The most like a management game; the least regional |
| 4 | Town money | 6.5 | Simple with a fixed 2-for-1 rate | Regional only in the rate; one balance per plate to read |
| 5 | A speciality from every town | 6 | Its fix ("a jar is used where it stands") turns it into crates | The most regional by name, but labels from the land are unreliable: Titisee comes out honey, not cheese; coastal villages count as cities; Alice Springs gets nothing |

### Alternative 1: Supply lines (a daily rate, not a pile)

- Each delivery from a yard to your venue opens a supply line that sends 2 loads every visit day for good.
- Staff and venues use loads each day, and nothing is stored, like a power grid.

For the player, a plate's supply is built once (12 deliveries) and then runs, with no pile to watch. It is the most literal reading of "the runs build up a supply industry" and the least to compute.

The trade-off: after the lines are built, nothing changes for months. The first plate sits at "19 of 24 loads used", and the 5 spare loads do nothing. The bar can look like a mobile game's stamina bar. And a gala night can never be paid from a daily rate, so events need a small capped cellar, which brings it close to crates.

### Alternative 2: Guests and the tip jar

- Your homes send guests to your pub and club.
- Your plates of the other kind send visitors, who fill inns, hotels and galas.
- Guests leave tips in the staff's jar, and the jar pays the staff.

For the player, it is the most like a management game: guests you can see, a guest book of their home towns, nights that fill empty seats.

The trade-offs:
- It is the least regional: the land only picks themes such as a harvest supper or a boat party.
- Tips look like money, so players will ask why they cannot buy a flat with them.
- Passenger runs are new code, about 2.5 days (estimate).
- Its hire rule must count the plate at the size the new hire makes room for. As written, all 36 modelled runs stuck after the caretaker.

### Taken from the others into the recommendation

- From guests: guests' cars arriving on nights, venue stars, the invitation to host.
- From specialities: the origin on the crate ("timber from around Pottenstein"). Later, a shelf with one crate label from every plate you have run.
- From town money: each plate's cellar pays only its own staff (the plan's "hired and paid there"), and a fixed swap rate instead of one worked out from the land.
- From supply lines: yard runs as the supply your runs build, and a full cellar that stops deliveries.

### Why not diamonds

- A gem counter is the premium-currency look of farm-builder mobile games. Players read it as "this will be sold for real money".
- The diamond trade carries a smuggling and conflict image, close to the crime economy you ruled out.
- It is not regional: quarry land is 0.0-0.7% of the land around all 14 places measured.

A gem-like thing works as a trophy, not as a currency. The Touring Gala's award, a cut-glass star, stands in the venue window and on the plate's pin. There is one per plate that hosted the gala, and it is never counted, sold or bought.

---

## What it changes in the plan (docs/plan-plates-and-staff.md)

- **Section 2, the team.**
  - 5 homes by hand (your decision).
  - Hire 1 is the caretaker, who takes the rent collector's job: banking every home's rent each visit day.
  - The caretaker comes at 5 homes, once the plate's first building is painted (which opens the pub), with 6 crates in the cellar.
  - The homes allowed after each hire move up by one: 5, 13, 21, 21 (the letting agent adds none), 29, then 30 when the plate runs.
- **Section 2, wages.**
  - The shares of rent go: housekeeper 8%, collector 4%, manager 3%, and the agent's day of rent per tenant.
  - Wages are paid in crates (the table above). Hire prices stay in money.
  - New rule: a hire needs the venues to make the whole team's pay each day.
- **Pacing.** Without wages in money, players keep the 11.5-14.4% of income that wages took. On the plan's simulator:
  - Plate 1 runs 0-5 visit days sooner (regular player: Pottenstein 39 to 37, Manhattan 43 to 39).
  - Plate 2 runs 1-10 visit days sooner.
  - Either accept this, or raise hire prices by about 10% (estimate, not modelled).
- **Section 3, shops.**
  - The pub and the bar and club become the two shops the manager needs.
  - The plan's "+15% on the shop building's rent" becomes "+2% on every home in the plate" per venue (estimate).
  - Orders of the day stay, and each also adds +2 crates. For a venue in a hall, the order's share of a day's rent is taken from the plate's first building (estimate).
- **Section 3, a new plate.** From the second plate on, the manager also needs a step-3 venue (proposal). That needs crates of the other kind.
- **Section 3, a plate that runs on its own.** "Its team was paid that visit day" now means paid in crates.
- **Section 3, the world map.** Each pin shows country or city, its crate label, its venues' stars and a Touring Gala trophy.
- **Section 4, what brings players back.** It adds the venues' orders, nights, and a cellar line in the morning report ("Pottenstein cellar: +20, wages −17, 203 crates").
- **Section 5, the money table.** The wages and shops rows are replaced, and new rows are added for crates and venues.
- **Section 8, build order.** Venues and crates come after the staff steps.

---

## A first version that could ship in a few days

About 3-4 working days (estimate):

1. **The plate's kind and label.** Decided at founding and shown on the plate card ("Pottenstein: country, timber"), using `settlementsFromTiles` in src/geo/tiles.ts and the land cover already loaded. Half a day.
2. **The pub.** It opens when src/game/renovation.ts reaches `done`. The cellar fills by 6 a visit day, and the pub has an order of the day. New src/game/venues.ts and src/game/crates.ts. One day.
3. **Staff paid in crates,** with the rule that venues must cover the team, in src/game/bank.ts and src/homesUi.ts. Half a day.
4. **The bar and club in a hall.** `findLots` in src/game/homes.ts already finds the big low halls and leaves them out of the homes for sale; offer them as club spots, without halls on reserved ground. One day.
5. **Yard runs.** Real yards come from the map's points, and made-up ones from `inventServices` in src/game/services.ts with a new kind. The run is a new job in src/game/game.ts, next to `JOB_OF`. One day.

Shipped this way, every plate plays the same up to a full team, and the crate label shows where the goods come from.

**Later**, about 3-5 more days (estimate):
- steps 3 and 4, and the need for the other kind;
- hauls on "Go there", the market and the carrier;
- nights and stars;
- gala nights and the Touring Gala;
- the label taken from the 25 km land;
- the shelf of labels;
- guests arriving on nights.

---

## Questions to settle in the brainstorm

1. **Is crates the second currency, called crates and kept in a cellar?** Suggested: yes.
2. **Are staff paid only in crates, with hire prices in money?** Suggested: yes. The plan's wages as shares of rent go.
3. **Should a plate's kind come from the map's place names (a "city" within 10 km)?** Suggested: yes. Big towns without a city label (Bamberg, about 77,000 people) and the leafy edges of big cities (Berlin-Zehlendorf) then count as country, which is fine for a first version. Later, a plate whose buildings cover 30% of its square could also count as a city (Bamberg 33%, Rothenburg 18%).
4. **How strict is "you need both"?** Suggested: the market (3 for 1) works for everything below the Touring Gala, and the Touring Gala needs at least one country plate and one city plate. Nobody is ever stuck, and the top needs both.
5. **Does the plate manager need a step-3 venue from the second plate on?** Suggested: yes. It is what sends players to the other kind of plate in the middle of the game.
6. **Real map data now decides a plate's kind and its crate label, not only prices. Is that within your rule?** Suggested: yes, because no amount ever depends on it.
7. **The pub, bar and club bring drinks into the game. Keep them?** Suggested: yes, with no drink ever named or shown by brand. Check what they do to the age rating in the app stores.
8. **What is the award night called, and how often can a plate host it?** Suggested: "the Touring Gala", once per plate, with the trophy on its pin. Check the name against real events first.
9. **Should a cellar hold 300 crates, with yard runs hidden when it is full?** Suggested: yes.
10. **With wages gone from money, plates run 0-5 visit days sooner. Is that acceptable?** Suggested: accept it now, and tune hire prices after you have played a plate.
11. **What should venues pay in money?** Suggested as a starting point: +2%, +2%, +4% and +6% on the plate's rent for the four steps; a gala night 1 day of the plate's rent; the Touring Gala 3 days of all your rent. Model this before building steps 3 and 4.

12. **Should managers stop hosting nights while you save for the next venue?** Suggested: yes. Re-run on the model: a player who does no yard runs ends with 1-28 crates in the cellar on visit day 40 and 120, because the managers' nights use everything spare after wages. The third venue needs 60 crates, so that player would never climb past the club. With nights paused once the cellar is below the next venue's price, the spare builds up; stars then come later.

---

## Where the numbers come from

- The land mix around 14 places: the brief's table.
- Halls, heights, yards and food places: the critiques' measurements in the scratchpad folders crates-critique, critique-tips, critique-town and supplycrit.
- Place labels within 10 km: crates-critique/place.mjs, re-run today on 15 places.
- Crate pacing, stars and the cellar cap: /tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/brainstorm-model/rec.mjs, built on the plan's simulator. Run it with `SHARE=0` for players who do no yard runs, and `TRACE=Pottenstein` for the visit-by-visit lines.
- The pacing without wages in money: /tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/brainstorm-model/nowage.mjs.
- The merged concepts' first models: /tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/merge/pace5.mjs and pace5-tips1.mjs.

## Checked after the brainstorm (coordinator, 19 November)

- `rec.mjs` and `nowage.mjs` were run again: every day in the tables above (pub, caretaker, club, full team, stars, cellar on day 40, plate 1 and plate 2 pacing) came out the same, and there were 0 unpaid days.
- The code names cited exist: `settlementsFromTiles` (src/geo/tiles.ts), `inventServices` (src/game/services.ts), `JOB_OF` (used in src/game/game.ts), and `findLots` leaves out big low halls (src/game/homes.ts).
- Distances between the named pairs, measured: Titisee to Freiburg 28.3 km, Pottenstein to Nuremberg 42.7 km, Tai O to Central 30.6 km. All are more than 25 km, so each can be its own plate, as long as the first homes are that far apart.
- Found in the re-run: without yard runs, the cellar never fills (question 12).
- Wording: the staff are written without he or she; "run of 3" is kept for the challenge run only, and venue nights are "three deliveries".
