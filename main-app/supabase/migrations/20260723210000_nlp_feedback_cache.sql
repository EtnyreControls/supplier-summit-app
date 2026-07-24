-- Cache table for the nlp-service feedback topic clustering pipeline.
-- Each refresh (POST /api/feedback/topics/refresh) inserts a new row rather
-- than updating in place, so cached_at desc + limit 1 always serves the
-- latest run while preserving history.

create table public.nlp_feedback_cache (
  id uuid primary key default gen_random_uuid(),
  cached_at timestamptz not null default now(),
  results jsonb not null
);

alter table public.nlp_feedback_cache enable row level security;

create policy "admin view feedback cache" on public.nlp_feedback_cache for select using (is_admin());
create policy "admin insert feedback cache" on public.nlp_feedback_cache for insert with check (is_admin());
