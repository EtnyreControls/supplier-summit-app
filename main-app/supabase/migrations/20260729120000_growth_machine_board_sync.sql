-- Connects the Growth Machine board to the database:
--
-- 1. enter_growth_machine(): resolves the caller's assigned table (from
--    event_table_members, seeded by assign_attendee_table) and atomically
--    claims/releases the builder seat. "One builder per table" is enforced
--    by a partial unique index — the DB-level guarantee the board page's
--    comment said belonged here, not in the client.
-- 2. growth_machine_boards: submitted board snapshots (tldraw document
--    JSON), one row per submission, written only through
--    submit_growth_machine_board() (SECURITY DEFINER, builder-only) —
--    same controlled-entry-point pattern as submit_question().

-- ── One builder per table ────────────────────────────────────────────────

create unique index if not exists one_builder_per_table
  on public.event_table_members (table_id)
  where is_builder;

create or replace function public.enter_growth_machine(p_as_builder boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_table_id uuid;
  v_granted boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to join the Growth Machine';
  end if;

  select table_id into v_table_id
  from public.event_table_members
  where user_id = auth.uid()
  limit 1;

  -- Not assigned to a table (e.g. staff roles) — caller falls back to the
  -- shared default room, same as before this migration.
  if v_table_id is null then
    return jsonb_build_object('table_id', null, 'is_builder', false);
  end if;

  if p_as_builder then
    begin
      update public.event_table_members
      set is_builder = true
      where table_id = v_table_id and user_id = auth.uid();
      v_granted := true;
    exception when unique_violation then
      -- Someone else already holds the builder seat for this table.
      v_granted := false;
    end;
  else
    -- Entering as spectator releases the seat if this user held it.
    update public.event_table_members
    set is_builder = false
    where table_id = v_table_id and user_id = auth.uid();
  end if;

  return jsonb_build_object('table_id', v_table_id, 'is_builder', v_granted);
end;
$$;

grant execute on function public.enter_growth_machine(boolean) to authenticated;

-- ── Board submissions ────────────────────────────────────────────────────

create table public.growth_machine_boards (
  board_id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.event_tables (table_id) on update cascade on delete cascade,
  submitted_by uuid references public."user" (user_id) on update cascade on delete set null,
  snapshot jsonb not null,
  created_at timestamptz default now()
);

alter table public.growth_machine_boards enable row level security;

create policy "table members view their boards" on public.growth_machine_boards
  for select using (
    exists (
      select 1 from public.event_table_members m
      where m.table_id = growth_machine_boards.table_id
        and m.user_id = auth.uid()
    )
  );
create policy "analytics view all boards" on public.growth_machine_boards
  for select using (is_analytics());

-- No INSERT policy on purpose — writes go through this function only.
create or replace function public.submit_growth_machine_board(p_table_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_board_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to submit a board';
  end if;

  if not exists (
    select 1 from public.event_table_members
    where table_id = p_table_id
      and user_id = auth.uid()
      and is_builder
  ) then
    raise exception 'Only the table''s current builder can submit its board';
  end if;

  insert into public.growth_machine_boards (table_id, submitted_by, snapshot)
  values (p_table_id, auth.uid(), p_snapshot)
  returning board_id into v_board_id;

  return v_board_id;
end;
$$;

grant execute on function public.submit_growth_machine_board(uuid, jsonb) to authenticated;
