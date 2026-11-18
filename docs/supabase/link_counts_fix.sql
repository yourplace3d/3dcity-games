-- count_link_at (the older counter: challenge links made and opened, arrivals by the video link, with
-- the map square) broke on 15 November 2026 at about 23:46 UTC, when the cap of 3000 squares a day was
-- added: "on conflict (day, kind, cell)" names "kind", which is both this function's argument and the
-- column, and Postgres refused every call. Nothing was counted by it from then until the fix on
-- 17 November 2026 at about 21:25 UTC (migration "count_link_at_fix_conflict"). play_counts was not
-- affected. Lesson: in a plpgsql function whose arguments share column names, write
-- "on conflict on constraint <name>".

create or replace function public.count_link_at(kind text, cell text default '')
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare today date := (now() at time zone 'utc')::date; c text := coalesce(count_link_at.cell, '');
begin
  if c <> '' and not exists (select 1 from public.link_counts_at x where x.day = today and x.kind = count_link_at.kind and x.cell = c)
     and (select count(*) from public.link_counts_at x where x.day = today) >= 3000 then
    c := '';
  end if;
  -- the constraint by name: "kind" alone would be both this function's argument and the column
  insert into public.link_counts_at as l (day, kind, cell, n) values (today, count_link_at.kind, c, 1)
  on conflict on constraint link_counts_at_pkey do update set n = l.n + 1;
end $$;
