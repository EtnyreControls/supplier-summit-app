-- Seats Justin Nelson at Growth Machine table 12. He's role='speaker', so
-- unlike attendees he has no auto-assigned seat via assign_attendee_table()
-- (see 20260821130000_add_karina_to_table_11.sql for the same pattern) —
-- confirmed no existing event_table_members row for him before this insert.

do $$
declare
  v_event_id uuid;
  v_table_id uuid;
  v_user_id uuid;
begin
  select event_id into v_event_id
  from public.event
  where event_name in ('Growth Machine: Interactive Supplier Workshop', 'Growth Machine - Interactive Workshop')
  order by start_time desc
  limit 1;

  if v_event_id is null then
    raise exception 'Growth Machine event not found';
  end if;

  select user_id into v_user_id
  from public."user"
  where first_name = 'Justin' and last_name = 'Nelson';

  if v_user_id is null then
    raise exception 'Justin Nelson not found';
  end if;

  select table_id into v_table_id
  from public.event_tables
  where event_id = v_event_id and table_name = '12';

  if v_table_id is null then
    raise exception 'Table 12 not found';
  end if;

  delete from public.event_table_members
  where user_id = v_user_id
    and table_id in (select table_id from public.event_tables where event_id = v_event_id);

  insert into public.event_table_members (table_id, user_id, is_builder)
  values (v_table_id, v_user_id, false)
  on conflict (table_id, user_id) do nothing;
end $$;
