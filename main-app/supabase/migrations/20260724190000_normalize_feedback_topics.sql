-- Replaces the JSONB-blob nlp_feedback_cache with normalized tables that
-- let a clustered topic drill down to the actual feedback_answers row it
-- came from, instead of just a duplicated text string. Nothing has ever
-- read real data out of nlp_feedback_cache (it only ever held sample-data
-- test runs), so it's dropped outright rather than migrated.
--
-- Also fixes the RLS gate: nlp_feedback_cache used is_admin(), which never
-- matched the rest of the Analytics feature (is_analytics()) — the
-- replacement tables get it right from the start.

drop table public.nlp_feedback_cache;

create table public.feedback_topic_runs (
  run_id uuid primary key default gen_random_uuid(),
  cached_at timestamptz not null default now()
);

-- Topics aren't updated across runs — BERTopic's topic numbering isn't
-- stable between reruns, so each refresh gets entirely fresh topic rows
-- (same "always insert, never overwrite" pattern the old cache used).
create table public.feedback_topics (
  topic_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.feedback_topic_runs (run_id) on delete cascade,
  label varchar(200) not null,
  summary text not null,
  item_count int not null default 0
);

-- feedback_answer_id is nullable: the pipeline still runs (and this still
-- records what it produced) even with no real feedback yet, falling back
-- to sample data with nothing to link to. raw_text is what's always
-- shown; the FK is what enables real drill-down once actual answers exist.
create table public.feedback_topic_items (
  item_id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.feedback_topics (topic_id) on delete cascade,
  feedback_answer_id uuid references public.feedback_answers (feedback_answer_id) on delete set null,
  raw_text text not null
);

alter table public.feedback_topic_runs enable row level security;
alter table public.feedback_topics enable row level security;
alter table public.feedback_topic_items enable row level security;

create policy "analytics view topic runs" on public.feedback_topic_runs for select using (is_analytics());
create policy "analytics insert topic runs" on public.feedback_topic_runs for insert with check (is_analytics());

create policy "analytics view topics" on public.feedback_topics for select using (is_analytics());
create policy "analytics insert topics" on public.feedback_topics for insert with check (is_analytics());

create policy "analytics view topic items" on public.feedback_topic_items for select using (is_analytics());
create policy "analytics insert topic items" on public.feedback_topic_items for insert with check (is_analytics());
