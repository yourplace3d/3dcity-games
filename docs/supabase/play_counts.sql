-- How the game is played, counted per day: visits (new or back, and where from), what happens in
-- play (runs finished, homes bought, rent collected on a return) and which city is being played.
-- Counts only: a day, a word and a number. Nothing about the player and no address. The place is the
-- one on the map being played, never where the visitor is: a well-known city by name, or any other
-- place as its one-degree square (about 100 km across), as with the links. Written only through count_play().
-- Applied to the project on 16 November 2026 as the migrations "play_counts" and "play_counts_fix_conflict";
-- runs started, Where am I? rounds and time played added on 17 November 2026 ("play_counts_more");
-- the city being played added on 21 November 2026 ("play_counts_city"); the chapter of the story just
-- finished in play, '1' to '8', added on 26 November 2026 ("play_counts_chapter", applied 18:58 UTC by the
-- session that keeps the database).
--
-- How far players get in the story:
--   select day, detail, n from play_counts where kind = 'chapter' order by day desc, detail;
--
-- Read it with:
--   select day, kind, detail, n from play_counts order by day desc, kind, detail;
-- and the cities, most played first, for the last seven days:
--   select detail as city, sum(n) as visits from play_counts
--   where kind = 'city' and day >= (now() at time zone 'utc')::date - 6 group by detail order by 2 desc;
--
-- The cities named in the function below are the ones in `CITIES` in `src/places.ts` (the first name of
-- each). A city added there needs its name here too, in a new migration; until then it is counted as
-- 'other'. tests/cityCount.test.ts fails when the two lists differ.

create table public.play_counts (
  day date not null default ((now() at time zone 'utc'))::date,
  kind text not null,
  detail text not null default '',
  n bigint not null default 0,
  primary key (day, kind, detail)
);
comment on table public.play_counts is
  'Per day (UTC): visits (new: a browser seen for the first time; back: the first visit of a day by a browser seen before; detail: where it came from) and play (start: a run begun, its first package on board; run: a run of three finished; home: a home bought, detail flat/house/building; rent: rent collected on a return; guess: a round of Where am I? begun; time: how long a visit played, detail under1/1to5/5to20/over20 minutes; city: a city loaded to play in, once a visit for each, detail a well-known city by name, else its one-degree square such as 53,9, else other). Counts only. Written through count_play().';

alter table public.play_counts enable row level security;
-- no policies: browsers cannot read or write the table, only call count_play()

create or replace function public.count_play(kind text, detail text default '')
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  d text := coalesce(count_play.detail, '');
  today date := (now() at time zone 'utc')::date;
begin
  -- only the words the game sends; anything else is dropped
  if count_play.kind not in ('new', 'back', 'start', 'run', 'home', 'rent', 'guess', 'time', 'city', 'chapter') then return; end if;
  if count_play.kind in ('new', 'back') and d not in ('direct', 'youtube', 'search', 'challenge', 'link') then d := 'other'; end if;
  if count_play.kind = 'home' and d not in ('flat', 'house', 'building') then d := ''; end if;
  if count_play.kind = 'time' and d not in ('under1', '1to5', '5to20', 'over20') then return; end if;
  -- the chapter just finished in the story, '1' to '8'; anything else is dropped (as with 'time')
  if count_play.kind = 'chapter' and d not in ('1', '2', '3', '4', '5', '6', '7', '8') then return; end if;
  if count_play.kind in ('start', 'run', 'rent', 'guess') then d := ''; end if;
  -- a city being played: one of the well-known cities by name, else the one-degree square of the place
  -- ("53,9"), else 'other'. Never a name a visitor typed. Squares: at most 500 different ones a day.
  if count_play.kind = 'city' and not (d = any (array[
    'Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Nuremberg', 'Freiburg',
    'Vienna', 'Zurich', 'Paris', 'London', 'Amsterdam', 'Brussels', 'Madrid', 'Barcelona', 'Lisbon',
    'Rome', 'Milan', 'Prague', 'Warsaw', 'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Dublin',
    'Istanbul', 'Athens', 'New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Seattle', 'Boston',
    'Washington', 'Miami', 'Toronto', 'Ottawa', 'Montreal', 'Vancouver', 'Mexico City',
    'Rio de Janeiro', 'São Paulo', 'Buenos Aires', 'Tokyo', 'Osaka', 'Seoul', 'Beijing', 'Shanghai',
    'Hong Kong', 'Singapore', 'Bangkok', 'Mumbai', 'Delhi', 'Dubai', 'Cairo', 'Cape Town', 'Nairobi',
    'Sydney', 'Melbourne'
  ])) then
    if d ~ '^-?[0-9]{1,2},-?[0-9]{1,3}$' then
      if split_part(d, ',', 1)::int not between -90 and 90 or split_part(d, ',', 2)::int not between -180 and 180
         or (not exists (select 1 from public.play_counts x where x.day = today and x.kind = 'city' and x.detail = d)
             and (select count(*) from public.play_counts x where x.day = today and x.kind = 'city') >= 500) then
        d := 'other';
      end if;
    else
      d := 'other';
    end if;
  end if;
  -- the constraint by name: "kind" alone would be both this function's argument and the column
  insert into public.play_counts as p (day, kind, detail, n) values (today, count_play.kind, d, 1)
  on conflict on constraint play_counts_pkey do update set n = p.n + 1;
end $$;

revoke all on function public.count_play(text, text) from public, authenticated;
grant execute on function public.count_play(text, text) to anon;
