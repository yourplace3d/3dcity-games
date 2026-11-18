# Plan: give each city its own character, and keep the game fast (3DA, 18 Nov 2026)

## How I measured
All scripts and outputs are in /tmp/claude-0/-home-user/19d968bc-3916-40c7-b8c9-654318434293/scratchpad/.

- **`probe-character.mjs` → `character.jsonl`.** Ran the built game at 127.0.0.1:4180 (branch `claude/tenants`) in headless Chromium with software rendering, on 20 squares. For each square it records:
  - fuel, fire and police stations and banks, real and made up;
  - stops;
  - the share of the square that is water (on a 25 m grid);
  - how steep the streets cars use are (grade over 60 m, sampled every 10 m);
  - how far a home's drop-off is from its building, using the game's own rule (a street at the door within 60 m, otherwise a main road within 200 m);
  - how long the square takes to build again with drawing off and the map already cached;
  - each building's price as seen from the square to the east. Buildings are matched by map number plus position within 4 m.
- **`dump-worth.mjs` → `worth/*.json`, then `price-rule.mjs`.** Recomputes the "worth" score that `findLots` uses, inside the page, for 17 squares and their east neighbours. Its ranking matches the game's own prices (Spearman 0.995). The new price rule was then tried offline on these lots.
- **`probe-marks.mjs`.** Adds N roof marks through `World.mark`, reads draw calls from `renderer.info`, and averages 12 renders with `gl.finish`, camera over the town. This is headless software rendering, so compare rows with each other, not the milliseconds themselves.
- **`scale-homes.mjs`.** Copies of `homesIn`, the `syncSpecial` loop, and `packHomes` plus tenants, run in Node 22 on the 2,412 Nuremberg lots.
- **`days-to-tier.mjs`.** An estimate, not a measurement.

## What the measurements show
1. **The same building has a different price depending on which square is loaded.**
   - When the next square loads, 11–69% of the buildings the two squares share change price by more than 25%. Examples: London 17%, Paris 30%, Manhattan 65%, Hamburg harbour 69%. The worst single change was ×6, in Zehlendorf.
   - The cause is ranking prices within each square. If the rank is kept and only its inputs are fixed, 7–88% still drift. So the rank itself has to go.
2. **Some squares are missing a kind of station.**
   - Of 20 squares, three lack something:
     - Titisee has no fuel station, no police station and no bank.
     - Central Lisbon has no fuel station.
     - Sydney CBD has no police station.
   - The effects:
     - Moving day (a fuel-station job) cannot be done inside Titisee or central Lisbon.
     - Tenants asking for new locks (a police job) cannot be answered in Titisee or Sydney.
     - A player whose first home is in Titisee has no bank there.
   - Over all 20 squares, the share of stations that are made up is: fuel 56%, fire 44%, police 30%, banks 5%.
3. **The map's building number is not unique.**
   - Freiburg has 2,081 lots but only 70 numbers, and one number is shared by 1,086 buildings.
   - Pottenstein has 424 lots and 5 numbers; Titisee has 76 lots and 3 numbers.
   - Only Manhattan comes close to one number per building (942 lots, 443 numbers).
   - So the price wobble, worn-down picks, staff and goals must be keyed on position, not on this number.
4. **In old towns, drop-off rings sit far from the building.** Share of lots whose ring is more than 50 m away:

   | Place | More than 50 m away | 90th percentile |
   |---|---|---|
   | Istanbul (Eminönü) | 34% | 144 m |
   | Freiburg | 14% | – |
   | Nuremberg | 10% | – |
   | London | 8% | – |
   | Elsewhere | 6% or less | – |

5. **The map already gives places their own character.**
   - Trams in 8 of 20 squares: Lisbon 51 stops, San Francisco 47, Freiburg 34, Amsterdam 30.
   - Subway entrances in 14 of 20.
   - Water covers at least 5% of the square in 10 of 20: Istanbul 36%, Hamburg harbour 24%, Hamburg centre 18%.
   - Grade of 6% or more on over 10% of the street length in 9 of 20: Hong Kong 44%, Lisbon 23%, Pottenstein 23%, Sydney 19%, San Francisco 15%.
   - Venice centre does not start at all: the game reports "no roads here".
6. **Things that slow down as a player owns more.**
   - Each roof mark is its own mesh:

     | Marks | Draw calls | Render time (headless) |
     |---|---|---|
     | 0 | 1,285 | 3.9 ms |
     | 500 | 2,127 | 18 ms |
     | 2,400 | 4,045 | 49.8 ms |

   - `remark()` rebuilds every mark in the square after each rent collection, upgrade or answered ask. That costs about 25 µs a mark, roughly 60 ms at 2,400 marks.
   - `homesIn` checks every home against every lot. At 2,600 homes it takes 190 ms on each square entry (Node on a desktop CPU).
   - `syncSpecial` stays cheap: 1 ms even with 2,400 homes in one square.
   - **Online saves fill up about twice as fast as the brief assumes.** A home takes about 100 characters of the online save once tenants are included. The 120,000-character limit is reached at about 1,150–1,200 homes, not the ~2,600 the brief estimates.
7. **Load time.**
   - Building a square again took 0.42 s (Titisee) to 1.54 s (Tokyo) in the headless test browser with drawing off.
   - From opening the page to the play screen took 1.7–3.3 s through this machine's proxy.
   - There is no real-device number yet.

## A. Give each city and square its own character

### A1. Price from where the building stands, plus worn-down flats
**For the player:**
- Each city has its own price level.
- A building costs the same whichever square is loaded.
- The first flat stays in reach everywhere.

**The rule I tried:**
- One flat = $569 × e^(0.8 × worth) ±8%. The same curve applies everywhere and nothing is ranked within the square.
- Worth is today's score with these changes:
  - Density is measured only over the part of the 400 m window that lies inside the square, so it no longer dips near the square's edge.
  - Each famous sight (the hand-picked list) adds 0.25, counted within 500 m even when the sight lies outside the square.
  - A town's own public places no longer raise prices.
  - Each storey of the neighbourhood above 2 adds 0.11, up to 10 storeys.
- **Worn-down buildings keep the first flat in reach.** 3% of the buildings of flats are worn down, picked by position. A flat there costs at most $900 and pays rent once repaired, as in the first-home arc. The whole building costs the normal price, so a cheap 400-flat tower is not possible.

**Results (offline, on the dumped lots).** Today the cheapest flat is $620–720 everywhere and the median is $1,000–1,900. With the new rule:

| Place | Cheapest flat | Median flat | Dearest flat | 10 best addresses | Best address (max $2M) | Changes >25% when next square loads (today → new) |
|---|---|---|---|---|---|---|
| Titisee | $650 | $720 | $1,100 | $25k | – | 46% → 0% |
| Pottenstein | $580 | $910 | $1,600 | $48k | 4 flats, $6,400 | 56% → 0% |
| Rothenburg | $680 | $1,600 | $2,900 | $449k | 63 flats, $61k | 64% → 2% |
| Zehlendorf | $720 | $1,200 | $2,000 | $1.4M | 74 flats, $99k | 64% → 9% |
| Freiburg | $780 | $2,000 | $4,500 | $2.7M | 165 flats, $359k | 67% → 2% |
| Tokyo Shinjuku | $830 | $2,100 | $5,600 | $13.9M | 313 flats, $1.6M | 35% → 2% |
| Nuremberg | $820 | $2,300 | $4,300 | $7.5M | 118 flats, $462k | 64% → 1% |
| London | $830 | $2,400 | $5,100 | $10.4M | 400 flats, $1.6M | 17% → 4% |
| Hamburg | $830 | $3,100 | $6,100 | $13.1M | 390 flats, $1.6M | 52% → 2% |
| Paris | $830 | $3,300 | $6,400 | $13.2M | 400 flats, $1.9M | 30% → 6% |
| Sydney | $830 | $4,400 | $9,000 | $23.3M | 368 flats, $2.0M | 61% → 5% |
| Manhattan | $830 | $5,300 | $11,000 | $29.4M | 400 flats, $2.0M | 65% → 4% |

- The whole square is worth $118k in Titisee and $287M in Manhattan.
- The gap between cheapest and dearest flat widens from 3.5–4.6× everywhere today to 1.7× in Titisee and 13× in Manhattan.

**Cost (about 1.5 days):**
- `homes.ts` `findLots`: about 70 lines.
- `world.ts`: famous sights with a 500 m margin, about 10 lines.
- The first-home arc picks the nearest worn-down building instead of a cluster of the cheapest flats (`renovation.ts` / `homesUi.ts`): about 20 lines.
- Tests: about 40 lines.
- The constants P0, K and the storey term are for tuning.

**Owner decisions:**
- This changes "ranked within each square".
- Under today's ceiling ($1M cash plus $1M bank), some buildings could never be bought: 25 in Manhattan, 8 in Sydney, 6 in San Francisco, and 1 each in Berlin, Hamburg, Hong Kong and Tokyo. Either cap one building at $2M, or raise the bank ceiling by $1M for each city run by staff.

### A2. Housekeepers (the owner's request)
**How much work homes take by hand (estimate):**
- Tenants ask on half the days the player comes back (`ASK_CHANCE` 0.5), and a station job takes about 2–3 minutes.
- Collecting rent, including the drive, takes about 0.5–1 minute.
- That is about 2 minutes per home per visit day: 6 homes take about 12 minutes, 60 homes about 120.
- Real visits: 87% are under 5 minutes, 13% are 5–20 minutes. A keen player can handle about 5–10 homes.

**Design:**
- A housekeeper can be hired from the 8th home.
- Each looks after 10 homes in one city where the player has a bank (today's home plate, the 25 km around the first home):
  - answers their tenants' requests each day the player returns, so stars stay at 3 and there is no tip;
  - pays their rent into the bank, where it is safe from fines.
- Wage: 10% of that rent (estimate).
- The player still gets tips for answering other tenants' requests themselves.

**Three housekeepers run a full square:**
- Three housekeepers look after 30 homes, which I take to mean a square's 30 best addresses.
- That is 7% (Rothenburg) to 53% (Titisee, Hong Kong) of a square's value, costing $63k in Titisee and $72.5M in Manhattan.
- Old towns made of many small buildings would need 6–19 housekeepers to own a quarter of their value. So the goal is counted in addresses, not as a share of value.

**Cost (about 2 days):**
- New `src/game/staff.ts`: about 100 lines.
- `tenants.ts` `newDay`: about 30 lines.
- `homesUi` hire button and HUD: about 80 lines.
- Save key: about 20 lines.
- Tests: about 40 lines.

### A3. Best address, 10 best addresses, and a city card
**For the player:**
- Each square has a goal: its best address, meaning the dearest building within 400 m of its famous sight (or its middle) that costs at most $2M. It is marked on the minimap.
- Owning the 10 best addresses makes the square "yours".
- A card on arrival describes the place. Example for Nuremberg: old town, castle, 13 tram stops, 41 subway entrances; flats from $820 (worn down), most $1,700–3,300; best address 118 flats on 4 floors for $462k; 10 best addresses $7.5M.

**Cost (about 1 day):** new `src/game/cityCard.ts` about 120 lines, `homesUi`/`main` about 40, minimap about 15.

### A4. Climb pay in hill towns
- Each job pays extra per metre climbed along its route, for example $4 a metre (estimate). The route already returns its points, and `groundY` gives the height.
- Matters in the 9 of 20 squares with steep streets.
- Cost: about 25 lines in `game.ts`, 2–3 hours.

### A5. Open jobs pay by the square's price level
- Pay is multiplied by √(median flat ÷ $1,400), kept between 0.75 and 2. That gives about 0.75 in Titisee, 1.28 in Nuremberg, 1.54 in Paris and 1.95 in Manhattan.
- Runs of three stay unchanged, so challenge links still compare.
- Cost: about 15 lines. It depends on the money plan.

### A6. The last bit on foot in old towns
- Where the ring would be more than 40 m from the door, the ring goes to the door and the clock allows for walking.
- This fixes the 34% / 14% / 10% cases above.
- Cost: about 100 lines in `game.ts` plus a test, about 1 day.

### A7. Plates and pilots
"Plate" is the code's name for a city where the player has a bank; today there is only one, the home plate.

**Never gated by travel:**
- playing any city;
- jobs;
- runs and challenges;
- buying with the cash the player carries;
- the first flat.

**Gated by travel:**
- A bank and staff work only in a plate.
- The next plate opens once the current one is run: its best address is owned and every home in it is looked after.
- A plate on another continent also needs a pilot: hired once for about $100k (estimate), and each flight costs 2% of the savings moved, at least $5k (estimate).
- Continents are rough boxes, like the left-hand-traffic list.

**Cost (about 2 days, after A2):** `bank.ts` about 100 lines, `homesUi` about 60, continent boxes about 20, flight card about 40, tests about 40.

### A8. Harbour runs
- Deliveries from the fuel station to quay decks in the 10 waterside squares. The decks exist in `docks.ts` but are not kept on `World`.
- Cost: about 45 lines, half a day.

### A9. Local paint colours
- Add the square's own recorded colours as extra paint options.
- Cost: about 30 lines, 2 hours.

### A10. Beat the tram
- A rush job whose clock is the tram's arrival at its next stop, in the 8 tram squares.
- Cost: about 120 lines in `cars.ts` and `game.ts`, 1.5 days.

### A11. Local data, prepared offline
- **Which cities have data:**
  - 8 German cities: Zensus 2022 rent per m², 100 m grid, 9 MB download, licence dl-de/by-2-0.
  - Amsterdam: CBS home values per neighbourhood, CC BY 4.0.
  - 8 US cities: ACS median home value.
  - That is 17 of the 60 built-in cities.
- **What it would feed:** prices only, never police behaviour.
- **Timetables (GTFS):** one city's file unpacks to hundreds of MB (Hamburg: stop times 148 MB, shapes 122 MB), so they must be prepared offline, never in the player's browser.
- Cost: a `tools/` script of about 200 lines, a few KB of data per city, about 20 lines in `homes.ts`, credits. 4–5 days plus licence checks.

## B. Optimise

- **B1. Every square gets each kind of station and a bank.** After placing stations, if a kind is missing, put a made-up one at a fixed spot in the square, beside the nearest main road. Fixes Titisee, Lisbon and Sydney. Cost: about 30 lines in `world.ts`/`services.ts` plus a test, half a day.
- **B2. The same price from every square.** Comes with A1. Without it, 11–69% of shared buildings change price by more than 25% when the next square loads.
- **B3. Key on position, not the map number.** Covers price wobble, worn-down picks, staff and goals. About 1 hour.
- **B4. `homesIn` skips far homes.** Skip homes more than 1.2 km from the square's middle and use a 50 m grid of lots. This should bring 190 ms down to under 5 ms (estimate). Cost: about 40 lines, 2 hours.
- **B5. Roof marks as one instanced mesh per symbol.** About 5 draw calls instead of one per home, and update only the marks that changed instead of rebuilding all of them. Cost: `world.ts` about 90 lines, `homesUi` about 30, 1 day.
- **B6. A smaller save format.** Fold tenants into each home's row and store positions as offsets within the square. About 45–55 characters a home, so about 2,200–2,600 homes fit (estimate). Cost: about 160 lines including reading old saves, 1 day. Needed before anyone reaches about 1,200 homes.
- **B7. Old-town drop-offs.** This is A6.
- **B8. Measure on a real device.** A `?try=timing` note showing `World.load` time on the owner's iPad. 1 hour.
- **B9. Places with no roads (Venice).** At least a clear message; play on foot would take 2–3 days. Later.

## Ranking (value for the player against cost)

**A.**
1. A1 price from where the building stands (high value, 1.5 days)
2. A2 housekeepers (high, 2 days)
3. A3 best address and city card (high, 1 day)
4. A4 climb pay (medium, 2–3 hours)
5. A5 job pay by price level (medium, under an hour; needs the money plan)
6. A6 last bit on foot (medium, 1 day)
7. A7 plates and pilots (high later, 2 days, after A2)
8. A8 harbour runs (low to medium, half a day)
9. A9 local paint (low, 2 hours)
10. A10 beat the tram (medium, 1.5 days)
11. A11 local data (medium in 17 cities, 4–5 days)

**B.**
1. B1 stations and a bank in every square
2. B2 same price from every square (with A1)
3. B3 position keys
4. B4 `homesIn` skips far homes
5. B5 instanced roof marks
6. B6 smaller save format
7. B7 old-town drop-offs (A6)
8. B8 timing on a real device
9. B9 places with no roads

## Progression this gives (estimate)
Assumptions: today's rent of 24% of the price per day the player comes back, jobs earning $2,500 a day, rent at 75% of full. Days of visits to own a square's 30 best addresses:

| Place | Days |
|---|---|
| Titisee (village) | ~10 |
| Pottenstein (small town) | 14 |
| Rothenburg (old town) | 26 |
| Zehlendorf (suburb) | 31 |
| Nuremberg (city) | 42 |
| Paris | 46 |
| Manhattan | 71 |

Across other assumptions the range is 9–17 days for the village and 63–85 days for Manhattan.

Under A1, a home in a dear city pays much more rent per home: the median whole building pays about $384 a day in Titisee, $5,300 in Nuremberg and $22,000 in Manhattan, for the same amount of work. That pulls players towards dear cities on its own.

## The 5 I would build first
1. **B1 – stations and a bank in every square** (half a day). Moving day currently cannot be done in Titisee or central Lisbon.
2. **A1 with B2 and B3 – price from where the building stands, worn-down flats, position keys** (1.5 days). Each city gets its own prices, and the price jumps between squares stop.
3. **A2 – housekeepers** (2 days). The owner's request: 60 homes become playable, and three housekeepers run a square's 30 best addresses.
4. **A3 – best address, 10 best addresses, city card** (1 day). Each square gets a goal and visibly its own character.
5. **B4 with B5 – `homesIn` skips far homes, instanced roof marks** (1 day). Should be in place before a tester with the rich build (which starts with $1M) owns hundreds of homes in one square.

A4 (climb pay) is the cheap next one.
