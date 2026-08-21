-- One-off seating change: moves Zoey Henchliffe, Pranav Amin, Divrina Gupta,
-- and Naimisha Daripineni onto a brand new table (11) together, creating it
-- if needed. Three of the four are non-attendee roles (analytics/admin) that
-- never went through assign_attendee_table()'s auto-assign trigger, so this
-- can't just rely on that — it has to seed the table and membership rows
-- directly, by email since that's stable and unambiguous.

do $$
declare
  v_event_id uuid;
  v_table_id uuid;
  v_user_ids uuid[];
begin
  select event_id into v_event_id
  from public.event
  where event_name = 'Growth Machine: Interactive Supplier Workshop';

  if v_event_id is null then
    raise exception 'Growth Machine event not found';
  end if;

  select array_agg(user_id) into v_user_ids
  from public."user"
  where lower(email) in ('zhenchliffe@etnyre.com', 'pamin@etnyre.com', 'dgupta@etnyre.com', 'ndaripineni@etnyre.com');

  if v_user_ids is null or array_length(v_user_ids, 1) <> 4 then
    raise exception 'Expected 4 matching users, found %', coalesce(array_length(v_user_ids, 1), 0);
  end if;

  select table_id into v_table_id
  from public.event_tables
  where event_id = v_event_id and table_name = '11';

  if v_table_id is null then
    insert into public.event_tables (event_id, table_name)
    values (v_event_id, '11')
    returning table_id into v_table_id;
  end if;

  -- Drop any existing membership these four have at other Growth Machine
  -- tables before seating them together at the new one.
  delete from public.event_table_members
  where user_id = any(v_user_ids)
    and table_id in (select table_id from public.event_tables where event_id = v_event_id);

  insert into public.event_table_members (table_id, user_id, is_builder)
  select v_table_id, uid, false
  from unnest(v_user_ids) as uid
  on conflict (table_id, user_id) do nothing;
end $$;
