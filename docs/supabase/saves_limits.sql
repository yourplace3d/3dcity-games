-- Saving online for everyone (16 November 2026), applied as the migration "saves_limits".
-- save_put as before (see saves_and_rooms.sql), with three changes:
-- - up to 20,000 saved games (was 5,000); past that a NEW save is refused, existing ones keep working;
-- - a saved game is at most 150,000 characters (the game itself stops at 120,000 and says so);
-- - saved games not changed for six months are deleted, 100 at a time, each time a new save is made.
--   A visit changes the save (the day of the visit is in it), so this is "not played for six months".

create or replace function public.save_put(code text, name text, data jsonb)
returns timestamp with time zone
language plpgsql
security definer
set search_path to ''
as $$
declare h text := public.code_hash(code); t timestamptz;
begin
  if h is null then raise exception 'bad save code' using errcode = '22023'; end if;
  if length(save_put.data::text) > 150000 then raise exception 'this game is too big to save' using errcode = '22023'; end if;
  if not exists (select 1 from public.saves s where s.key_hash = h) then
    with old as (select s.key_hash from public.saves s where s.updated_at < now() - interval '6 months' limit 100),
         gone as (delete from public.room_results r where r.key_hash in (select key_hash from old))
    delete from public.saves s where s.key_hash in (select key_hash from old);
    if (select count(*) from public.saves) >= 20000 then
      raise exception 'saving is full for now' using errcode = '22023';
    end if;
  end if;
  insert into public.saves (key_hash, name, data) values (h, btrim(save_put.name), save_put.data)
  on conflict (key_hash) do update set name = excluded.name, data = excluded.data,
    updated_at = case when public.saves.name = excluded.name and public.saves.data = excluded.data then public.saves.updated_at else now() end
  returning updated_at into t;
  return t;
end $$;
