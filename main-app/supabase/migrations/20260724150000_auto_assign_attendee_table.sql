-- Auto-assigns every new attendee to one of the 10 Growth Machine tables,
-- balanced by current occupancy (picks the least-populated table, tie-break
-- by table_name) rather than a fixed round-robin counter — stays even even
-- if members are later deleted/reassigned, unlike a counter that only ever
-- increments.
--
-- Reuses event_tables/event_table_members (the Growth Machine
-- builder/spectator schema) rather than introducing a separate "seating
-- table" concept, since that's the only existing notion of "table" in this
-- schema and is exactly what /welcome already reads (see welcome/page.tsx).
-- Tables are looked up by the Growth Machine event's name rather than a
-- hardcoded UUID, since this migration seeds them itself and their ids are
-- only known at insert time.

do $$
declare
  v_event_id uuid;
  v_count int;
begin
  select event_id into v_event_id
  from public.event
  where event_name = 'Growth Machine: Interactive Supplier Workshop';

  if v_event_id is null then
    raise exception 'Growth Machine event not found — cannot seed attendee tables';
  end if;

  select count(*) into v_count from public.event_tables where event_id = v_event_id;

  if v_count = 0 then
    insert into public.event_tables (event_id, table_name)
    select v_event_id, gs::text
    from generate_series(1, 10) as gs;
  end if;
end $$;

create or replace function public.assign_attendee_table()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_table_id uuid;
begin
  if new.role is distinct from 'attendee' then
    return new;
  end if;

  select et.table_id into v_table_id
  from public.event_tables et
  join public.event ev on ev.event_id = et.event_id
  left join public.event_table_members etm on etm.table_id = et.table_id
  where ev.event_name = 'Growth Machine: Interactive Supplier Workshop'
  group by et.table_id
  order by count(etm.user_id) asc, et.table_name asc
  limit 1;

  if v_table_id is not null then
    insert into public.event_table_members (table_id, user_id, is_builder)
    values (v_table_id, new.user_id, false)
    on conflict (table_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger assign_attendee_table_trigger
  after insert on public."user"
  for each row
  execute function public.assign_attendee_table();

-- One-time backfill for attendee rows that predate this trigger.
do $$
declare
  r record;
  v_table_id uuid;
begin
  for r in
    select u.user_id
    from public."user" u
    where u.role = 'attendee'
      and not exists (
        select 1 from public.event_table_members etm where etm.user_id = u.user_id
      )
  loop
    select et.table_id into v_table_id
    from public.event_tables et
    join public.event ev on ev.event_id = et.event_id
    left join public.event_table_members etm on etm.table_id = et.table_id
    where ev.event_name = 'Growth Machine: Interactive Supplier Workshop'
    group by et.table_id
    order by count(etm.user_id) asc, et.table_name asc
    limit 1;

    if v_table_id is not null then
      insert into public.event_table_members (table_id, user_id, is_builder)
      values (v_table_id, r.user_id, false)
      on conflict (table_id, user_id) do nothing;
    end if;
  end loop;
end $$;
