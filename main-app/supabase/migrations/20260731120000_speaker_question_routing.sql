-- ML-based question routing to speakers. Additive only — no existing
-- questions/question_groups columns touched, and question submission
-- (submit_question RPC) is untouched; this hooks in as a POST-INSERT step
-- from the frontend (see submit-question.ts) that calls the nlp-service
-- after the existing RPC has already succeeded.
--
-- speakers already carries bio (init_schema.sql) and is already joined to
-- "user" for name/email/login (see agenda/page.tsx) — the existing PIN +
-- mint-session auth pattern is reused as-is for speaker logins, so the only
-- new column speakers needs is a cached bio embedding (no pgvector
-- extension in this project today; stored as a plain array and compared
-- with numpy in nlp-service, same pattern already used for question-group
-- near-duplicate detection).
--
-- question_routing is a full audit trail: one row per routing attempt, never
-- overwritten. A question's *current* routing is "the newest row for that
-- question_id". The terminal "no speaker left" case is its own row with
-- status='unrouted' and speaker_id null (a real speaker attempt always has
-- speaker_id set) — the partial unique index below caps that to one such
-- row per question so re-running the routing logic can't spam it.

alter table public.speakers
  add column if not exists embedding double precision[];

create type public.routing_status as enum ('pending', 'accepted', 'declined', 'unrouted');

create table public.question_routing (
  routing_id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (question_id) on delete cascade,
  speaker_id uuid references public.speakers (speaker_id) on delete cascade,
  status public.routing_status not null default 'pending',
  attempt_number int not null,
  similarity_score double precision,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (question_id, speaker_id),
  unique (question_id, attempt_number),
  check ((status = 'unrouted') = (speaker_id is null))
);

-- Only one terminal "no speaker left" row per question.
create unique index question_routing_one_unrouted_per_question
  on public.question_routing (question_id)
  where status = 'unrouted';

create index question_routing_question_id_idx on public.question_routing (question_id);
create index question_routing_speaker_pending_idx on public.question_routing (speaker_id, status);

alter table public.question_routing enable row level security;

-- Speakers see and act only on their own routing attempts (mirrors the
-- existing "speaker view/answer routed groups" policies on question_groups).
create policy "speaker view own routing" on public.question_routing for select
  using (speaker_id in (select speaker_id from speakers where speakers.user_id = auth.uid()));

-- A speaker may only move their OWN still-pending row to accepted/declined —
-- can't touch someone else's row, can't re-flip a row already decided.
create policy "speaker decide own pending routing" on public.question_routing for update
  using (speaker_id in (select speaker_id from speakers where speakers.user_id = auth.uid()) and status = 'pending')
  with check (speaker_id in (select speaker_id from speakers where speakers.user_id = auth.uid()));

-- Admin/analytics need full visibility, including the 'unrouted' terminal
-- rows the task requires to be admin-surfaced, not hidden.
create policy "analytics view all routing" on public.question_routing for select using (is_analytics());
create policy "admin view all routing" on public.question_routing for select using (is_admin());

-- No insert policy for authenticated/anon: rows are only ever created by
-- nlp-service, which already writes to question_groups/questions/
-- feedback_topic_* tables using a privileged Supabase key (see
-- get_supabase() in app.py) — same trust boundary as the existing pipeline,
-- nothing new introduced here.
