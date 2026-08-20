-- Admin panel: live_state singleton for day-of push (Growth Machine timer,
-- general countdown), Realtime publication for event/feedback/live_state,
-- and admin-scoped RLS for tables that were missing it.

-- ── live_state ───────────────────────────────────────────────────────────

create table public.live_state (
  id boolean primary key default true,
  general_countdown_label text,
  general_countdown_ends_at timestamptz,
  growth_machine_timer_label text,
  growth_machine_timer_ends_at timestamptz,
  -- Gates /growth-machine itself (role picker + board) — separate from the
  -- round timer above, which only runs once the session is already live.
  growth_machine_session_live boolean not null default false,
  updated_by uuid references public."user" (user_id),
  updated_at timestamptz not null default now(),
  constraint live_state_singleton check (id)
);

insert into public.live_state (id) values (true);

alter table public.live_state enable row level security;

create policy "view live state" on public.live_state for select using (auth.role() = 'authenticated');
create policy "admin update live state" on public.live_state for update using (is_admin()) with check (is_admin());

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Guarded — `event` (and possibly others) may already be in the publication
-- from prior manual dashboard setup, and ALTER PUBLICATION ... ADD TABLE
-- errors (rather than no-ops) if the table is already a member.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event'
  ) then
    alter publication supabase_realtime add table public.event;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback'
  ) then
    alter publication supabase_realtime add table public.feedback;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_state'
  ) then
    alter publication supabase_realtime add table public.live_state;
  end if;
end $$;

-- ── Admin RLS gaps ───────────────────────────────────────────────────────

-- contacts (previously owner-only)
create policy "admin manage contacts" on public.contacts for all using (is_admin()) with check (is_admin());

-- questions / question_groups (previously submitter/speaker/analytics only)
create policy "admin manage questions" on public.questions for all using (is_admin()) with check (is_admin());
create policy "admin manage question groups" on public.question_groups for all using (is_admin()) with check (is_admin());

-- feedback topics (previously analytics-only)
create policy "admin manage feedback topic runs" on public.feedback_topic_runs for all using (is_admin()) with check (is_admin());
create policy "admin manage feedback topics" on public.feedback_topics for all using (is_admin()) with check (is_admin());
create policy "admin manage feedback topic items" on public.feedback_topic_items for all using (is_admin()) with check (is_admin());

-- growth machine (previously read-only / RPC-only for non-builders)
create policy "admin manage gm entries" on public.growth_machine_entries for all using (is_admin()) with check (is_admin());
create policy "admin manage gm votes" on public.growth_machine_votes for all using (is_admin()) with check (is_admin());
create policy "admin manage gm boards" on public.growth_machine_boards for all using (is_admin()) with check (is_admin());

-- question_routing (previously speaker-only)
create policy "admin manage question routing" on public.question_routing for all using (is_admin()) with check (is_admin());
