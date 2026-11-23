# Handoff: a third currency for 3DA? Research and results

Written 21 November 2026 for the owner, and for whoever takes the economy plan further: a Claude Code session or a
person who has not seen this session. It answers the owner's question whether the game should get a third currency
beside money and street cred, by comparing it with mobile endless games. It changes nothing in the game. Street
cred, missions and the harvest are planned, not built, and round 3 of the plan still waits for the owner's answers.

Read `README.md` and `HANDOFF.md` first for what the game is. The full research is in
`docs/research-third-currency.md`; "research, section 5" below points into that file.

## 1. The short answer

Big endless phone games that are run for years with a shop show three to twelve counters; small, finished or paid
ones run on none, one or two. Their third currency is mostly there to sell something or to call the player back
on a clock (our reading). This game sells nothing and has no timers, so those jobs do not exist here; and where makers took
the payments out of a game, the scarce currency mostly stayed as "what only play gives", which is the job street
cred already has. The game's own problem is the other way round: too much money and too little to buy.
**Recommendation: no third currency now.** Keep money and street cred, settle five open points (section 9), give
money more to buy, and ask again when the play counts say so (section 8). The three judges agree on this. They
disagree on details: whether the pilot is paid with money or with cred, whether it asks for both kinds of town,
whether a friend's race may stand in for the day's first mission, and how many needs the Touring Gala keeps.

## 2. What was asked and what was done

The owner, 20 November: "There is also the possibility of even a third currency. Compare it with games from this
genre mobile endless games. Do a research on that then write a handoff with the results"

- **Research in five fields** (20 November), each gone over by a checker (21 November): endless runners, driving
  games, idle and builder games, games that sell nothing, and design writing with rules and age ratings.
- **A map of the game's own economy** from the plan and the code ("the inside view"): what the plan already
  counts, twelve open jobs, thirty ideas rejected before, sixteen places where the documents contradict each other.
- **Five designs,** each written out in full by its own designer, and **three judges** who ranked them and checked
  their facts: one in the owner's seat, one economist, one player with short visits.

**The limits, plainly.** No web page could be opened: the session's network refuses almost every site. The search
tool's short texts about pages were the only source, and no quote was compared with its page (one exception: two
Apple developer pages). Mostly because of a cap of 200 web searches, about 40% of the single claims stayed
unchecked or unconfirmed (103 of 272). So every fact about another game carries a mark. **check:** the checker
searched for it and found it; even this means only "a search text about a page says so". **search:** only the first
researcher read it in a search result. **memory:** known, but no source was found. **our reading:** a conclusion,
not a fact about a game. Numbers about this game are **modelled** (worked out with the plan's simulator, never
measured in the game) or marked **estimate**. The play counts of 17 to 19 November and the count of readings on the screen
are counted, not modelled. Three numbers such as 76 / 32 / 15 are visit days for a player of 5 minutes on 5 days
a week / 15 minutes daily / 60 minutes daily.

**Words.** A **wallet** is a currency you save up and spend. A **meter** is a bar that fills while you play and then
pays out something else. A **standing** is a number that only goes up and opens things, like a rank; it is never
spent. A **live service** game is run for years with a shop and a calendar of events. The **sold currency** is the
scarce one a free game sells for real money.

## 3. What the games do

Eighteen games an owner would recognise or that matter most here. Facts and marks are those of research, section
2, where each has its sources. Currency names are the games' own words.

| Game | First | Second | Third and beyond | The job of the third | Sold for real money? | Mark |
|---|---|---|---|---|---|---|
| Temple Run (2011), runner | coins | none | none | No third. The second chance after a crash was bought with coins. | Coins: yes | check; the second chance: search |
| Temple Run 2 (2013), runner | coins | gems | - | Gems pay for carrying on after a crash: 1 gem, then double each time in the same run. | Coins and gems: yes | check; sold: search |
| Subway Surfers (2012), runner | coins | keys (2013) | From 2020 season tokens (a meter), from 2021 event coins; character and board tokens. | Keys: carry on after a crash, and outfits. Event coins: a season's own money. | Keys: yes | check, corrected: the 2021 to about 2025 state; what players see today was not established; keys sold: search and memory |
| Crossy Road (2014), endless hopper | coins | none | none | No third. 100 coins buy one pull for a random mascot. | Coins: yes | check |
| Super Mario Run (2016), runner with a kingdom | coins | Toads (a head count of people) | Rally Tickets | Buildings need Toads in set colours, then coins. Tickets are the entry to the rally where Toads are won. | One purchase opens the game; no currency sold (memory, sure) | check (the checkers' own find) |
| Hill Climb Racing (2012), driving | coins | gems, since December 2016 | none | No third. Gems came after four years, together with the "Garage" they unlock. | Gems: yes | check |
| Hill Climb Racing 2 (2016), driving, live service | coins | gems | scrap; event and team tickets; team credits; adventure tokens; vehicle blueprints; three ranks | Team credits belong to the team shop. Adventure tokens buy only maps. Blueprints slow down single vehicles. Ranks open vehicles. | Gems: yes. Adventure tokens: in the shop since version 1.65.2. | check, corrected; coins and gems: search |
| Smashy Road: Wanted (2015), police chase | cash | none | none | No third. 100 cash buy one spin for a random car. | Cars are sold directly (search) | check |
| #DRIVE (2019), endless driving | caps | postcards | treats (one kind per map) | Each wallet buys one kind of thing: caps buy cars, paint and upgrades; postcards buy only maps; treats unlock police cars. | Caps and postcards: yes | check, corrected |
| CSR Racing 2 (2016), street racer, live service | cash | gold | fuel; three kinds of keys; elite tokens; crew tokens; a paid pass | Fuel is energy. Each key opens its own kind of crate (a lottery). Elite tokens came with one feature. | Gold: yes. Keys: yes (search). | check, corrected; fuel: search |
| Real Racing 3 (2013), racer, live service | R$ | gold | M$ (2019) | Its own money for one group of cars. The maker's reason: new and old players start that part "on equal footing". | Gold: yes. M$: not found. | check; R$ and gold: search |
| Grand Theft Auto on phones (ports), crime driving | cash | none | No further wallet. A police level (a meter you want low) and, in one game, a standing with people. | - | Nothing sold inside (found for two ports; memory for the third) | check for "no purchases"; the rest: search and memory |
| AdVenture Capitalist, idle | cash, one kind per planet | Angel Investors | gold; Mega Bucks | Angels are the pay for starting a planet again. Mega Bucks work across planets. | Gold: yes | check |
| Cookie Clicker (browser), idle | cookies | heavenly chips | sugar lumps | Chips are the pay for starting again. Sugar lumps come about one per real day and not faster by playing more (both: search); they open side games. | The browser game sells nothing (memory) | check |
| SimCity BuildIt, city builder, live service | Simoleons | SimCash | Golden Keys; Platinum Keys; one money per region; War Simoleons; more | Keys buy showpiece buildings. Regional money "can only be spent in the Region they were earned in". War Simoleons belong to one mode. | SimCash: yes. Golden Keys can be bought with SimCash; Platinum Keys cannot. | check |
| Pocket City 2 (2023), city builder | money | XP and level (never spent) | research points | Found by walking into your own buildings; they buy perks. | Nothing (search) | check |
| Animal Crossing: Pocket Camp Complete (December 2024), paid once | Bells | Leaf Tokens (from play only; they replaced the sold Leaf Tickets) | Complete Tickets (about six a month) | A slow ticket that buys any item from the old catalogue. | Nothing | check |
| Need for Speed Heat (2019), console racer | Bank | Rep | none | No third. Rep from night races opens what Bank may buy. | "No currency sold at launch": memory | check |

What the table shows:
- **Many counters go with a shop.** In the researchers' own samples of famous games, 16 of 24 runners launched with
  two currencies or fewer (11 to 14 today) and 14 of 29 driving games have two or fewer; every driving game with
  five or more sells currency. These are counts over hand-picked games, not a share of the market.
- **The second currency is nearly always the one that is sold.** Cred is not. Its nearest relatives are Leaf Tokens
  (check), Toads and Rep (that those two games sell no currency is memory).
- **A new currency mostly arrives with a feature that only it buys** (gems with the Garage, M$ with one group of
  cars). Some were taken out again (Pac-Man 256's credits in 2016; check), but a move to fewer is not shown.

## 4. What a third currency is for

Sorted as in research, section 3: **A** is mostly there to sell something or to set a clock, **B** works without a
shop, **C** is not a wallet. The sorting is the researchers' reading; the check agrees clearly for A1, A3 and A5.

| | Job | Example (mark) | Anything to do in this game? |
|---|---|---|---|
| A1 | Energy: limits how often you may play; the refill is sold | Spider-Man Unlimited (check) | No. Timers are forbidden. |
| A2 | A second chance after a crash, at a price that rises within one run | Temple Run 2: 1 gem, then double (check) | No. A failed try costs nothing; the fine is the cost. |
| A3 | A lottery token that opens a random prize | CSR Racing 2's keys (check) | No. With nothing to sell only the look of gambling is left, and that can raise an age rating without any money (research, section 7). |
| A4 | Parts for one car or character | Hill Climb Racing 2's blueprints (check) | Weak. One counter per car does not fit a small save; the plan counts cars as things. |
| A5 | Recycling doubles from a lottery | Asphalt 9's trade coins (check) | No. The game has no random doubles. |
| A6 | A season or event token that runs out | Subway Surfers' event coins, 2021 to about 2025 (check) | No. It breaks "nothing is lost for missing a day". |
| B7 | Pay for starting again | Angel Investors, heavenly chips (check) | The game resets nothing. Nearest: round 3's open suggestion that each town that runs makes cred come faster. |
| B8 | Money tied to one place, so a new place starts from zero | AdVenture Capitalist per planet, SimCity BuildIt per region (check) | Cred already does this: every new town's team costs cred again and money cannot buy it (our reading). |
| B9 | Money for one mode only | Real Racing 3's M$ (check) | Only if a mode comes whose prizes neither money nor cred should buy. The owner gave friends' races and the arena to cred. |
| B10 | A wallet for "where you may go" | #DRIVE's postcards buy only maps; the game also sells them (check) | The pilot is this kind of purchase, but it is bought at most five times in a whole game. |
| B11 | A currency only play can earn, for special things | SimCity BuildIt's Platinum Keys, Pocket Camp Complete's tickets (check) | Cred already is this. A second one needs a deed of its own and things of its own to buy. |
| B12 | A currency paid by the calendar | Cookie Clicker's sugar lumps (search) | It suits short visits and runs against the owner's "it pays off to play". Rent and the day's first mission already pay by the day. |
| B13 | A head count of people | Super Mario Run's Toads (check) | The picture behind cred. The game must never show a count of people. |
| C14 | A standing: a number that only rises and opens things | Need for Speed Heat's Rep level, Pako 3's stars (check) | The plan has such numbers: towns that run, venue stars, badges. |
| C15 | A meter: fills, then pays out something else | Minion Rush's bananas since May 2025 (check) | The harvest is this. |
| C16 | A pickup used inside one run and not saved | - | Not a currency. |

## 5. When nothing is sold

The nearest evidence for the game (research, section 5; what is named here was found by the check's searches).

- **Free games released again without payments** (mostly on subscription services): the scarce currency usually
  stayed and became "what only play gives". Kept in 6 games with a confirmed answer, removed with its shop in 1
  (Disney Dreamlight Valley Arcade Edition). A small sample, and not a fair one.
- **Where the maker did the work, the machinery around the currency went:** the lottery and the energy limit (Mega
  Man X DiVE Offline), the shop and the season track (Dreamlight Valley), a price cut to a tenth (Pocket Camp
  Complete). Where everything was left as it was, reviews were worst (Tomb Raider Reloaded on Netflix, Castlevania:
  Grimoire of Souls, Jetpack Joyride 2).
- **Only one of these games added a third wallet:** Pocket Camp Complete, a slow ticket for its old catalogue.
  One review still calls its progression a grind.
- **Several games built with nothing to sell** pair money with a number that says "you may" (a count over a
  few examples, not a rule): Rep opens what Bank
  buys (Need for Speed Heat); a Respect level opens upgrades (Saints Row: The Third; in Saints Row 2 it was the
  toll on the story, and that was dropped). Vampire Survivors answered a gold pile inside the same currency, with a
  thing to buy that has no limit. Rent that comes in while you are away made money cheap in Fable II and
  Assassin's Creed II; neither added a currency (two games are too few for a rule).
- **What is missing:** what Jetpack Joyride+, Crossy Road+, Sonic Dash+, Temple Run+ and Asphalt 8: Airborne+ did
  with their coins, gems, rings and tokens. Only "no purchases" was confirmed. These free endless games turned into
  subscription versions would be the best evidence for this game, and it could not be found.

**The lesson (our reading):** a game whose second currency is already "what only play gives" stands where those
makers ended up. When they took out the shop they removed machinery and cut prices; only one of them added a wallet (Pocket Camp
Complete's slow ticket).

## 6. The game seen the same way

- **Two wallets.** Money comes from deliveries, runs and rent, and buys homes, repairs, upgrades, shops, later
  venues and art. Street cred comes only from play, signs on the staff who run a town (1,835 for town 1's team, 15%
  more for each later town) and is never taken back.
- **One hidden meter and about ten counted things.** The harvest turns deliveries and missions into +10 cred a
  step. Also counted: cars by kind of town, art pieces, venue stars, tenants' stars, towns that run and their
  kinds, visit days, days of rent (the unit of every price), 15 badges, the gala trophy.
- **The screen and the players.** The driving screen shows 13 readings at the busiest moment of a run today and 16
  after round 3; a third currency would be the 17th. Cred itself shows only after about an hour of play. From 17
  to 19 November, 115 of 132 visits (87%) lasted under 5 minutes, with 12 return visits against 98 new browsers.
- **The surplus is money.** Once staff cost cred, a 15-minute player held $435M on day 180 against $4.7M in the
  plan before (round 2, modelled). Round 3 answers with art priced in days of rent: 23 to 27 days of rent held on
  day 180 with art, 43 to 95 without (modelled). But art is built last (first release about 13 build days, then
  venues 5.5, then art 7; estimates). Without art a 15-minute player spends about 4% of the rent earned in 365
  visit days (the inside view's own tally of the model).
- **Correction on the pilot.** An earlier note in this session said the pilot's price was not decided. It is: the
  larger of $250,000 and 5 days of all rent, doubling for each further continent (`docs/plan-plates-and-staff.md`,
  lines 186-189). What is open: under cred it holds almost nobody back. In every run of round 3's model that
  bought a pilot, it was paid on the very visit day the last town ran (the inside view's tally); in the designs'
  own runs, where the pilot is wanted early, players waited at most about 6 visit days for the money.

The twelve open jobs. The last column is the suggested way to close each without a currency (from the "no third
currency" design, with the judges' changes).

| Job | How it stands in the plan | Would a currency help? | Closed without one by |
|---|---|---|---|
| J1 What a pilot costs | Money, as above | Only a counter for at most five purchases | Question 3 in section 9 |
| J2 What makes a city player's village town worth having | A rule forces it (one of each kind among the first three towns); +100 cred once; "worth little in money" | The one job a third resource was once designed for (round 1's crates) | Cars by kind (question 4), the Touring Gala's art piece from a village town, barn venues, field art. Mostly later, and thin until then. |
| J3 Cred for venues, galas, battles | Round 2's flat amounts still stand beside the harvest | Only a counter | Question 2. A venue's manager signs for cred (150 / 250 / 400) and is never needed for the town's own team. |
| J4 What "Your cars" are paid with | A car comes from a job; no price, no lock-up size | No. Cars already work as things. | A car is never bought. Money buys places for them (question 5). |
| J5 What the Touring Gala needs | Five needs already | Only a sixth need | No sixth need |
| J6 What a second chance costs | Nothing; the fine is the cost | No, and it breaks standing rules | Stays free |
| J7 What art gives back | The thing on the map and 50 harvest points; what a collection piece does is not said | It would rename the gap | A decision with the art build |
| J8 What keeps a player going after several towns | More of the same | Only with new things to do | Not closed. The plan's thinnest part. |
| J9 What a friend's race gives | A checked link counts as its 3 deliveries; less than a mission for more minutes (the inside view's reading) | No. Nobody can check who a friend is. | A decision (section 10, step 2) |
| J10 What money is for before art ships | Almost nothing | No. The missing piece is something to buy. | Question 5. Eased, not closed. |
| J11 A town past 30 homes | Every hire past the sixth (a fourth housekeeper and on) costs money (6, 8, 10 days of rent) | A decision, not a currency | Stays in money, or cred (section 10, step 2) |
| J12 A choice to make with cred | Cred has one use, in a fixed order | No | Comes with venue managers: the next town's team first, or a venue's manager |

## 7. The five candidates

Each was designed to the end by a designer told to make it work. All five ended at "no third wallet now", also the
three asked to build one. Their model runs were made in this session and are not in the repo.

**1. "Money and cred": no third currency.** Nothing new is earned, saved or shown; instead one decision for each
of the twelve open jobs.
- *For:* it costs a short visit nothing. It found a hole: round 2's gala night costs one day of rent and pays a
  flat 40 cred, so money could buy cred (our reading, never modelled). It gives money boxes at the lock-up to buy.
- *Against:* as designed it also moved the pilot (400 cred) and extra housekeepers (435 cred) from money to cred:
  two things less for money to buy, and a 5-minute player's town across the sea runs on visit day 238 instead of
  227 (modelled). The regional job rests on later features.
- *When:* now, as decisions, with the judges' changes: the pilot's fare stays in money (two of three judges; the
  owner's seat wants cred); extra housekeepers stay in money for now (the short-visit player; the economist would
  ask the owner; the owner's seat would sign every person for cred). Two judges asked for at most two new
  questions; section 9 asks five, of which only three need an answer.

**2. Showpieces: something by kind of place.** Not a wallet. A car from a car job or police job keeps the kind of
the town it came from. A country car is a showpiece in a city town, a city car in a country town. Showpieces fill
the plinths of your venues (1 for the third venue step, more for the fourth); no home, hire or town needs one.
- *For:* nearest to the owner's own pictures ("That way the Stolen car still fits in with the art venue"). No
  number on the driving screen. The land sets only a letter, never an amount. The designer tried a token first:
  every version turned into round 1's crates.
- *Against:* it is round 2's own rule written out. After one trip the other kind is never scarce (about 40 cars
  against 3 plinths for a 5-minute player, estimate), so it makes a trip worth while, not the town. It rests on
  venues, whose nights, stars and galas were never modelled, and it shows the words "country" and "city" about
  real places more often than round 3 allows (after a job in any place you visit).
- *When:* later, with the venues (about 1.5 build days on top, estimate). Take the rule, not as a currency.

**3. Pairs: a standing.** A country town and a city town that have both run are a pair; each pair lets the pilot
fly you to one more continent. Never shown as a number; the fare stays in money.
- *For:* no reading on the driving screen, nothing new in the save, about 0.75 build day (estimate). The best
  wording for a pilot who says no: name the missing kind and two places to go.
- *Against:* at the first flight it held nobody in 114 modelled runs. Where it does hold, it costs a whole town: a
  5-minute player who wants a home across the sea as their second town gets it on visit day 150 to 155 instead of
  77 (modelled). From the second continent on it was not modelled. It gives nothing to hold or to choose.
- *When:* with the pilot and the world map (step 8 of the plan's build): only the first-flight condition, as an
  option.

**4. Invitations: a wallet for one feature, the venues.** The only real third wallet of the five. A night you host
yourself pays one invitation, once per town per visit day. A gala night costs 10 and the Touring Gala 30, in place
of the venue stars. Never bought, swapped or lost.
- *For:* a source, things to buy and a pace of its own; and it would arrive with a feature, as in other games.
- *Against:* it turns venues that staff run into a job in every finished town on every visit day, against "run a
  full city tile and leave it to conquer the next one". It is pay by the day. With five towns a player earns 5 a
  visit day against a price of 10 and piles them up (estimate). It removes the gala's price in money. Not modelled.
- *When:* not now; its own designer says the same. If the owner wants a third wallet: with the venues, and with
  the judges' changes (one night per visit day for the player, not per town; the gala's money price kept beside
  it; a night fills the harvest or pays an invitation, not both; venues in the model first; never a guest count).

**5. Luggage tags: a rare ticket.** Each rare badge for a deed brings one tag (11 in all); a tag lets you keep one
home far from your towns, anywhere on earth, and replaces the pilot.
- *For:* a home anywhere on earth fits a game on a real map; met earliest (visit day 26 or later, estimate).
- *Against:* the thing it buys does not exist and would reopen "buying from afar", which the plan closes. A
  60-minute player has 7 of the 11 tags by visit day 66 and no more after that (estimate). Badges would start to pay, which the owner was
  never asked. It is the only design that could shut the sea to a player for good.
- *When:* not. **Keep its test for every later proposal:** if a ticket keeps paying, ask what pays it. Play: then
  it is cred in another colour. The calendar: then it is pay for coming back. Towns: then it is cred already spent.

| Design | Owner's seat | Economist | Short-visit player | Its own designer |
|---|---|---|---|---|
| Money and cred (no third currency) | 1st (8 of 10) | 1st (7.5) | 1st (8) | recommend now |
| Showpieces (by kind of place) | 2nd (6) | 3rd (5) | 2nd (6) | later, with the venues |
| Pairs (a standing) | 3rd (5) | 2nd (6) | 4th (3) | later, with the pilot |
| Invitations (a wallet for the venues) | 4th (4) | 4th (3.5) | 5th (2) | do not recommend |
| Luggage tags (a rare ticket) | 5th (2) | 5th (2) | 3rd (4) | do not recommend |

All three judges said invitations and luggage tags should not be built as designed. None would build pairs as
designed either (one pair for each continent): the owner's seat and the economist keep only a condition at the
first flight, the short-visit player at most a condition from the second continent on. Each judge wanted changes to "Money and cred"; sections 8 to 10 carry them.

## 8. Recommendation

**Do not add a third currency now. Keep money and street cred as the only two.** Why, in plain words:
1. **The reasons other games have mostly do not exist here.** Most of their third currencies sell something or
   set a clock. The ones that do not (section 4, group B) do jobs that cred, a rule or things already do here.
2. **Street cred already has the job that is left:** "what only play gives".
3. **The game has too much money, not too little to earn.** A third currency adds a thing to earn. What is missing
   is things to buy.
4. **Almost nobody would see it.** The earliest of the four designs that add something shows up after 5 to 8 weeks
   of 5-minute visits, the others after about 15 (estimates). Today 87% of visits end within 5 minutes.
5. **It is hard to take out again:** saves are small and there are no accounts. And the owner's own warning stands:
   "might get too complex that s the danger".

What to do instead is in the five questions of section 9: make the owner's rule clean (question 2), meet the
regional wish with the cars already planned (question 4), and give money more to buy early (question 5). Honestly:
the cars make the other kind of place worth a trip, not a lasting need, and nothing found here makes it a lasting
need without bringing back crates under a new name. And mind the start before any currency: 56 of 132 visits ended
within a minute, before any pay.

**What would have to become true for the answer to change,** all together: a built feature with things of its own
that neither money nor cred should buy; play of its own that pays nothing else; money with enough to buy; enough
players who get that far; and one of the ten counted things leaving in exchange.

**Signs to watch in the play counts** (anonymous, as in round 3: a word and a number per day; added with the
build, not before):
1. "Bank above 30 days of own rent" at a visit's first look, once art is live. Many players above it: money needs
   more to buy. That is still not a currency, and it is the first thing to fix.
2. "A job done in a town of the other kind after it runs." Near zero: the cars do not carry the regional wish, and
   a regional flow is worth designing, with venues there to use it.
3. "A venue's manager signed" against "the next town's caretaker signed". If venues always lose, they may need
   pay of their own.
4. "Cred in hand above the next whole team." Cred has run out of people to sign: add people, not a currency.
5. Nights players host themselves, and galas held. Only if galas are held again and again: look at "invitations".
6. How many players a week see the cred tag. While that is a handful, a third currency would be built for nobody.

## 9. Decisions for the owner

Five questions. Each can be answered with yes or no. Questions 1 to 3 need your answer; 4 and 5 go ahead as
suggested unless you say no. (Round 3's six questions also still wait: section 10, step 1.)

1. **Should money and street cred stay the only two currencies for now?**
   Yes (suggested): nothing new to earn, to read or to explain; the question comes back to you when the counts in
   section 8 say so. No: then the one real candidate is "invitations" (one for each night you host yourself at a
   venue, ten for a gala night). It can only be built with the venues, so the first release is the same either way.
2. **Should paying money never bring cred?**
   As round 2 stands, a gala night costs one day of rent and pays a flat 40 cred, so a rich player could buy cred.
   Yes (suggested): a night you host and a gala night add cred only through the three deliveries you drive for
   them; the flat +10 and +40 go; the Touring Gala keeps its 150 cred, once per town. No: the flat amounts stay.
3. **Should the pilot's fare stay in money, as the plan has it?**
   The plan: a flight to another continent costs the larger of $250,000 and 5 days of all your rent, doubling for
   each further continent. Yes (suggested; two of the three judges): nothing changes, and money keeps one of its
   few prices that keep rising. No: the pilot signs on for cred like every other person (400 cred, estimate), so
   your "people will come for your Fame" has no exception; a 5-minute player's town across the sea then runs about 11 visit
   days later (modelled), and money loses a thing to buy.
4. **Is this enough for "something regional": a car from a country town is a showpiece in a city venue, and a city
   car in a country venue?**
   Yes (suggested): it is built with the venues, puts no new number on the driving screen, and the land decides
   only the kind, never how much you get. It makes the other kind of place worth a trip. No: then a regional
   currency is designed together with the venues, and it must first answer why crates were dropped (section 11).
5. **Right after the first release, should the game first get more for money to buy?**
   Yes (suggested): first the list "Your cars" with boxes at the lock-up (the first box free, boxes 2 to 6 for 1
   to 5 days of all your rent; about 1 build day, estimate), then the first three art ideas within about three
   months (the mural, the art delivery, the collection; about 4 build days, estimate). Of these only the art
   delivery and the collection take money (the mural is free), and the collection opens once two towns run (visit
   day 153 / 63 / 30, modelled). Round 3 builds art after the venues and ends the art delivery at a venue, so
   "yes" also needs a decision on whether art needs its venue. No: the order stays venues, then art; until art is live, money has almost nothing to buy (modelled: a 15-minute player holds 43 to 95 days
   of rent on day 180).

## 10. What to do next

In this order, for whoever continues. Nothing here is to be built or deployed without the owner's yes.

1. **Get the owner's answers,** first to round 3's six questions (`docs/brainstorm-second-currency.md`, "Round 3",
   section 11), then to the five in section 9. Round 3's questions set the pace of cred, and every number here
   leans on them: the pace with missions; about 25 hours for a player who never does a mission; whether each town
   that runs makes cred come faster; no wage; whether patrols chase the undercover car; art only in a quiet town.
2. **Settle the smaller missing decisions.** None needs a third currency. Suggested defaults:
   - *The pilot and both kinds of town:* should the pilot fly only for a player who runs a country town and a city
     town? The judges split (economist: yes; player: no; owner's seat: only as an option). Default: no, as the plan
     has it. Never put a cred price and such a condition on the same card.
   - *Housekeepers past the sixth hire:* money as planned (default), or cred (435 in town 1, 15% more each; estimate).
   - *A friend's race:* as round 3 has it (a checked link counts as its 3 deliveries and shares the day's one
     +100). New, from the "no third currency" design: at most one friend's link a visit day counts; round 3 names
     that only as one way to close the hand-made link hole (not modelled). For later, once the link check
     exists: let it stand in for today's first mission (modelled: a 5-minute player with keen friends gets town
     1's team on visit day 79 instead of 111). That reverses a correction of round 3 and needs a cap.
   - *Showpieces:* 1 at the third venue step; 2 or 3 in all at the fourth (the plan says both).
   - *The Touring Gala:* no sixth need. The judges split on the rest: the owner's seat and the short-visit player
     would cut it to three needs with the showpiece rule; the economist keeps "one art piece made in a village town
     and one made in a city town", because it is the only need that takes a town and not just a trip.
   - *Art:* what a collection piece does, and whether an art event needs its venue. *Battles:* cred like a race,
     once a server checks them; no wallet of their own.
3. **Repair the plan documents where they contradict each other.** The inside view found sixteen places. The worst
   five (line numbers as of 21 November; "plan" is `docs/plan-plates-and-staff.md`, "bs" is
   `docs/brainstorm-second-currency.md`):
   - *Shops or venues.* The manager needs "2 shops open" (plan:85, 161-164); round 1 turns the pub and the bar and
     club into those shops (bs:345-347); round 3 builds venues only after the first release (bs:1108). The first
     release needs shops, or the manager cannot be hired.
   - *What a hire costs.* The plan says money (plan:88-96); round 2 says cred only (bs:556-558). The plan's text on
     what money buys (plan:261-271, 387-388) no longer holds and was never redone.
   - *Gala nights and the Touring Gala: paying or paid.* Round 1 says they bring rent (bs:210-211, 392); round 2
     says they cost 1 and 5 days of rent (bs:622-623; round 3 counts them in the venues' 18 days, bs:1014).
   - *How many showpieces.* bs:606 says 1, then two more; the table at bs:620-621 says 1, then 2.
   - *The pay floor* (every delivery pays at least 2% of a day's rent; plan:590-599). The plan adopts it, but it
     was never put to the owner, and rounds 2 and 3 do not mention it.
4. **Measure before believing the model.** How long a job takes was never measured (the model assumes 2.5 minutes;
   it is the first line of round 3's build). Venues are in round 3's model only as one purchase (18 days of rent
   when a town first runs); their nights, stars, managers, galas and cred have never been modelled: put them in
   before any venue number is used. And check "Your cars" by six kinds against the code: `src/game/cars.ts` draws three ordinary car
   bodies (sedan, sport, van) beside the police car, bus, tram and train; round 2 names six kinds, so 1 build day
   may be too little.
5. **Research again once pages can be opened:** above all, what the subscription versions of free endless games did
   with their scarce currency (Jetpack Joyride+, Crossy Road+, Sonic Dash+, Temple Run+, Asphalt 8: Airborne+, Hill
   Climb Racing+). Then: what Subway Surfers players see today; the interview on Subway Surfers Tag as a "first
   game without monetization"; PEGI's own wording on rewards for coming back; the pages behind the facts this
   handoff leans on most (Pocket Camp Complete, Mega Man X DiVE Offline, Dreamlight Valley Arcade Edition, Real
   Racing 3's reason, #DRIVE, Hill Climb Racing 2); and everything marked memory (research, section 10).

## 11. Rules that bind any idea, and how sure this is

**Hard rules.** This document may name real games; the game may never imitate their names, looks or words.
- Nothing is sold: no purchases, no ads, no timers to wait out or skip.
- Cred comes only from play and is never taken back; staff never leave; nothing is lost for missing a day.
- The start is equal in the countryside and in a big city, and it works anywhere on earth, also where little is
  mapped. The land may decide a kind, never how much a player gets. No statement about real places; the police
  behave the same everywhere.
- No count of people, no follower look, no gem or coin look, no level bar, no stars under the cash. Saves stay
  small (a few hundred characters), and wording stays plain.

**Rejected before; do not bring back without answering the reason:**
- Crates by kind of place: "your wine crates wouldn't match the Stealing"; and casual players stalled for good when
  the other kind of town sat on the main path.
- Diamonds: a gem counter reads as "this will be sold for real money". Guests and a tip jar: tips look like money.
- Supply lines, a daily bar, a cap per day, streaks: they work like a come-back-tomorrow timer.
- Swapping one currency for another: it gives cred a price in dollars. A wage in cred: upkeep that short visits
  cannot keep up. Money per town: one more balance to read.

**How sure this is:**
- **Checked** (by search text, not by opening pages): the currency lists of the best-known games in section 3, what
  happened in the versions with nothing sold in section 5, and the rules and ratings in research, section 7.
- **Search only or memory:** about 40% of the single claims. They are marked, and nothing here leans on them alone.
- **Readings, not findings:** the sorting of jobs in section 4, every remark on what a job could do in this game,
  the lesson in section 5, and the whole of sections 7 to 9.
- **This game's numbers** are modelled or estimates. The designs' own runs used a copy of round 3's simulator and
  were checked by the judges, who found slips in every design; this handoff uses the corrected forms. Venues
  (beyond one purchase), invitations and showpieces were never modelled, and how long a job takes in the real
  game was never measured.
- **Checked after writing (23 November):** the facts against the research summary, the plan, the code and the
  model's output; the rules and the owner's words. Corrected: venues are in the model as one purchase; the judges
  disagree on more than the pilot; no judge would build pairs as designed; the cap of one friend's link a day is
  the design's, not round 3's; the game draws three ordinary car bodies, not three kinds in all; Pocket Camp
  Complete did add a wallet; "nearly always" became "mostly"; the art behind question 5 needs two towns and a
  decision on venues.

## 12. Where things are

**In the repository:**
- `HANDOFF-third-currency.md`: this file.
- `docs/research-third-currency.md`: the full research summary with all sources, in ten sections (2 the
  comparison tables, 3 the jobs, 5 nothing sold, 7 rules and ratings, 9 ten candidate families, 10 how sure).
- `docs/brainstorm-second-currency.md`: rounds 1 to 3 of the economy plan. Round 3 starts at "## Round 3"; its
  section 11 holds the six open questions.
- `docs/plan-plates-and-staff.md`: the plan for towns and staff. The pilot is at lines 186-189, the build order
  in its section 8 (lines 466-503; the pilot is step 8, line 498), the owner's decisions in its section 12.
- `HANDOFF.md` and `README.md`: what the game is and what the owner has decided.

**In the session's scratchpad: not in the repo, and it may be gone.** If it is gone, this handoff and the research
summary hold what matters; only the working detail is lost.
- The five designs in full, one folder each: `/tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/c3/design/`
- The three judgements, one folder each: `/tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/c3/judge/`
- The inside view (open jobs, rejected ideas, contradictions, the owner's statements): `/tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/c3/inside/map.md`
- The researchers' notes and the checks, one folder per field: `/tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/c3/`
- Round 3's model and its tables: `/tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/r3/final/model/`
