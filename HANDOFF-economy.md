# Handoff: the economy plan (towns, staff, street cred), where it stands

Written 23 November 2026 for whoever continues the economy plan: a Claude Code session or a person who has not
seen the cloud session that wrote it (19 to 23 November). It says what is decided, what is only suggested, what
waits for the owner, and where everything is. **Nothing of this plan is built. Nothing was deployed.**

Read `README.md` and `HANDOFF.md` first for what the game is and how the owner works. `HANDOFF-third-currency.md`
is a separate handoff for one question: whether there should be a third currency.

## Status, 23 November 2026, later: on the wishlist

The owner, after reading the third-currency handoff: "we'd rather leave the second currency as well for a
little longer on the wishlist and instead should continue with missions and learning how to use bank and
such." So **street cred is on the wishlist too**, like the third currency. Nothing below is wrong, but none
of it is next, and the questions listed as waiting no longer wait: they come back with cred. What is next:
`docs/plan-returning-players.md` on branch `claude/returning-players` (the rent card, a mission to the bank,
reminders, and a brainstorm of missions at the player's homes).

## Right now (23 November 2026)

- **Branch `claude/plan-plates-and-staff`,** pushed. It holds documents only: compared with `claude/tenants`, it
  adds the two plan documents, the brainstorm on the second currency, the research and handoff on a third
  currency, and this file. No game code changed. No pull request; open one only if the owner asks.
- **The branch sits on `claude/tenants`** (tenants, rent waiting at the building, upgrades), which was itself not
  merged when last seen (`HANDOFF.md`, "Right now"). Check both against `main` before any pull request.
- **Waiting for the owner:**
  1. Round 3's six questions (`docs/brainstorm-second-currency.md`, "Round 3", section 11).
  2. The third-currency handoff's questions 1 to 3 (`HANDOFF-third-currency.md`, section 9). Questions 4 and 5
     go ahead as suggested unless the owner says no.
- **Third currency: noted, not answered.** The owner's reply on 23 November was "Noted." Read it as "I have
  read it", not as a yes to the recommendation or to any question. Ask again before acting on it.

## The plan in short

- **A town is a plate,** 25 km across. You play it by hand: deliveries, runs, homes, rent once per visit day.
- **Each town needs a team of six,** hired one by one: caretaker, housekeeper, housekeeper, letting agent,
  housekeeper, manager. With the manager the town runs on its own, and only then may you start a new town:
  more than 25 km from every town you have. Another continent needs a pilot.
- **The start is the same** in the countryside and in a big city.
- **Money buys things:** homes, repairs, upgrades, shops; later venues, places for your cars, art.
- **Street cred signs on people:** the second currency (owner's choice, 19 November). Only play earns it; it is
  never bought and never taken away; staff never leave.
- **Missions** each visit day: a car job (against the law, with a chase) and a police job (for the law), a race
  of the day. Round 3 adds an inside job and an undercover job, once a week each.

## What the owner has decided

In their own words where it matters. Dates are 2026.

- **19 November, plan** (`docs/plan-plates-and-staff.md`, section 12):
  - buy only inside your own towns; a new town only once every town runs;
  - five homes run by hand per town, then the caretaker;
  - "The money he is owed shouldn't be dependent on the money he makes": no wage as a share of rent;
  - trade-up rules: yes;
  - the start must be the same in the countryside and in a big city;
  - 25 km stays for now.
- **19 November, the second currency:** street cred, not crates. "One currency must be more difficult to get. If
  houses can be bought with money then the people you need to manage them need another currency."
- **Who pays cred:** missions and firsts only. "Not every taken car can pay street cred. That s only for
  missions." Firsts are the first car, the first home and the first building painted.
- **No follower look:** "It s not followers for real. Stop this".
- **No buying an advantage:** "Imagine the Fame currency cred as if being in a freemium game but without the win
  to pay factor as no payment exists." Nothing is sold.
- **Learn from play:** "Then we just start with your suggestions and learn on the run."
- **19 November, answers to round 2:**
  - a harvest: "the longer you play the more points you need to get a few cred points";
  - badges as their own feature, and rarer;
  - casual players later than with money: yes;
  - an inside job and undercover work for the police;
  - the second or third town of the other kind (village or city);
  - art: "Let s get Creative about reality";
  - "badge" stays for achievements; the police level becomes "red shields", the station's mark "the police
    shield".
  - On a dollar wage: "they can also come with a wagen in dollars i d say but might get too complex that s the
    danger".
- **Earlier and still in force:** always ask before deploying; balance making money with spending it.

## What is suggested and not decided

- **Round 3** (`docs/brainstorm-second-currency.md`, from "## Round 3"), with six questions for the owner:
  - the harvest replaces round 2's badge ladders and flat mission cred;
  - each town that runs makes cred come faster (against the owner's words, and the owner is asked);
  - no dollar wage;
  - patrols chase you in the undercover job;
  - art only when the town you are building is quiet;
  - cred and missions hidden for the first hour of play;
  - a rule for whether a town is a village or a city.
- **Third currency** (`HANDOFF-third-currency.md`): no third currency now; money never buys cred; the pilot's
  fare stays in money; cars from the other kind of town as showpieces; more for money to buy right after the
  first release.

## Needs the owner's yes before it happens

- **Any deploy** to the live site.
- **Any change to the live server** (Supabase):
  - the `count_play` whitelist for new count words;
  - the README's line on what is counted.

  Never delete data there yourself; give the owner the SQL.
- **The renames** ("red shields", "the police shield") are agreed, but are made with the build, not on their
  own. The places are listed in round 3, section 10.
- **Building any part of the plan.** The first release is about 13 build days (estimate; round 3, section 10).
  It starts with measuring how long a job takes in the game.

## Problems found on the way (not fixed)

- **Edited challenge links pay.** A hand-edited link "finished" a run of 5 in about half a second, paid $750 and
  counted 5 deliveries in today's game. Round 3 plans a link check. It must ship with anything that pays cred.
- **Setting the phone's date back brings another day of rent today** (`src/homesUi.ts:613-614` only asks whether
  the date changed). Round 3 plans "days that only move forward". Setting it forward cannot be stopped offline.
- **A comment in `src/linkCount.ts` (line 11)** says the visit day is "never sent". That holds for the play counts.
  But online saves do carry `3da-visit-day`. Fix the comment.
- **The plan documents contradict each other in sixteen places.** The worst five are in `HANDOFF-third-currency.md`,
  section 10, step 3. The plan's sections 1 to 11 were never rewritten after the owner's decisions and rounds 1
  to 3: where they differ, the newer document wins. The most urgent: the first release needs shops, or the
  manager cannot be hired, yet venues (which round 1 made the shops) come only after it.
- **The model has never been checked against play.** How long a job takes is assumed (2.5 minutes). Venues are in
  it only as one purchase.

## Next steps, in order

1. **Get the owner's answers:** round 3's six questions, then the third-currency questions 1 to 3. Keep them
   short and plain. The owner reads informal, non-native English and answered "Huh?" to a jargon question before.
2. **Write the answers into the documents.** Then rewrite `docs/plan-plates-and-staff.md` sections 1 to 11 so
   that one document says what is planned, and the others are history.
3. **Settle the smaller decisions** listed in `HANDOFF-third-currency.md`, section 10, step 2:
   - the pilot and both kinds of town;
   - hires past the sixth;
   - a friend's race;
   - how many showpieces;
   - the Touring Gala;
   - art.
4. **Build, once the owner says yes,** on a new branch, in round 3's order:
   1. measure job times;
   2. cred and the firsts, the car job and the police job, staff for cred, visit days, the renames;
   3. the harvest;
   4. races with the link check, and days that only move forward;
   5. the weekly missions;
   6. the other-kind rule;
   7. badges.
5. **Learn from play** with the new count words (`docs/brainstorm-second-currency.md`, "The owner's answer", as
   updated in round 3, section 10). Change numbers only as the rules there say: cred already earned is never
   taken back, and each change is a release the owner approves.
6. **Research again once web pages can be opened:** what the subscription versions of free endless games did
   with their scarce currency (`HANDOFF-third-currency.md`, section 10, step 5).

## The documents, in reading order

1. `docs/plan-plates-and-staff.md`: towns and staff, money, pacing.
   - Section 12 holds the owner's decisions.
   - Sections 1 to 11 are partly out of date (see above).
2. `docs/brainstorm-second-currency.md`:
   - round 1 (crates, dropped);
   - round 2 (street cred, the starting point);
   - "The owner's answer" (learn from play);
   - round 3 (the owner's answers, suggested, six questions).
   Each round ends with what was checked.
3. `docs/research-third-currency.md` and `HANDOFF-third-currency.md`: the third-currency question.
4. `docs/plan-cities.md`: each city's own character, and keeping the game fast (18 November).

## The model (in the session's scratchpad: not in the repo, and it may be gone)

Every pacing number in rounds 2 and 3 comes from a simulator in the cloud session's scratch folders. If those are
gone, the numbers in the documents stand as written, but nobody can rerun them.

- **The simulator:**
  `/tmp/claude-0/-home-user/19d968bc-3916-40c7-b8c9-654318434293/scratchpad/sim/econ-final.mjs`.
- **Round 3's model on top of it:**
  `/tmp/claude-0/-home-user/850259fd-2450-55af-9ba3-5fea4af0561a/scratchpad/r3/final/model/`.
  - `run-final.sh` runs every case.
  - `f-tables.mjs` writes `out/tables.txt`, the source of round 3's numbers.
  - One run takes about 20 seconds with Node.
- **Round 2's model:** `.../scratchpad/cred/final/`.
- **The working files of the third-currency research** (designs, judgements, the map of the game's economy):
  `.../scratchpad/c3/`.

If the model is wanted later, ask the owner whether to copy its source files (not the outputs) into the repo.

## Rules that bind every idea

- Nothing is sold: no purchases, no ads, no timers to wait out or skip.
- Nothing is lost for missing a day; no streaks.
- No drugs. No real event, brand, car-maker or drink names in the game.
- Never schools, kindergartens, places of worship, cemeteries, prisons or embassies as game places.
- No statement about real neighbourhoods; the police behave the same everywhere.
- No follower count or social-network look.
- No imitation of other games' names, looks or words: never "wanted", "export", "respect", "heat level", no stars
  under the cash, no gem counter.
- The start is equal in the countryside and in a big city, and the game works where little is mapped.
- Saves stay small.
- Plain, specific wording; "estimate" for anything assumed; they/them for staff and for people whose pronouns
  are not known.
- Credit "Map data © OpenStreetMap contributors" wherever map data is shown.

## Live numbers (anonymous play counts, 17 to 19 November)

| | count |
|---|---|
| new browsers | 98 |
| return visits | 12 |
| runs started | 55 |
| runs finished | 13 |
| homes bought | 23 (16 flats, 6 buildings, 1 house) |
| rent collected on a return | 2 times |
| online saves in all | 8 |

| visit length | visits |
|---|---|
| under 1 minute | 56 |
| 1 to 5 minutes | 59 |
| 5 to 20 minutes | 15 |
| over 20 minutes | 2 |

So 87% of visits end within 5 minutes, and most players never get far enough to meet staff or cred.
