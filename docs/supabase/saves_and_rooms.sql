-- Saved games and rooms for the browser game (src/cloud.ts). Applied to the Supabase project by
-- hand through the connector; kept here so that what the server does can be read.
--
-- A player who enters a name gets a long random "save code" made in their browser. The server
-- never stores the code, only its fingerprint, and everything a browser may do goes through the
-- functions below; the tables themselves are closed.

create table public.saves (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (name ~ '^[^[:cntrl:]]{1,16}$'),
  data jsonb not null check (pg_column_size(data) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
revoke all on public.saves from anon, authenticated;

create table public.rooms (
  id text primary key check (id ~ '^[0-9a-f]{12}$'),
  course text not null check (char_length(course) between 8 and 800 and course ~ '^[A-Za-z0-9_-]+$'),
  place text not null default '' check (char_length(place) <= 40),
  owner_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;
revoke all on public.rooms from anon, authenticated;

create table public.room_results (
  room_id text not null references public.rooms(id),
  key_hash text not null,
  name text not null check (name ~ '^[^[:cntrl:]]{1,16}$'),
  score integer not null check (score between 0 and 10000000),
  seconds integer not null check (seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, key_hash)
);
alter table public.room_results enable row level security;
revoke all on public.room_results from anon, authenticated;

create function public.code_hash(code text) returns text
language sql immutable set search_path = '' as $$
  select case when code ~ '^[A-Za-z0-9]{32,64}$' then encode(sha256(convert_to(code, 'utf8')), 'hex') end;
$$;
revoke all on function public.code_hash(text) from public, anon, authenticated;

-- Saves. save_put answers with the time of the save, which the browser keeps to notice a newer one.
create function public.save_put(code text, name text, data jsonb) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare h text := public.code_hash(code); t timestamptz;
begin
  if h is null then raise exception 'bad save code' using errcode = '22023'; end if;
  insert into public.saves (key_hash, name, data) values (h, btrim(save_put.name), save_put.data)
  on conflict (key_hash) do update set name = excluded.name, data = excluded.data,
    -- an unchanged game keeps its time, so that sending it again does not look like news
    updated_at = case when public.saves.name = excluded.name and public.saves.data = excluded.data then public.saves.updated_at else now() end
  returning updated_at into t;
  return t;
end $$;

create function public.save_get(code text) returns jsonb
language sql security definer stable set search_path = '' as $$
  select jsonb_build_object('name', s.name, 'data', s.data, 'updated_at', s.updated_at)
  from public.saves s where s.key_hash = public.code_hash(code);
$$;

-- A player takes their save, and their results in rooms, off the server.
create function public.save_delete(code text) returns void
language plpgsql security definer set search_path = '' as $$
declare h text := public.code_hash(code);
begin
  if h is null then raise exception 'bad save code' using errcode = '22023'; end if;
  delete from public.room_results r where r.key_hash = h;
  delete from public.saves s where s.key_hash = h;
end $$;

-- Rooms: one run (the packed course a challenge link carries) for up to 8 players.
create function public.room_create(code text, course text, place text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare h text := public.code_hash(code); new_id text;
begin
  if h is null then raise exception 'bad save code' using errcode = '22023'; end if;
  if (select count(*) from public.rooms r where r.owner_hash = h and r.created_at > now() - interval '1 day') >= 50 then
    raise exception 'too many rooms today' using errcode = '22023';
  end if;
  new_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.rooms (id, course, place, owner_hash) values (new_id, room_create.course, left(btrim(coalesce(room_create.place, '')), 40), h);
  return new_id;
end $$;

-- The room for anyone who has its link: the run and the board, best first. No codes, no fingerprints.
create function public.room_get(room text) returns jsonb
language sql security definer stable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'course', r.course, 'place', r.place,
    'results', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'score', x.score, 'seconds', x.seconds) order by x.score desc, x.seconds asc, x.created_at asc)
      from public.room_results x where x.room_id = r.id), '[]'::jsonb))
  from public.rooms r where r.id = room_get.room;
$$;

-- A player's result in a room. The first 8 different players are in; each keeps their best.
create function public.room_submit(room text, code text, name text, score integer, seconds integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h text := public.code_hash(code);
begin
  if h is null then raise exception 'bad save code' using errcode = '22023'; end if;
  perform 1 from public.rooms r where r.id = room_submit.room for update;
  if not found then raise exception 'no such room' using errcode = '22023'; end if;
  if not exists (select 1 from public.room_results x where x.room_id = room_submit.room and x.key_hash = h)
     and (select count(*) from public.room_results x where x.room_id = room_submit.room) >= 8 then
    raise exception 'room is full' using errcode = '22023';
  end if;
  insert into public.room_results (room_id, key_hash, name, score, seconds)
  values (room_submit.room, h, btrim(room_submit.name), room_submit.score, room_submit.seconds)
  on conflict (room_id, key_hash) do update set
    name = excluded.name,
    score = case when excluded.score > public.room_results.score then excluded.score else public.room_results.score end,
    seconds = case when excluded.score > public.room_results.score then excluded.seconds else public.room_results.seconds end,
    updated_at = now();
  return public.room_get(room_submit.room);
end $$;

revoke all on function public.save_put(text, text, jsonb), public.save_get(text), public.save_delete(text),
  public.room_create(text, text, text), public.room_get(text), public.room_submit(text, text, text, integer, integer) from public;
grant execute on function public.save_put(text, text, jsonb), public.save_get(text), public.save_delete(text),
  public.room_create(text, text, text), public.room_get(text), public.room_submit(text, text, text, integer, integer) to anon;

-- Later changes, applied 16 November 2026 after a security review:
-- - the rooms are switched off for browsers: execute on room_create, room_get and room_submit is revoked from anon;
-- - no function here is granted to the signed-in role (authenticated): nothing in the game signs anyone in;
-- - save_put refuses a NEW save once 5000 exist ('saving is full for now'); existing saves keep working;
-- - count_link_at holds at most 3000 different squares a day; beyond that a count goes to "no square".
