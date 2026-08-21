-- Adds Karina Phomsopha to table 11 (see 20260821120000_reassign_new_table),
-- alongside Zoey/Pranav/Divrina/Naimisha. She's an 'attendee' role, so she
-- may already have an auto-assigned seat elsewhere via
-- assign_attendee_table() — drop that before seating her at table 11.

do $$
declare
  v_event_id uuid;
  v_table_id uuid;
  v_user_id uuid;
begin
  select event_id into v_event_id
  from public.event
  where event_name = 'Growth Machine: Interactive Supplier Workshop';

  if v_event_id is null then
    raise exception 'Growth Machine event not found';
  end if;

  select user_id into v_user_id
  from public."user"
  where lower(email) = 'kphomsopha@etnyre.com';

  if v_user_id is null then
    raise exception 'Karina Phomsopha not found';
  end if;

  select table_id into v_table_id
  from public.event_tables
  where event_id = v_event_id and table_name = '11';

  if v_table_id is null then
    raise exception 'Table 11 not found';
  end if;

  delete from public.event_table_members
  where user_id = v_user_id
    and table_id in (select table_id from public.event_tables where event_id = v_event_id);

  insert into public.event_table_members (table_id, user_id, is_builder)
  values (v_table_id, v_user_id, false)
  on conflict (table_id, user_id) do nothing;
end $$;
