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

## Round 2: street cred (the owner's choice, 19 November)

Your answer to round 1: street cred replaces crates, because wine crates do not fit a game in which you take cars.
- **The split:** money buys homes; cred brings the people who run them, because they come for your name.
- **Cred is the scarce currency,** like a freemium game's premium currency, but nothing is sold and no timer can be skipped. Only play earns it: missions, firsts and badges.
- **Never cred:** taking an ordinary car, or losing the police.

How to read the numbers:
- A **town** is the plan's plate. Every amount is an **estimate**.
- **Modelled** means the plan's simulator: 5 homes by hand, half buyer, no wages, 3 seeds, 180 visit days, medians.
  - Starts: Pottenstein and Titisee (villages), Nuremberg and Manhattan (cities).
  - Players: casual (5 minutes, 5 visits a week), regular (15 minutes daily), heavy (60 minutes daily).
  - A mission takes 2.5 minutes. Missions per visit day: casual 0.5, regular 2, heavy 6.
- The **money day** is the plan's day for the same step without cred.
- **Measured** means a scripted driver in the running game.

### 1. The design in short

Design 2, "money buys the homes, your name brings the people", wins.
- **Critics' scores** (rules, cheating, equal start): design 2 got 6, 5 and 6.5; design 1 got 5, 5 and 5.5; design 3 got 6.5, 3 and 5.
- **The model:** designs 1 and 3 kept a money price on hires, so regular players waited for money (19-22 visit days) and hardly ever for cred (0-2).

This answer is design 2 with the critics' fixes and your badges, plus design 3's cars that differ by country and city, and its car show.

For the player: every visit day, today's car job, today's police job and the race of the day wait nearby. The day's first mission pays 35 cred, so one mission of about 2.5 minutes in a short visit counts. More missions still pay, and badges reward doing more and doing it well. Cred signs on the staff (a venue's manager too); money buys homes and venues.

### 2. Where cred comes from

**Badges for ordinary jobs** (each pays once; every delivery counts):
- **The ladder** keeps your counts and adds steps between them.
- **It pays twice your example.** At your amounts, a regular player who never does a mission gets the first housekeeper on visit day 153, and a casual one never does. At twice, days 41 and 119.
- **Players who do missions** finish on the same day either way.

"Next up" in your message is read as 10 jobs.

| jobs done | your example | suggested | visit day: casual / regular / heavy |
|---|---|---|---|
| 3 | 5 | 10 | 2 / 1 / 1 |
| 10 ("next up") | 10 | 20 | 10 / 2 / 1 |
| 20, 35, 50 | - | 20 each | 49 / 19 / 4 (at 50) |
| 75, 100, 150 | -, 15, next | 30 each | 157 / 65 / 13 (at 150) |
| 200, 300, 400 | - | 40 each | - / 175 / 34 (at 400) |
| 500, 750, 1,000 | next, -, next | 50, 50, 60 | - / - / 85 (at 1,000) |
| 1,500 to 10,000 | - | 60 to 120 | - |

**Badges for missions, with more variation.** Each kind has its own counts, starting at 1, and two ladders reward doing a job well. They start at your example amounts (5, 10, 15) and climb to 50. Car jobs and police jobs share the same rungs, so neither path is favoured.

| ladder | counts → cred each | first badge, visit day (casual / regular / heavy) |
|---|---|---|
| Car jobs delivered; Police jobs by the book | 1, 2, 3, 5 → 5; 7, 10, 15, 20 → 10; 25, 30, 40, 50 → 15; 60, 75, 100, 125 → 20; 150, 200, 250 → 25; 300, 400 → 30; 500 → 35; 750 → 40; 1,000 → 50 | 14 / 5 / 2 |
| Clean car jobs (no new dent, no police car ever saw you); Not a scratch (police jobs with no new dent) | 1, 3 → 5; 5, 10, 15 → 10; 20, 30, 40 → 15; 50, 75 → 20; 100, 150 → 25; 200, 300 → 30 | 16 / 5 / 2 |
| Races won (the course of the day or a friend's link; later battles) | 1, 2, 3 → 5; 5, 7, 10 → 10; 15, 20, 30 → 15; 40, 50 → 20; 75, 100 → 25; 150, 200 → 30 | - / 8 / 2 |
| Beat a friend (above both their score and the course's score to beat) | 1, 3 → 5; 5, 10 → 10; 20, 35 → 15; 50 → 20 | - / 12 / 7 |

The model assumes half of the missions that succeed are clean (estimate). Casual players race rarely, so they have no race badge by day 180.

- **How often.** A casual player meets a badge every 3-4 visit days up to day 90, then every 7 (longest wait 15).
- **How much.** Badges give 15-32% of cred until town 1 runs. For players who never do a mission, they are 86-94%.

**Firsts and missions:**

| what | cred |
|---|---|
| the very first car driven away (the parked one at the start counts) | 5 |
| the very first home / the first building painted | 20 / 15 |
| each later town: first home / first building painted | 10 / 10 |
| a town runs on its own / first town of the other kind runs | 200 / 100 |
| today's car job or today's police job | 35 as the day's first mission, else 10; +5 per running town; +5 for no new dent |
| more car or police jobs that day | 5 each, no limit |
| race of the day (course of the day, friend's link, later a battle) | 10 (+5 per running town), never the 35 |
| the day's harder car: hot (heat 2) / the long way | +15 / +5 |

Painting the first building costs more than 3 deliveries pay. So by the time it is painted, every player has the three firsts (5 + 20 + 15) and the 3-jobs badge (10): 50 cred, the caretaker's price.

**The two paths, side by side:**

| | outlaw: today's car job | law-abiding: today's police job |
|---|---|---|
| what you do | take the parked car of the day (alarm: heat 1) to the lock-up | return a found car to its owner (you have the key, so it is no offence) |
| fails when | caught or wrecked | you commit any offence |
| success | 65-95% by place (measured) | 85% (estimate) |
| town-1 team, visit day (casual / regular / heavy) | 82 / 37 / 19 | 77 / 37 / 18 |

Both paths pay the same cred and an open job's money. Doing both: 79 / 33 / 17.

**Ordinary car-taking stays an offence** and pays nothing.

**Caught on a mission:** no cred, plus the game's usual fine (25% of cash carried, 15% if wrecked, never the bank). You can try again at once. Cred is never taken away, and staff never leave.

### 3. The special car-theft missions

"Today near you: the lime sports car on Mill Street. A collector wants it in the lock-up."
- **The car** is parked and empty. It is a made-up kind, never a maker: pickups, campers and roadsters in the country; saloons, coupés and sports cars in cities.
- **Getting in** sets off its alarm (heat 1), and the police come as everywhere.
- **The lock-up** is a free-standing garage box by the road, with a dashed ring. It is never drawn on a mapped building.
- **Arriving ends it,** even with police behind you: "They lost you at the door. +35 cred."
- **No countdown.** The car joins "Your cars".

**Placement:**
- **The spot.** A fixed calculation on the 1.2 km earth cell and the date picks a point, moved to the nearest road with traffic. Everyone in the cell sees the same car that day.
- **No road with traffic in the cell:** the road nearest the player, up to 1.5 km. At the Titisee start, no police came in 19 of 20 tries, so a car off the traffic roads would be a free getaway.
- **Distances:** 80 m from schools, places of worship and other reserved places. The lock-up is 400-500 m away by road.

**How often.** One car of the day; after it, more cars at 5 cred each, as many as the player likes.

**The measurement.** There are 7-8 cars to take within 150 m in villages and cities alike.

| place | sight lines blocked | heat 2, lose them | heat 1, lose them | heat 1, ends at the lock-up |
|---|---|---|---|---|
| Pottenstein (village) | 45% | 35% | 75% | 70% |
| Titisee, main road (village) | 32% | 23% | 70% | 70% |
| Nuremberg, old town | 71% | 50% | 55% | 80% |
| Manhattan | 34% | 23% | 55% | 95% |
| Tokyo | 68% | 33% | 65% | 80% |
| Hong Kong | 48% | 18% | 55% | 65% |
| villages / cities | | 29% / 31% | 73% / 57% | 70% / 80% |

Each share rests on 20-40 tries: good to 15-20 points either way.

What it shows:
- **Villages and cities are equal on average.** Place by place they differ, and the split follows open or closed street layouts.
- **For the script, a getaway is luck.** In 67 of the 72 heat-2 getaways that worked, no police car ever saw the car. Of the 170 tries in which one saw it for more than 3 s, only 2 got away. A player who turns corners will do better (estimate).

**The rule that evens it out:**
1. Start at heat 1.
2. End at a lock-up 400-500 m away by road, not in a straight line. A straight 600-700 m was 981-1,433 m of road in winding towns.
3. Allow a retry at once.
4. Leave police behaviour unchanged.

The worst place goes from 18% to 65%. Outlaw-only regular players get their team on days 34-41, depending on the place. The police job has no chase, so the streets never decide it.

### 4. Staff and your name

**Cred per hire.** Design 2's ladder (50, 150, 220, 300, 380, 500) with every hire after the caretaker raised by 15%; each new town multiplies all six by 1.15. The plan's other conditions stay.

| town | caretaker | housekeeper | housekeeper | letting agent | housekeeper | manager | all six |
|---|---|---|---|---|---|---|---|
| 1 | 50 | 175 | 255 | 345 | 435 | 575 | 1,835 |
| 2 | 55 | 200 | 290 | 395 | 505 | 660 | 2,105 |
| 3 | 65 | 230 | 335 | 455 | 580 | 760 | 2,425 |

**Staff cost no money and no wage.**
- **No money price.** Any money price, even a fixed floor, made regular players wait 17-22 days for money and 0-2 for cred.
- **No cred wage.** It would be upkeep that short visits cannot keep up.

**The caretaker's due** is 50 cred, once, and the firsts and the 3-jobs badge pay it. It depends on the hire's place on the ladder and the town's number, never on rent: 50 whether the homes bring in $1,348 a day (Pottenstein) or $427,000 (Manhattan). Their card: "Signed for your name: 50 cred."

**When each hire comes** (visit day; money day in brackets), village Pottenstein / city Nuremberg:

| hire | casual | regular | heavy |
|---|---|---|---|
| caretaker | 12 [12] / 13 [13] | 4 [4] / 4 [4] | 1 [1] / 1 [1] |
| 1st housekeeper | 17 [14] / 17 [15] | 6 [6] / 6 [6] | 3 [3] / 3 [3] |
| letting agent | 46 [35] / 44 [40] | 17 [14] / 17 [17] | 8 [7] / 8 [8] |
| manager: town 1 runs | 79 [53] / 78 [54] | 33 [36] / 33 [28] | 17 [15] / 17 [15] |
| town 2 runs | 158 [85] / 154 [94] | 65 [60] / 62 [58] | 35 [31] / 34 [33] |

Titisee and Manhattan come within 2 days of these. Staff were never unpaid or idle.

**How much harder cred is:**
- **What players wait for** in town 1 (visit days held up, casual / regular / heavy): for cred 31 / 15 / 6, for money 0 / 0 / 0. In the plan, money held them 22 / 20 / 4.
- **How it comes in.** Money comes without play once the caretaker banks rent. Cred comes only from play: a regular player earns 57-98 cred a visit day, a casual one 17-30.
- **Money piles up for regular and heavy players.** By day 180 a regular player holds $435M, against $4.7M in the plan (heavy: $387M against $18M). Money needs things of its own to buy (section 7).
- **Casual players fall further behind after town 1.** Town 2 runs on visit day 154-158, against 85-101 for money, and by day 180 they have 2 towns, against 4 in the plan. They hold $11M, against $43M.

### 5. Fairness

| player | town-1 team, visit day (casual / regular / heavy) |
|---|---|
| does both kinds | 79 / 33 / 17 |
| law-abiding only / outlaw only | 77 / 37 / 18 and 82 / 37 / 19 |
| no friends playing | 79 / 33 / 17 |
| friends send a link every visit day | 131 / 37 / 16 |
| never a mission | never; first housekeeper on days 119 / 41 / 11 (3-minute visitors: just short by day 180) |
| 3-minute visitor, one mission a visit | 97-109 (money day 65-73); caretaker on the money day |

- **One path only** loses the day's second job slot, not anything about the path.
- **Friends' links** cost casual players time, not cred: a 6-minute race replaces the visit's mission.
- **The run of 3,** its score and its links stay as they are.

**Fake or self-sent links.** Measured in today's game: a hand-made link asking for a run of 5 with legs of 0 m finished in 0.55 s, paid $750 and counted 5 deliveries. That works now, with or without cred, and is worth fixing on its own. Unchecked, about 50 minutes of loading such links would earn about 780 cred (estimate), 43% of town 1's team. The rules:
1. **Check the course.** A link pays cred, counts toward a badge or adds deliveries only with 3 plain legs of at least 200/280/360 m by road.
2. **Work out the score to beat from the course,** never from the sender's score.
3. **One race of the day,** never worth the 35. Links you sent yourself pay nothing.
4. **Visit days only move forward.** Changing the clock gives nothing.
5. **Battles pay cred** only once the server checks claims.

### 6. Country and city

Plainly: nothing makes both kinds needed for the team. That is on purpose: the start stays equal and nobody is stuck. At the top:
- **The cars differ by kind,** so a full car show needs both.
- **Venue step 3 needs a showpiece car from the other kind of town, and step 4 needs two more.** A visit is enough: do a job there and drive the car home.
- **The Touring Gala** needs both kinds.
- **Your first town of the other kind** pays +100.

Design 3's model put this need on the manager instead, and casual players stalled in town 2 for good.

### 7. Venues, the car show and the Touring Gala

"The art venue" is the car show: at gala nights your cars stand on plinths, lit like paintings. Taken cars are labelled "from a car job"; found cars are "on loan" from owners you helped, so both paths fill the show. A separate gallery would add a building, not a new thing to do.

| step | money | cred | needs |
|---|---|---|---|
| pub | opens with the paint | - | - |
| bar and club (barn / hall) | plan's shop price | 150 to sign its manager | - |
| inn / restaurant | 4 days of rent | 250 to sign its manager | 1 showpiece |
| festival barn / hotel | 8 days | 400 to sign its manager | 2 showpieces |
| gala night (car show) | 1 day | pays 40 | 3 cars |
| Touring Gala | 5 days | pays 150 and the trophy, once per town | both kinds; 6 cars |

- **Nights you host** pay 10 cred. Managers host nights for stars and money only.
- **Not modelled.**

### 8. Tone

- **Age rating** matters only for app stores. This is not legal advice.
  - PEGI's guidance for 16 has named "the depiction of criminal activities" (older text, quoted by secondary sources; check PEGI's current criteria). Google Play's questionnaire gives PEGI ratings in Europe.
  - Missions make taking cars rewarded, not just allowed.
  - This design is the mildest of the three: no money bonus for crime, an alarm every time, the same cred for the police path, nobody pulled from a car, and no weapons.
  - Answer the questionnaire honestly.
- **The famous game the name nods at.** Its rules may be shared, its words may not: never "wanted", "export", "respect" or "heat level", and no stars under the cash.
- **What makes it yours:** the key tag ("people hand you their keys"), the lock-up, "Your cars", the car show, and a landlord's story, not a crime empire.
- **The look.** "Cred 245" on a paper key tag: no gem and no coin.
- **"Street cred."** A 2020 role-playing game uses it as a level (fairly sure), so spend it and show no level bar.
- **"Badge."** The game already uses the word twice: for the police level in the help text ("light up the badges", main.ts:668-669; on screen it is four red shields, styles.css:27-29) and for the police station's mark on open jobs ("the pump, the flame and the badge", main.ts:334, homesUi.ts:477). Keep "badge" for your achievements and say "red shields" and "the police shield" there.

### 9. What changes against round 1, and the build

- **Gone:** crates, the cellar, yard runs, crate wages, the swap and the carrier.
- **Staff are signed on for cred alone.** The caretaker still comes at 5 homes and the paint.
- **Money buys** homes, venues, galas and pilots, priced in days of rent.
- **Still there:** the venue ladder, stars and the Touring Gala. The need for the other kind now uses cars.
- **Pacing, town 1:**
  - regular players run on day 33, against the money day of 28-36;
  - heavy players on day 16-17, against 15-17;
  - casual players 22-26 days later than the money day.
- **Build, about 8 days** (estimate):
  - cred and firsts, 1;
  - badges, 0.5;
  - spots and the lock-up, 1.5;
  - car job, 1;
  - police job, 1;
  - races and the link check, 1.5;
  - staff in cred, 0.5;
  - visit days, the morning line and tests, 1.
- **Later, about 5.5 days:** "Your cars", venues, galas and battle cred.

### 10. Questions for the owner

1. **Hires take cred only, with no money price and no wage?** Suggested: yes.
2. **Should "Jobs done" pay twice your example?** Suggested: yes. Otherwise a player who skips missions waits until day 153.
3. **Casual players finish town 1 22-26 days after the money day, and town 2 about 60 days after it (2 towns by day 180, against 4). Is that acceptable?** Suggested: yes for town 1; for later towns, tune after you play. The levers are the day's first mission (35) and the 15% per town.
4. **A player who never does a mission stops at the caretaker. Is that intended?** Suggested: yes, and the bank says why.
5. **Car jobs never pay more than police jobs? And is a store release planned?** Suggested: yes; answer the rating questionnaires honestly.
6. **Are both kinds of town needed only above the team?** Suggested: yes.
7. **Is "the art venue" the car show?** Suggested: yes.
8. **Build the link check and forward-only visit days first?** Suggested: yes.

### 11. Where the numbers come from

All in the session's scratchpad, not in the repo: /tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/cred/:
- **Getaways:** measure/table.md.
- **The three designs:** model/x3-tables.md and model/x3-ladders.md.
- **This design:** final/x5-designs.mjs and final/x5-run.mjs with `PRESET=final`. Results: final/x5-tables.txt, final/x5-ladders.md and final/x5-short.txt.
- **Cheating:** exploits/x4-forger.md.
- **The simulator:** /tmp/claude-0/-home-user/19d968bc-3916-40c7-b8c9-654318434293/scratchpad/sim/econ-final.mjs.

### 12. Checked after the write-up

- **Against the model's output** (final/x5-tables.txt, x5-ladders.md, x5-short.txt): the hire prices and their sums, every hire day in section 4, the fairness table, the badge days, the shares of cred from badges and the 3-minute visitors all match.
- **Corrected here:**
  - the mission badge counts are now listed exactly, with races and "Beat a friend" in rows of their own;
  - the hire price rule (+15% once on later hires, not per hire);
  - the casual players' town 2 and money by day 180 were added;
  - the forged link asked for a run of 5;
  - the venues' cred is for signing each venue's manager;
  - the age-rating line now names PEGI's older text.
- **In the code:** "light up the badges" is at main.ts:668-669, the police level is drawn as four red shields (styles.css:27-29), and "the badge" marks the police station on open jobs (main.ts:334).
- **Wording:** no follower count and nothing that looks like a social network; staff are written without he or she; "run of 3" is kept for the challenge run only.
- **Venues and the car show are not modelled.** Their prices are estimates to tune.


## The owner's answer (19 November): start with the suggestions, learn from play

"Is there a possibility you learn this via the save games? Then we just start with your suggestions and learn on the run."

So the suggested answers to section 10's questions are the starting point. What the server already holds, checked on 19 November:
- **Online saves: 8 in all,** about 630 characters each. Saving is optional and offered only once a player owns a home. A save holds where a game is now (homes, scores, settings, the last visit day), not when anything happened.
- **The play counts** (`play_counts`, every browser, nothing about the player), 17-19 November: 98 new browsers and 12 return visits. 55 runs started and 13 finished. 23 homes bought, and rent collected on a return twice. Visits: 56 under 1 minute, 59 of 1-5, 15 of 5-20, 2 over 20.

How to learn from play:
1. **Use the counts, not the saves.** They cover every browser, the README already says what they are, and they keep nothing about the player. The saves are few and come from the keenest players. The README promises them for going on with a game on another device, not for study.
2. **New words to count,** each a word and a number per day. The visit day is sent as a span (1, 2-3, 4-7, 8-14, 15-30, 31+), never as a date:
   - a mission tried and how it ended (car job delivered / caught / wrecked; police job done / broken by an offence);
   - each first, badge and hire, with the visit-day span it came on;
   - "held by cred" on a visit's first look at the next hire.
3. **Changing numbers on the run.** Cred already earned is never taken back. A new price applies only to hires not yet signed, and a new amount only to badges not yet earned. Each change is a release that the owner approves.
4. **What comes quickly and what does not.** At today's traffic, mission success rates and the first badges show within a week or two. Players who reach the caretaker are few, and the full team (visit day 33 or later) may take months to show. Until then, the owner's own play is the test for the later hires.
5. **Needs the owner's approval before it goes live:** a change to `count_play` on the live server (it only takes the words it knows), and the README's line on what is counted.

## Round 3: the owner's answers (19 November)

How to read the numbers:
- Every amount is an **estimate** to tune after play.
- A **visit day** is a day you play. The **money day** is the visit day on which the same hire would come if staff cost only money, as in the plan before cred, in the same towns.
- Three numbers such as 76 / 32 / 15 are always **casual / regular / heavy** players: 5 minutes 5 days a week, 15 minutes daily, 60 minutes daily.
- **Modelled** means worked out with the plan's simulator (round 2's model with this round's changes), not measured in the game: 4 starting places (Pottenstein and Titisee as villages, Nuremberg and Manhattan as cities), each run 3 times with different luck, over 365 visit days. Town 2 or 3 is always of the other kind (section 7).
- Where one number stands for the 4 places it is the middle: the second and third of the four, averaged and rounded. Round 2's numbers are worked out the same way here, so a few differ by 1-2 days from round 2's text.
- "-" means not within 365 visit days.

### 1. Your answers, and what round 3 suggests

| # | your answer | what round 3 suggests |
|---|---|---|
| 1 | a wage in dollars, if it stays simple | Suggested: no wage, and one line of story on the hire card instead (section 5, question 4). A simple $500 wage is ready if you prefer it. |
| 2 | a harvest, not literal badges; badges rarer | One harvest for ordinary jobs and missions (section 3). Our addition: each town that runs makes cred come faster (question 3). Badges become a separate, rare feature of 15; we suggest they pay no cred (section 4). |
| 3 | casual players later than with money: yes | Kept. Casual players get town 1's team 18-25 visit days later than if staff cost only money, depending on the place (round 2: 22-26). |
| 4 | not understood | Explained below. Changed: nobody is stopped any more. Every hire still comes, only slowly. |
| 5 | an inside job, sometimes undercover for the police | Both added, once a week each (section 6). A car job now counts a little more than a police job, because its alarm is on. Four more kinds wait for later. The store question is still open: we assume no store release. |
| 6 | the second or third town of the other kind | Rule: by your third town, one of your towns must be of the other kind (section 7). |
| 7 | art: more than one event, creative about reality | Art in four places, a first set of five ideas (section 8). Built after the first release. |
| 8 | "Huh?" | Explained below: two small guards against cheating, built together with the harvest. |
| 9 | "Oc" | Agreed. The renames are listed in section 10 and are made with the build. |

### 2. The two questions you did not understand

**Answer 4: "a player who never does a mission stops after the caretaker"**

- **Missions** are the two special jobs offered each visit day: one car job (against the law) and one police job (for the law). The **race of the day** is offered beside them and counts as three deliveries. **Ordinary jobs** are the open jobs at the pump, the flame and the police shield. Today's game already says "mission" for two other things ("Private mission: your first home" and "Mission: repair your building"). They stay as they are, and their packages count as ordinary deliveries.
- In round 2, ordinary jobs earned cred only through a few "Jobs done" badges. A player who never did a mission got the caretaker and, weeks later, one housekeeper (visit day 120 / 41 / 11). After that almost nothing came: no further hire for a 5-minute player within 365 visit days, a second housekeeper on visit day 203 for a 15-minute player and 52 for a 60-minute one, and the full team for nobody. Their homes and rent carried on as normal.
- Under the harvest (section 3: every job adds points, and points bring cred) every ordinary job adds a little cred, so all the staff still come, only slowly:
  - without missions, town 1's team takes about **25 hours of play** at any visit length (visit day 298 / 99 / 26);
  - with missions it takes 6-8 hours for 5- and 15-minute players (visit day 76 / 32) and 15 hours for a 60-minute player (visit day 15). In the model a 5-minute player does a mission on about 3 visits in 5, a 15-minute player 2-3 a visit and a 60-minute player about 7.
- Missions stay clearly better: town 1's team comes 3.9 times sooner for casual players, 3.1 for regular and 1.7 for heavy players.
- You asked whether stopping there could be good. We think not: a player who can get no further has nothing left to play for. Slow but never stopped is better. Question 2 asks whether 25 hours is the right kind of slow.

**Answer 8: the link check, and days that only move forward**

These are two small guards against cheating in your own copy of the game.

1. **The link check.** After a run you can send a friend a link to race the same route. A link is only text, and anyone can edit it. In a test in today's game, an edited link "finished" a run of 5 with half a second on its clock (about 6 seconds of real time), paid $750 and counted 5 deliveries.
   - Under the harvest every delivery adds cred, so edited links would hand out cred for nothing. 10 such links give a new player 360 cred. 100 links, about 12 minutes of work (estimate), give 1,790 cred: 98% of town 1's whole team (1,835).
   - The check: before a friend's link pays or counts anything, the game measures the route on the roads itself. The route must have 3 plain deliveries (no special packages), at least 200, 280 and 360 m apart by road. The game works out the score to beat from the route, not from what the link claims.
   - Two things this needs. The game must stop making shorter routes itself: today about 1 village run in 90 has a shorter leg (13 of 1,200 measured; none of 400 city runs), and its link would count for nothing. And a link you made yourself adds nothing to the harvest (its deliveries pay money as today): for that the game has to remember the runs it has sent, which it does not do today.
   - Still open: a hand-made link at exactly these lengths passes the check and can be played again and again (section 12).
2. **Days only move forward.** Rent and today's first mission come once a day, and the game takes the day from the phone's clock.
   - Today it only asks whether the date differs from the last visit (src/homesUi.ts:613-614). So setting the phone back one day already brings another day of rent.
   - Under the harvest it would also bring another "today's first mission", about 40 cred.
   - The fix: the game remembers the latest day played and never counts an earlier date again. This stops setting the clock back. It does not stop setting it forward: each day forward still brings a day's rent and a first mission, and nothing offline can prevent that (section 12).
   - If the game's day is ahead of the phone's date (a wrong date that was corrected, or a second device with a wrong clock on the same online save), rent, today's missions and badge days wait until the date catches up. The bank then says so in one line: "Your game is 12 days ahead of this phone's date. Rent and today's jobs come back on 2 December."

**How urgent.**
- Not for fairness between players. Nobody pays, each player has their own scoreboard ("Kept in this browser only", src/scores.ts:1-3; an online save carries it to the player's own other devices), and a cheat spoils only the cheater's own game. Two outside effects: a fake score to beat can be sent to a friend, and every forged link adds a finished run (and a date trick a "rent on return") to the play counts we want to learn from. So a run from a link is counted there only after the link check.
- But both should be built together with the harvest, because the harvest turns deliveries and days into cred.
- **If the harvest is built before the link check:** a friend's link still pays money as today, but adds nothing to the harvest.
- Build: about 1 day for both (estimate; round 2 put races and the link check at 1.5 days).

### 3. The harvest

**In short.** Every delivery and every mission adds points to your harvest. A step is the number of points the next +10 cred costs. Each time the points fill a step, word gets around and you get +10 cred. Each step costs one point more than the last, so the same play slowly brings less.

**Where this differs from what you said.** You described a harvest where "the longer you play the more points you need to get a few cred points". Two additions are ours. First, missions fill the same harvest, in place of round 2's flat 35 cred. Second, each of your towns that has run on its own adds 10 cred to every full step, for good. This second one works against your words: it roughly cancels the growing steps, so a delivery stays worth about 4-5 cred as long as new towns keep coming, and each later town takes about as long as the first (5-minute players: 76, 77 and 77 visit days). With your harvest exactly as you described it, town 2 runs on visit day 227 / 102 / 50 instead of 153 / 63 / 30, and town 3 on - / 233 / 115 instead of 230 / 93 / 45 (modelled). Question 3 is this choice.

**What fills it:**

| what you do | points | counts like |
|---|---|---|
| a delivery: an open job, a leg of a run of 3 (a run's first leg counts once its second is delivered), each of a race's 3 deliveries, a package to your own building, a ride-along with a new hire, a shop order, an art event or art delivery | 50 | 1 delivery |
| today's first mission: the day's first car job or police job (on their days the inside job or undercover) | 500 | 10 deliveries |
| today's first job of the other of the two (a police job after a car job, or the other way round) | 150 | 3 |
| any further car job or police job that day | 50 | 1 |
| the alarm was on in the day's first car job or undercover job (once a visit day each; never for the inside job) | +100 | 2 more |
| the race of the day, won (once a visit day) | +100 | 2 more |
| a failed mission, a friend's link before the link check is built, a link you made yourself | 0 | nothing |

- A leg of a run of 3 counts when it is delivered. Only the first leg waits: it counts once the second leg is delivered. So restarting a run after its short first leg earns nothing, and a short visit keeps what it delivered. (New players start in run mode, 42 of 55 runs started were not finished, and the model counts every delivered leg.)
- The +100 for the alarm comes only with the first such job of the day: a further car job counts like 1 delivery, alarm or not. The race of the day is never today's first mission: it is a run of 3 that counts its 3 deliveries, and 100 more once a visit day if you win. A friend's checked link counts the same way and shares that one +100.
- The harvest is kept per player, never per town, and it never resets.

**The steps.** Step n needs 49 + n points, and leftover points carry over. One more delivery every 50 steps. Before missions start (the board appears on the visit day after the caretaker is first offered), both kinds of player reach the first 15 steps on nearly the same days.

| step | points | deliveries from the start | cred from the start (firsts not counted) | visit day: with missions | visit day: never a mission |
|---|---|---|---|---|---|
| 1 | 50 | 1.0 | 10 | 1 / 1 / 1 | the same |
| 2 | 51 | 2.0 | 20 | 2 / 1 / 1 | the same |
| 3 | 52 | 3.1 | 30 | 3 / 1 / 1 | the same |
| 4 | 53 | 4.1 | 40 | 4 / 1 / 1 | the same |
| 5 | 54 | 5.2 | 50 | 5 / 1 / 1 | the same |
| 6 | 55 | 6.3 | 60 | 6 / 2 / 1 | the same |
| 7 | 56 | 7.4 | 70 | 7 / 2 / 1 | the same |
| 8 | 57 | 8.6 | 80 | 8 / 2 / 1 | the same |
| 9 | 58 | 9.7 | 90 | 9 / 2 / 1 | the same |
| 10 | 59 | 10.9 | 100 | 11 / 3 / 1 | the same |
| 11 | 60 | 12.1 | 110 | 11 / 3 / 1 | the same |
| 12 | 61 | 13.3 | 120 | 12 / 3 / 1 | the same |
| 13 | 62 | 14.6 | 130 | 12 / 3 / 1 | the same |
| 14 | 63 | 15.8 | 140 | 13 / 4 / 1 | 14 / 4 / 1 |
| 15 | 64 | 17.1 | 150 | 14 / 4 / 1 | the same |
| 25 | 74 | 31 | 250 | 15 / 5 / 2 | 25 / 7 / 2 |
| 50 | 99 | 75 | | 22 / 8 / 3 | 54 / 16 / 4 |
| 100 | 149 | 199 | | 45 / 15 / 7 | 125 / 40 / 11 |
| 200 | 249 | 598 | | 93 / 37 / 18 | - / 120 / 31 |

**What a full step pays:** 10 cred while town 1 is built, 20 once a town has run on its own, 30 after two, and so on. A town that has run keeps counting, even if you later buy past what its team covers. Modelled over the year, today's first mission brings about 35-55 cred and a delivery 4-5.

**What the player sees:**
- **The first five minutes stay exactly as today.** Cred is counted silently from the start.
- **The tag first appears when the caretaker is first offered** (5 homes and the paint: about an hour of play in the model, visit day 13 / 4 / 1): "Word has got around: Cred [n]. The caretaker signs on for 50." By then n is about 150-200 (the firsts plus the steps filled so far; the model gives 140-220), so the 50 never delays anyone: it shows what cred is for.
- **The daily board** (today's two missions and the race) appears from the next visit day. So for about the first hour of play there is no cred, no board and no mission on screen. Round 2 offered the missions from the first visit; hiding them is our suggestion, to keep the start simple. At today's visits (2 of 132 longer than 20 minutes) few players will get that far soon.
- **The tag** "Cred 245" sits on round 2's paper key tag, with no line under it. There is no step number, no level, no point count and no count of people.
- **Tapping the tag** shows one line: "Word gets around: 2 more deliveries to +10 cred."
- **When a step fills:** "+10 cred. Word gets around." A mission that fills several steps shows one note with the total ("+40 cred").
- **Job cards** show what the job would add right now, counting the points already in the step, so the note at the end always matches the card: "Today's police job: +40 cred." Where that is less than one step, the card has no number: "Today's police job: towards your next +20 cred." The race card shows the amount for finishing and "more if you win". "Counts like 10" stays in the design notes, never on screen.
- **When a town first runs:** "Your town runs on its own. Word gets around faster: +20 cred a time from now on."
- **The save** holds the points in the current step, the steps filled, the game's day and that day's marks (first mission done, first car job and first police job done, race win counted). Without the marks a reload would bring today's first mission again.

Why this matters: 115 of 132 visits last under 5 minutes, and 13 of 55 runs were finished.

**The pace for players who never do a mission** (town 1 unless named):

| hire | with missions | never a mission | money day |
|---|---|---|---|
| caretaker | 13 / 4 / 1 | 13 / 4 / 1 | 13 / 4 / 1 |
| housekeeper 1 | 15 / 6 / 3 | 18 / 6 / 3 | 15 / 6 / 3 |
| housekeeper 2 | 29 / 10 / 5 | 45 / 13 / 5 | 25 / 9 / 5 |
| letting agent | 41 / 14 / 7 | 94 / 29 / 8 | 38 / 14 / 7 |
| housekeeper 3 | 53 / 19 / 9 | 165 / 54 / 14 | 43 / 21 / 9 |
| manager: town 1 runs | 76 / 32 / 15 | 298 / 99 / 26 | 56 / 34 / 16 |
| town 2 runs | 153 / 63 / 30 | - / 213 / 53 | 92 / 60 / 33 |
| town 3 runs | 230 / 93 / 45 | - / 330 / 80 | 134 / 89 / 53 |

- In hours, without missions: 298 visits of 5 minutes, 99 of 15 or 26 of 60 are all about 25 hours.
- 3-minute visitors who never do a mission: housekeepers on visit day 23-27 and 70-71, the letting agent on 156-165, the third housekeeper on 304-314, no team within 365 visit days.
- What they wait for is cred, not money: on 263 / 85 / 15 visit days in town 1 the next hire lacked only cred.

### 4. Badges: their own, rarer feature

- You meant the badges only as a comparison, but liked them as a feature of their own, and rarer. So there are now 15, they are hard to get, and they sit apart from cred.
- **Days are counted in total, never in a row.** Nothing is lost for missing a day. A streak that breaks would punish the 5-days-a-week player and pull people back like a timer.
- **A day counts** when you deliver something or finish a mission on it. Opening the page is not enough.
- **We suggest that badges pay no cred.** You did not ask for this, and in round 2 they paid. The harvest already pays for every delivery and mission, so a badge that paid too would pay twice for the same play. If you would rather have each badge pay a small amount once, say so and we model it.
- **Where they live:** as enamel pins in the bank panel, not on the driving screen. Tapping shows each pin with the date earned, and the ones not yet earned in grey with their plain condition. No total score, no count of people, no profile wall.

| # | badge | what it takes | visit day, both kinds of mission (estimate where marked) |
|---|---|---|---|
| 1 | 7 days of play | 7 days played in total | 7 |
| 2 | 30 days of play | 30 days played | 30 |
| 3 | 100 days of play | 100 days played | 100 |
| 4 | 365 days of play | 365 days played (about 17 months at 5 days a week) | 365 |
| 5 | Your first town runs | the manager signed on and every home looked after | 76 / 32 / 15 (never a mission: 298 / 99 / 26) |
| 6 | Both kinds | a town of the other kind runs | by town 3: 230 / 93 / 45 |
| 7 | Three towns run | | 230 / 93 / 45 |
| 8 | Across the sea | a home on another continent (with a pilot) | when the player chooses |
| 9 | 7 clean days | 7 days in total on which you finished a car job, a police job or a weekly special and committed no offence of your own all day (a job's own alarm does not count; knocking someone over, taking a driven car, ramming and crashing do) | 15- and 60-minute players in the first two weeks; 5-minute players after about 5-8 weeks (visit day 26 or later, estimate) |
| 10 | A hundred without a dent | 100 police jobs with no new dent | law only: 412 / 88 / 32; both kinds: 830 / 198 / 66 (estimate) |
| 11 | Never seen | 100 car jobs or inside jobs with no new dent and no patrol ever seeing you | outlaw only: 412 / 93 / 33; both kinds: 825 / 185 / 66 (estimate) |
| 12 | A thousand jobs | 1,000 deliveries and missions | about 690 / 280 / 56 (estimate) |
| 13 | Ten races won from friends' links | a friend's checked link beaten on 10 days | not modelled |
| 14 | A full car show (later, with venues) | six cars on plinths at one gala night, from both kinds of town | not modelled |
| 15 | The Touring Gala (later) | host it once | not modelled |

- **How rare:** in the first calendar year (about 261 visit days at 5 a week), a casual mission player earns about 7. A daily regular player earns about 11 in 365 visit days. Round 2's ladders gave 42 / 77 / 105 badges in half that time.
- Estimated days for 10-12 assume a steady rate over the year and that half the jobs are clean.

### 5. A wage in dollars

**Suggested: no wage for now** (your call, question 4). Hires keep round 2's rule: cred once, then nothing. If you want the staff to feel like employees, add one line to the hire card: "Their pay comes out of the tenants' service charge." It has no number and no rule. It is close to life for the caretaker and the cleaning: in Germany a lease may pass the caretaker's pay (Betriebskostenverordnung § 2 No. 14) and the cleaning of shared stairs and halls (No. 9) on to the tenants in the service charge. Repairs and management may not be passed on, so for the letting agent and the manager the line is the game's own story.

Why not, from the wage piece's runs on round 2's model:
1. **It cannot shrink the money pile.** The largest safe wage is $500 per staff member each day you come back. Regular players still hold $429M on day 180 instead of $435M.
2. **It hits the poorest hardest.** At $500, casual players lose 6-9% of their money. Regular and heavy players lose 0-4%, except from Titisee, the poorest start, where they lose 10% and 6%. It takes 6-9% of a village town's rent and 0.2-1.4% of a city town's.
3. **It has a cliff.** Paid from the bank, $1,500 means 3-minute visitors in villages never get the team. At $3,000 no casual player gets it, village or city (1,194 unpaid visit days in 12 runs). Up to $500 nothing changes for anyone. At $1,000 a 3-minute visitor in Pottenstein already waits 16 visit days longer for the third hire.
4. **It changes no decision.** It is a tax shown as a line.

On the final model: a $500 wage per staff member taken only out of that town's rent moves no middle value by more than 2 visit days (town 1's team for casual players: 78 instead of 76). The largest moves at a single place are Nuremberg casual, 76 to 80, and Titisee casual without missions, 305 to 297. That is the model's run-to-run scatter. The rent was never smaller than the wage, and the wages are 0.2-0.3% of all rent by day 365 for players who do missions. So, to be fair: reasons 1 and 3 are about bigger wages or wages paid from the bank. Against this simple wage (one new word, one rule, one number) stand only reasons 2 and 4.

**If you want one anyway:** $500 per staff member each visit day, the same in every town, taken out of that town's rent before it is banked, never from savings, never above $1,000. It is a fixed amount, as you ruled earlier (what staff are owed must not depend on what the town makes), with one bend: on a day when a town's rent is smaller than its wages, the team takes the whole rent and the rest is let go.

The money pile is handled by art priced in days of rent (section 8), not by a wage.

### 6. The new missions

**What is offered each visit day in the first release** (the list on screen is the board; each of its two mission places is a slot):
- Outlaw slot: the **inside job** 1 day a week, the car job on the other 6.
- Law slot: **undercover** 1 day a week, the police job on the other 6. Never on the inside job's day.
- The race of the day, every day.
- The kind of each day follows the game's own day (the phone's date; section 2 says what happens when the clock is changed). So "today" means one thing for rent, the board and the morning line. No timer counts down to a special. But each special is there on one calendar day a week only: a player who does not play that day does not get it that week. The other way would be every 7th day you play; say if you prefer that (not modelled).
- Each slot's big points come once a visit day. Further jobs that day are the plain car job or police job and count like one delivery, alarm or not. A failed try leaves the slot open.

**The inside job** (outlaw, once a week)
- "Inside job: someone left the key in the grey estate at the yard near you. No alarm, as long as no patrol sees it leave."
- About 2 minutes. The yard is made up: a free-standing box by the road with a dashed ring, 80 m from reserved places like every mission spot. Get in: no alarm, no red shield. Patrol cars show on the little map until you are clear. Drive 250 m from the yard unseen, then on to the lock-up, 400-500 m by road.
- Ends: "In and out, and nobody saw a thing. +[n] cred."
- If a patrol sees it in the first 250 m, or you commit an offence: "A patrol saw it leave: the alarm is on." One red shield lights, and from there it is driven like an ordinary car job. It counts the same seen or unseen, with no +100 for the alarm: otherwise being seen would pay more than getting away. The tables here were modelled with that +100. Without it, outlaw-only casual players get town 1's team on 79 instead of 76, and nothing else moves by more than 2 visit days (checked run).
- Caught or wrecked: the game's usual fine. Try again at once.
- Measured: 67% got away unseen (villages 65%, cities 68%). Modelled: 94-95% delivered, counting the car-job ending.

**Undercover for the police** (law, once a week)
- "Undercover for the police: drive the station's bait car to the buyer's lock-up, as if you had taken it. The patrols are not told."
- About 2 minutes. Go to the police station (the police shield on the map). Get into the plain car: its alarm lights one red shield, and ordinary patrols chase you. Reach the buyer's lock-up, 400-500 m by road.
- Ends: "The buyer took the bait. +[n] cred."
- Caught: "Caught: the station sorts it out. No fine, but the buyer has gone quiet. Try again." That holds while only the bait car's own red shield is lit: an offence of your own on the way brings back the usual fine. Wrecked: the game's usual fine, as everywhere.
- Success is the car job's: 65-95% by place (round 2's measurement); modelled 77-80%.
- It is the law-abiding player's only chase. It can be skipped, but as modelled the law slot then earns nothing that day: the plain police job comes back only after the undercover job is done. A law-only player who always skips it gets town 1's team on 82 / 42 / 17 instead of 79 / 38 / 17 (checked run). Say if the plain police job should stay on offer beside it on that day.

**Round 2's three stay:** the car job (the alarm lights one red shield, a lock-up 400-500 m by road), the police job (return a found car, no offence allowed) and the race of the day. Measured this round: the police job succeeds 93% of the time, not round 2's guessed 85%.

**One pay rule for every kind:** today's first mission counts like 10 deliveries, the other slot's first job like 3, any further one like 1. A slot's first job of the day counts like 2 more when its alarm is on, because the police chase you and it can fail. The inside job never gets the 2 more.

| player | town 1's team | town 2 | town 3 |
|---|---|---|---|
| both kinds | 76 / 32 / 15 | 153 / 63 / 30 | 230 / 93 / 45 |
| law-abiding only | 79 / 38 / 17 | 151 / 73 / 33 | 227 / 110 / 50 |
| outlaw only | 76 / 36 / 17 | 154 / 70 / 33 | 231 / 105 / 50 |
| round 2 (on its own towns), both kinds | 79 / 33 / 17 | 158 / 64 / 35 | 239 / 92 / 54 |
| round 2, law-abiding only | 78 / 37 / 19 | 157 / 71 / 41 | 238 / 109 / 64 |
| round 2, outlaw only | 82 / 39 / 20 | 162 / 75 / 41 | 247 / 112 / 65 |
| without the alarm rule, law-abiding only | 80 / 38 / 17 | 156 / 75 / 33 | 231 / 113 / 50 |
| without the alarm rule, outlaw only | 86 / 39 / 17 | 168 / 78 / 35 | 250 / 116 / 52 |

- Both one-path players finish, within 3 visit days of each other for town 1's team and town 2, and within 5 for town 3 (the same holds with the inside job's +100 taken out: 79 / 36 / 17 for outlaw-only players). Without the alarm rule outlaw-only casual players come 6 days after law-only ones.
- Missions a visit day: 0.61 / 2.59 / 7.17. Car jobs succeed 78-83%.
- Fines paid by outlaw-only players by day 365: $0.72M / $1.20M / $1.67M.

**Later, only if the play counts show players want more variety** (about 4 days of build, estimate):
- **The swap** (outlaw, change cars halfway): measured 65%.
- **Follow the van** (law, a plain-clothes tail): measured 83%.
- **Lost car** (law, the police job with a search first): about 90% (estimate).
- **Careful hands** (either path: drive the owner's cream roadster with no new dent): measured 79%; villages 68%, cities 84%.

**Words.** Car jobs and inside jobs end at the lock-up, as in round 2, and the car joins "Your cars". "The buyer" appears only in the undercover job: the person the police are after. Round 2's "collector" is dropped, because "collection" is kept for art. No "crew". Mission text never explains a method: "someone left the key", not how a car is opened. Every outlaw kind keeps its alarm except the weekly inside job.

**Age rating** (you did not say whether a store release is planned. The only note we have is HANDOFF-ios.md of 14 November, which says of the iPhone test: "Nothing is to be submitted to a store". We assume none for now; tell us if that is wrong. This is not legal advice):
- **Apple** (page "Age ratings values and definitions", developer.apple.com/help/app-store-connect/reference/age-ratings, read on 20 November): "real-world crimes" is one example under "Mature or Suggestive Themes", in the group "Sexuality or Nudity". Infrequent is 9+ and frequent is 16+ (17+ on devices with a system older than version 26; some regions show their own values). Apple does not define "frequent" and does not say whether made-up crime in a game counts; the developer fills in the form. Our reading: with a car job every day the honest answer is "frequent", so 16+, and the law kinds add nothing to it. Apple announced its 13+, 16+ and 18+ ratings on 24 July 2025.
- **PEGI**, three points:
  1. An older copy of PEGI's text: "the depiction of criminal activities can be content of games that are rated 16."
  2. Search summaries of the UK site that explains PEGI (askaboutgames.com; the site itself could not be opened) quote: "Games rated PEGI 18 may also feature detailed descriptions of criminal techniques". They also quote that games at a lower rating "will not necessarily show any negative consequences to crime", but disagree on whether that sentence stands under PEGI 12 or PEGI 16. Low to medium confidence.
  3. PEGI's current wording could not be read directly, so it is not quoted. Our reading, not PEGI's: crime shown without punishment is not an 18 matter by itself; explaining how a car is opened could be. That is why mission text never explains a method.
- **If a store build ever comes:** switching off the outlaw slot would not be enough. Taking a car from its driver, ramming patrol cars and knocking people over are part of free play today (the help text names all three, src/main.ts:668). They need the same answer on Apple's form, and one more under violence (cartoon violence is 9+ or 13+, realistic violence 13+ or 18+; which applies is not settled here). A lower rating would need free play changed too. Law-abiding players still reach the team without the outlaw slot (79 / 38 / 17).

### 7. The other-kind town

**The rule:** among your first three towns there must be at least one village and one city. ("Village" in this plan means any town that is not a city by the rule below. The map itself labels Pottenstein, Weidenberg and Ushuaia as towns, so on screen the game says "country".)
- Town 2 may be either kind. If it is the same kind as town 1, the offer box says so before you buy: "This starts your second town. Weidenberg counts as country, like Pottenstein, so your third town must be in a city."
- The game checks only when you buy the first home of a new town, never on a hire, so a town you have started can never get stuck.
- The offer box names the two nearest places of the other kind, with "Go there".
- It never forces a pilot: the rule is waived where no city on your own continent lies within about 1,200 km (the distance tested). Of 22 starts tested by distance, that frees only Easter Island and Tristan da Cunha. The search has to reach that far at every latitude: the nine zoom-6 map tiles first planned reach only 350-1,150 km.
- Round 2's +100 cred when the first town of the other kind runs stays (worth about 2 visit days).

**What the player sees:** the game's word for the kind, never a statement about the place ("Erlangen · city", "Weidenberg · country"), and two pin shapes on the world map, shown only once town 1 runs. Never a live label while driving. The world map and the offer box carry the game's map credit.

**The numbers** (the other-kind piece's runs on round 2's model):
- Towns 2 and 3 run within -4 to +2 visit days of a player who stays with one kind. No town got stuck in 144 runs.
- Distances for the four model starts: 25-30 km to the nearest place of the other kind. Remote villages: 38-169 km. Funafuti: 1,023 km to the nearest city on the map, Lautoka in Fiji (both in Oceania, so no pilot).
- Worth it one way: a casual Pottenstein player with a city as town 2 holds $138M on day 180 instead of $9M. Worth little in money the other way: a city player's village must pay off with village-only cars, village nights and the +100.

**How a town's kind is decided.** A town is a city when any of these holds, at its first home:
1. at least 20% of the 1.5 km square is under buildings (counted from the buildings the game has loaded);
2. a city label on the map within 5 km;
3. a label of one of the largest cities (map rank 1-3) within 20 km;
4. at least 3 suburb or quarter labels within 3 km, with a largest-city label within 25 km.

Everything else counts as country (in this document: a village). The kind is fixed at the first home and saved as one letter.

**Where it goes wrong** (tested on 46 places, 17 districts of large cities and 5 places near the largest cities; Map data © OpenStreetMap contributors):
- The other-kind piece's rule (the largest cities within 15 km, no suburb test) called 4 districts of large, thinly mapped cities villages: Karachi's Landhi and Surjani, Addis Ababa's Akaki and Kinshasa's Kimbanseke. A player there would have had to cross their own city to find a "city".
- A suburb test on its own made a city of Shirakawa-go, a mountain village with 7 suburb labels. So it counts only near one of the largest cities.
- With the rule above, 4 of the 64 places that are clearly a village or a city come out other than a player would say (the 4 suburbs among the 68 are judged apart):
  - Longyearbyen (about 2,500 people) and Alice Springs (about 25,000) are cities, because the map labels them cities. That does no harm.
  - Ushuaia, a provincial capital of about 80,000 people, is a village: the map labels it a town and 11% of its square is built over. Its player needs Río Grande, 120 km away, as the city. Other loosely built towns of this size that the map labels "town" will come out the same way. (Our test list had expected a village here, and one for Takayama, a city of about 84,000 that the rule rightly calls a city. The count is corrected by hand, not re-run.)
  - Sai Kung, a small town inside Hong Kong 16 km from the label, is a city. Either answer is fair.
- Kleinmachnow, a suburb at Berlin's edge, becomes a city.
- The five city starts checked (Manhattan, Berlin-Zehlendorf, Hong Kong, Tokyo, Nuremberg) keep a village 25-26 km away: none of their nearest villages changes kind. For Manhattan and Tokyo that "village" is a suburb just past the 25 km line: South Valley Stream on Long Island (about 18% under buildings) and Nojima (28 suburb labels within 3 km). Open countryside is about 50 km from Manhattan (estimate). We suggest leaving it so; say if a big-city player's other kind should be real countryside.
- Nothing in today's game decides a town's kind. Test 1 is counted from the building outlines the game already holds. Tests 2 and 3 need one label look per town that the game does not make today (9 zoom-10 tiles, 0.3-1.1 s, about 0.5 MB, with each label's rank). Test 4 needs the labels of a few more zoom-14 tiles (estimate).

**Offline:** the kind is never fixed from the buildings alone. Until the labels are read, a new town counts as town 1's kind for the rule and the +100, and the offer box names no kind ("Its kind is read from the map the next time you are online"). The kind is settled on the next load that reads them. So a third town that must be of the other kind can only be founded online.

### 8. Art: venues and events

Art is not one more building. It happens in four places:
- on your buildings (murals);
- in your hall (studios by day);
- on the land around (a picture mown into a meadow in a village; paint on the crossing outside your building in a city);
- in your venues (a collection, and round 2's car show widened to cars and art).

**The first set** (about 7 days of build, estimate; after the venues):
- **The mural at the paint step** (2 days): "The walls are ready. Plain colour, or shall a painter do a mural?" Free, and the first art every player meets, the same in a village and a city. It needs no venue, so it can come first.
- **The art delivery** (0.5-0.75 day): a crated piece driven from a studio to your venue. It fails on a new dent (the game's own dent rule) or an offence. "Cracked frame. The studio packs another; try again."
- **Drive the drawing** (2 days): follow a chalk line at walking pace to mow a picture into a meadow, or paint the crossing outside your city building. Cover three quarters of the line and it is done (estimate). The picture stays on the ground until the next one.
- **Open studio day** (1 day): drive visitors from your venue to three studios in big halls and back, with no new dent.
- **The collection** (1.5 days): pieces bought from a dealer, brought home by the art delivery.

If only three fit: the mural, the art delivery and the collection, about 4 days.

**Later, in order:** the sculpture on a flatbed; market day; the band's gear and the stage truck; the residency (an artist gets a flat for a week and leaves the town a piece); the culture tour (the map names the town's museums and theatres, with the map credit); with "Your cars", the show at gala nights and the painted car; evening light (2-3 days), then film night and an evening of lights (lanterns in villages, lights on your tower in cities); the parade; the old painted sign; the aerial photo show. An outlaw art job only if you want one (suggested: art stays lawful).

**Rules every paid idea shares** (the free mural is the exception: it is offered at the paint step whatever waits, needs no venue and adds no points):
- Paid art opens in a town once that town runs on its own. The collection opens once two of your towns run (as modelled).
- **Art is offered only when the town you are building is quiet:** no home, renovation or shop that the next hire needs is still open there. Waiting chores do not block it (this is the rule as modelled).
- Priced in days of all your rent, so a village and a city pay the same share: an event 0.5 day; commissions 12 days per town on top of round 2's venues (18 days); collection piece k costs 2 × 1.1^k days.
- Nothing is bought unless 20 days of rent stay in hand, venues and commissions included.
- Art adds to your cred like a delivery and costs no cred.
- Pass or fail, with no star score. Stars stay for tenants and venues; an event counts as a night toward its venue's stars.
- Never at a mapped business, always 80 m from reserved places.
- The Touring Gala needs one piece made in a village town and one made in a city town.

**Why the map only names things:** 3 of 6 villages measured have no gallery, museum, theatre, cinema, arts centre or public art mapped even in a 10 km box, and the map shows only 2 in Kano, a city of millions (Map data © OpenStreetMap contributors). The map shows what volunteers drew, not what is there. Open ground splits the kinds: 5 of 6 village squares fit an 80 m drawing, none of 7 well-mapped city centres does. So field art is country art, and walls and streets are city art.

**Modelled:**
- Town 1's hires come on the same days with and without art. Towns 2 and 3 move by at most 2 visit days, which is run-to-run scatter.
- Money on day 180 in days of the player's own rent (village / city starts): regular 23 / 27 and heavy 22 / 25, against 43 / 95 and 93 / 135 without art. On day 365: 27 and 23, against 230 and 285.
- Art as played by day 365: casual about 4 events and 20 pieces (village starts 3 and 16, city starts 4 and 23-24), regular 179 and 22, heavy 283 and 22. A casual player hosts a first event around visit day 90-100 (one city start: 159) and brings home a first piece around visit day 190-215, once two towns run. 3-minute visitors have no time left for art, so nothing changes for them.
- In the model a venue that the 20-day reserve does not allow on the day its town first runs is never bought, and events and pieces go on without it. So the counts above are upper estimates, and whether an event needs its venue is open (section 12).
- Regular players who never do a mission pay in time: town 2 on 213 instead of 205, town 3 on 330 instead of 312.
- Without the quiet-town rule (art as first designed), casual players ran town 3 on 246 instead of 230, and a regular player whose friends send a link every visit day never ran town 2.

### 9. The combined numbers against round 2

| | round 2 | round 3 (suggested) | money day |
|---|---|---|---|
| town 1's team, both kinds of mission | 79 / 33 / 17 | **76 / 32 / 15** | 56 / 34 / 16 |
| law-abiding only | 78 / 37 / 19 | 79 / 38 / 17 | |
| outlaw only | 82 / 39 / 20 | 76 / 36 / 17 | |
| never a mission | never (1st housekeeper 120 / 41 / 11) | 298 / 99 / 26 | |
| friends send a link every visit day | 131 / 37 / 16 (round 2's text) | 111 / 37 / 15 | |
| 3-minute visitor, by start | 97-103 | 93-99 | 60-70 |
| town 2 runs, both kinds | 158 / 64 / 35 | 153 / 63 / 30 | 92 / 60 / 33 |
| town 2, never a mission | never | - / 213 / 53 | |
| town 3 runs, both kinds | 239 / 92 / 54 | 230 / 93 / 45 | 134 / 89 / 53 |
| town 3, never a mission | never | - / 330 / 80 | |
| towns running by day 180 | 2 / 5 / 5 | 2 / 5 / 5 | 4 / 5 / 5 |
| money on day 180, days of own rent, village / city starts | 60 / 64, 96 / 108, 163 / 139 | 9 / 58, 23 / 27, 22 / 25 | |
| visit days in town 1 on which the next hire lacked only cred | 32 / 15 / 6 | 26 / 14 / 4 | |
| visit days with a town stuck or staff unpaid | 0 | 0 | |

- Round 2's column uses round 2's own towns (Titisee had no town 2). The money day uses this round's towns. On this round's towns round 2 holds 11 / 89, 43 / 93 and 81 / 129 days of rent on day 180. So the casual village drop (60 to 9) comes from the town order, and the regular and heavy drop comes from art.
- The 3-minute visitor plays 6 minutes on the first visit, then 3 minutes, 5 days a week. Round 2's text used a 4-minute first visit, which gave 97-109 and a money day of 65-73.
- Casual players' gap to the money day in town 1 is 18-25 visit days by start (round 2: 22-26). Taken from the two middle values it is 20 (round 2: 23).
- Heavy players now run towns 2 and 3 before the money day (30 and 45, against 33 and 53). Each later town takes them 15 visit days, like the first, while the money day needs 17 and 20 (question 3).
- Casual city players still hold 58 days of rent on day 180. They are always building, so the quiet-town rule keeps art away, and money never holds them.
- Three more runs with different luck (seeds 4-6): 76 / 33 / 15; law only 78 / 38 / 17; outlaw only 77 / 36 / 16; never a mission 299 / 101 / 26.

**The biggest unknown: how long an open job takes.** The model assumes 2.5 minutes, never measured. A 5-minute visit fits whole jobs, so casual results jump:

| minutes per open job | town 1's team, with missions | money day | never a mission |
|---|---|---|---|
| 1.5 | 63 / 29 / 12 | 46 / 26 / 13 | 192 / 62 / 17 |
| 2.0 | 66 / 31 / 14 | 49 / 33 / 14 | 286 / 82 / 21 |
| 2.5 (modelled) | 76 / 32 / 15 | 56 / 34 / 16 | 298 / 99 / 26 |
| 3.0 | 97 / 33 / 16 | 64 / 36 / 18 | - / 118 / 31 |

So the "10 deliveries" is right only at 2.5 minutes. It is measured first (section 10).

### 10. What changes against round 2, and the build

**Changes:**
- Badge ladders and round 2's flat mission cred (35 / 10 / 5) are replaced by the harvest. Gone with them: +5 for no new dent, the day's harder car (+15), the long way (+5), and the ladders for clean jobs, races won and friends beaten. Round 2's ladder name "Not a scratch" is dropped too: a famous game uses it for delivering a car undamaged.
- Badges become a record of 15; we suggest they pay no cred.
- Two new missions: the inside job and undercover. One pay rule: a slot's first job of the day counts like 2 deliveries more when its alarm is on. Round 2's section 8 said "an alarm every time" and "the same cred for the police path"; both end here (your answer 5 allows it).
- The board follows the game's own day; a day that has been played is never counted again.
- Cred stays hidden until the caretaker is first offered; the board comes on the next visit day. Round 2 offered the missions from the first visit.
- The link check is built with the harvest (until then friends' links add nothing to it); a run's first leg counts once its second is delivered; a won race adds its +100 once a visit day.
- Your second or third town must be of the other kind, with a new rule for a town's kind.
- Art in four places, priced in days of rent, offered only when your town is quiet.
- Not decided in this round, so as in round 2 until venues are built: the cred for venues (10 for a night you host, 40 for a gala night, 150 for the Touring Gala; 150 / 250 / 400 to sign a venue's manager) and battle cred.
- **Answer 9's renames:**
  - the four marks that show the police are after you: "red shields";
  - help text, src/main.ts:668-669: "light up the red shields";
  - open jobs, src/main.ts:334: "the pump, the flame and the police shield";
  - tenants' help, src/homesUi.ts:477: "new locks at the police shield";
  - the screen-reader label at index.html:51, today the fixed text "Police heat": the game sets it as the shields change ("Red shields: none lit", "Red shields: 2 of 4 lit, the police are after you") and gives the element the role "img" so that it is read (a few lines in paint(), src/main.ts:917-918);
  - two documents: README.md:111-112 (the paragraph "Heat") becomes "Red shields ... (up to four). More red shields bring more police cars", and HANDOFF.md:169 says "clean run at the police shield".
  - After these changes "badge" means only the achievements. Nothing in the game is renamed yet.
- **Unchanged:**
  - the firsts: first car 5, first home 20, first building painted 15; each later town 10 and 10; a town runs 200;
  - the hire prices: town 1 is 50, 175, 255, 345, 435, 575, and each later town ×1.15;
  - no money price, and no wage unless you choose one (question 4);
  - cred is never taken away, and staff never leave.

**Build** (days, estimates):

| piece | days |
|---|---|
| measure job times in the game first (an open job, a leg of the run, a mission with reaching the car; 20 tries at each of 4 starts), then set the "10" | 0.5 |
| round 2's core: cred and firsts, spots and the lock-up, car job, police job, staff in cred, visit days and the morning line, the renames, tests | 6 |
| the harvest (in place of round 2's badge ladders) | 0.5 |
| races, the link check and days that only move forward | 1.5 |
| cred hidden until the caretaker; the board from the next visit day | 0.25 |
| the board's kinds by the day, the inside job, undercover | 2 |
| tests of the new kinds and the play-count words | 0.5 |
| the other-kind rule: the kind, the founding check, the offer box, the pins | 1.5 |
| badges as a record | 0.5 |
| **first release** | **about 13** |
| later: "Your cars", venues and galas (round 2's later build) | 5.5 |
| later: art, first set (or 4 for three ideas) | 7 |
| later: evening light | 2-3 |
| later, if counts show demand: the swap, follow the van, lost car, careful hands | 4 |

**Learning from play, updated.** Points 2-4 of "The owner's answer (19 November)" above were written for round 2's badge ladders. These replace them; points 1 and 5 stand.
- **Words to count,** each a word, one detail word and a number per day, nothing about the player or the place. The visit day is sent only as a span (1, 2-3, 4-7, 8-14, 15-30, 31-60, 61-120, 121+). The words: the caretaker first offered; a mission tried and how it ended (car job, police job, inside job, undercover, race); harvest steps 5, 15, 25, 50, 100 and 200; each first, each hire and each town that runs; "only cred missing" on a visit's first look at the next hire; how long an open job took (under 1 minute, 1-2, 2-3, 3-5, over 5); a new town's kind against the first; a friend's link checked (passed or refused).
- **Changing numbers on the run.** Cred already earned is never taken back. A new price applies only to hires not yet signed. A change to the harvest applies from the next step on. A badge already earned stays. Each change is a release that you approve.
- **What comes quickly and what does not.** Cred, the board and the missions appear only after about an hour of play. So the first weeks show job times, the first harvest steps and how many players reach the caretaker's offer. Mission success rates need players who come back for two weeks or more and may take months; town 1's team (visit day 15 at the earliest, 76 for a 5-minute player) longer still. Until then your own play is the test.

### 11. Questions for you

1. **Pace: should a player who does missions get town 1's full team about as fast as in round 2?** That is visit day 76 / 32 / 15 (round 2: 79 / 33 / 17). Yes (suggested): today's first mission fills the harvest like about 10 ordinary deliveries, and we set the exact number after measuring how long a job takes in the game. No, faster: like 11 gives 73 / 30 / 15. No, slower: like 9 gives 81 / 33 / 15.
2. **A player who never does a mission needs about 25 hours of play for town 1's full team. Is that right?** That is visit day 298 / 99 / 26: more than a year of 5-minute visits. Yes (suggested): it stays. No, faster: a harvest that gets harder only half as fast gives about 17 hours (209 / 68 / 18), but then players who do missions get the team on 62 / 23 / 11, and 15- and 60-minute players get it well before staff would come for money alone (34 and 16).
3. **Should a town that runs make word get around faster, so that each later town takes about as long as the first?** You described a harvest where cred simply gets harder the longer you play; here we suggest otherwise. Yes (suggested): every town of yours that has run on its own makes each payout of the harvest 10 cred bigger (10, then 20, then 30). No: a smaller amount, or none (your harvest as you described it), and then later towns take longer and longer:

   | each running town adds | town 2 runs | town 3 runs | never a mission: town 2 / town 3 |
   |---|---|---|---|
   | 10 (suggested) | 153 / 63 / 30 | 230 / 93 / 45 | - / 213 / 53; - / 330 / 80 |
   | 7.5 | 162 / 68 / 33 | 253 / 106 / 52 | - / 233 / 57; - / - / 91 |
   | 5 | 173 / 75 / 36 | 285 / 128 / 62 | - / 261 / 64; - / - / 110 |
   | 0 (the pure harvest, as you described it) | 227 / 102 / 50 | - / 233 / 115 | - / 365 / 88; - / - / 206 |
   | if staff cost only money (the money day) | 92 / 60 / 33 | 134 / 89 / 53 | |

   At 7.5, 60-minute players get towns 2 and 3 on about the days they would with money alone, and 5-minute players get them 9 and 23 visit days later than at 10 (7.5 also needs rounding on screen). With 0, a 5-minute player does not run town 3 within 365 visit days.
4. **No wage for now, and one line on each hire card instead** ("Their pay comes out of the tenants' service charge.")? Yes (suggested): nothing else changes. No: each staff member costs $500 on every day you play, the same in every town, taken out of that town's rent before it reaches the bank and never from savings. In the model no hire then comes more than 2 visit days later (middle of the 4 places), but the wage takes 6-9% of a village town's rent and 0.2-1.4% of a city town's.
5. **In the undercover job (you drive the police's bait car to a lock-up), should the ordinary patrols chase you?** Yes (suggested): the patrols are not told, so the bait car's alarm brings a chase like the car job's, but being caught costs no fine. No: no alarm and no chase; you drive the bait car to the lock-up, and it fails only on an offence, like the police job (not modelled).
6. **Should art be offered only when the town you are building has nothing open that its next hire needs** (no home, renovation or shop)? Yes (suggested): art costs players who do missions no time. A 5-minute player then hosts a first art event around visit day 90-100 and brings home a first piece around visit day 200: about 4 events and 20 pieces in the first 365 visit days (about 17 months), besides the free mural. No: art is offered whenever a town runs; in the model a 5-minute player then ran town 3 on visit day 246 instead of 230, and a 15-minute player whose friends send a link every visit day never ran town 2.

Everything else goes ahead as suggested, and we learn from play. Four of these suggestions go beyond what you said, so tell us if you disagree: missions fill the same harvest as ordinary jobs (no flat 35 cred); badges pay no cred; cred, the board and the missions appear only when the caretaker is first offered, after about an hour of play; and we assume no store release.

### 12. Where the numbers come from, what was checked, and what was not applied

**Files** (all in the session's scratchpad, not in the repo: /tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/r3/final/):
- **The model:** model/f-designs.mjs (preset `final3`), model/f-variant.mjs (art options `venueReserve` and `artNoNeeds`), model/f-run.mjs and model/f-short.mjs. These are copies of the combined model with the critics' options; the plan's simulator econ-final.mjs is read only.
- **Runs:** model/run-final.sh; raw results in model/out/final.json, final-s456.json, final-noart.json and model/out/sw/*.json; 3-minute visitors in model/out/short-365.txt.
- **Tables:** model/f-tables.mjs writes model/out/tables.txt, the source of the modelled numbers here. The few it does not print (the gaps by start, the wage's share of rent, the row without the town bonus) are worked out from the raw results by the scripts in r3/check/ (pt.mjs and fix/).
- **The kind rule:** kind/kind-final.mjs writes kind/kind-final.txt; kind/near-check.mjs checks the city starts' nearest villages.
- **The pieces this builds on:** r3/harvest, r3/wage, r3/missions, r3/otherkind, r3/art, r3/model (the combined model) and the critics' r3/crit-rules and r3/crit-numbers. Measured success rates and the map counts come from the missions, art and other-kind pieces.

**Checked:**
- The final copies reproduce the combined model's recommended run exactly (model/out/chk-c9.json against r3/model/out/c9-art.json).
- Round 2 reproduces 79 / 33 / 17.
- Seeds 4-6 agree within 3 visit days (town 1's team within 2).
- 0 stalled or unpaid visit days in all 504 runs of the main files.
- The code facts: dayOf (src/game/homes.ts:371-375), the rent check (src/homesUi.ts:613-614), the scoreboard (src/scores.ts:1-3), and the lines to rename (index.html:51, src/main.ts:334 and 668-669, src/homesUi.ts:477).
- The forged-link cred is worked out from the step rule (a link of 5 legs is 250 points).

**Critics' findings applied:** all "must" findings, and these "should" and "nice" findings:
- one figure per job card (after the check: what the job adds right now, or no number);
- plain text for answers 4 and 8;
- at most 6 questions;
- "the buyer" (after the check: in the undercover job only);
- the PEGI rewrite;
- the board by the game's own day;
- art with pass or fail and the dent rule only;
- the screen-reader rename;
- money as days of rent split by village and city;
- a run's short first leg counts only with its second (first applied as "only finished runs count"; changed after the check);
- the town step's three rows;
- the race win once a visit day;
- the 20-day reserve on venues;
- no kind from buildings alone;
- the kind word only after town 1;
- one median;
- "an evening of lights";
- the badge renames;
- the hours for heavy players;
- "365 days of play" in place of "a year";
- no badge for losing the police with all four red shields lit: an earlier draft had one, but it copied a famous game's achievement and rewarded ramming patrol cars. "7 clean days" stands in its place.

**Not applied as written, and why:**
- **"Drop the per-kind bonus."** Kept as one rule (a slot's first job of the day counts like 2 more when its alarm is on). The critic's own rerun still carried the old bonus: merging an empty set of bonuses kept the old ones (reproduced in model/out/chk-cut500b.json). Without any bonus, outlaw-only casual players come 6 visit days after law-only ones (86 against 80).
- **The suburb test for a town's kind.** On its own it called the mountain village Shirakawa-go a city, so here it counts only within 25 km of a largest-city label. The price: Ushuaia comes out as a village (section 7).
- **Art "only with 5 free minutes" and regular players hosting every 5th day.** Replaced by the quiet-town rule. With the 5-minute rule casual players still ran town 3 on 267 instead of 230 (model/out/try/v2-alarm-500.json). With the quiet-town rule and the 20-day reserve the friends'-link regular player runs town 2 on 84 (86 without art).
- **"Measure job times before tuning."** Not done in this round, because it needs the game and about half a day. It is the first line of the build, and section 9 shows what moves.

**Open after the check** (each is also named where its rule stands):
- **Setting the clock forward** still brings a day's rent and a first mission each time. Nothing offline stops it.
- **A hand-made friend's link** at exactly the minimum lengths passes the check and can be played again and again: 3 deliveries for 840 m of road. One way: friends' links add to the harvest for one link a visit day (not modelled; the model lets a 60-minute player race 2 a day).
- **Does an art event or a collection piece need its venue?** In the model they go on without it (section 8).
- **Two smaller ones:** on the undercover day a law-only player who skips the chase earns nothing from the law slot (section 6), and round 2's cred for venues and battles is not decided (section 10).

**Checked after the write-up (20 November):**
- **What was checked:** every number against the model's raw results (the 14 run files were run again and came out identical); every claim about the game's code, in the code and in the running game; the rules against your nine answers and the standing rules; the outside facts (Apple's page, the map's labels, one badge name); and the new rules for holes. The checkers' notes and scripts are in r3/check/.
- **Corrected:**
  - The caretaker's offer comes after about an hour of play, not 20 minutes. Until then no cred, no board and no mission is on screen.
  - The alarm's +100 comes once a visit day with a slot's first job (the text read as every alarm job), and the race is never today's first mission. Both now read as the model pays.
  - A run's legs count as delivered, the first one with the second. Before, only finished runs counted, so runs like the 42 of 55 that were not finished would have added nothing.
  - The quiet-town rule for art is the rule that was modelled: chores do not block art. The collection opens once two towns run.
  - The town bonus is named as our addition against your words, and question 3 has the row without it.
  - Round 2's player without missions: hiring all but stopped (the text said "no more staff came"). The $500 wage moves middle values by up to 2 visit days (the text said "no hire").
  - Badge 10 has a new name (a famous game uses "Not a scratch"). "7 clean days" says what an offence is, and 5-minute players need 5-8 weeks for it, not a month.
  - "The buyer" stays in the undercover job only, so taken cars still join "Your cars" as in round 2.
  - Ushuaia, a city of about 80,000 people, comes out as a village; Takayama is rightly a city. The pilot waiver was tested to 1,200 km, not 1,500.
  - A store build: free play has the same content as the car jobs, so switching off the outlaw slot would not lower Apple's rating.
  - The inside job counts the same whether a patrol sees it or not. As first written it counted 100 points more when seen. The tables were modelled before this change: outlaw-only casual players get town 1's team on 79 instead of 76, and nothing else moves by more than 2 visit days.
  - Job cards cannot show one fixed number; the save must hold the day's marks; the renames are not made yet, and two documents were added to their list.
- **Could not be checked:** PEGI's own wording and the official text of the German law (the sites could not be opened; read through search results only); how Apple or PEGI would rate the game in practice; mission success rates and job times in the running game (taken from the pieces, not measured again); the time 100 forged links take and the time of a minimum-length link (estimates); trademark registers for the names.
