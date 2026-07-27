-- Lets analytics triage feedback topics the same way question groups are
-- triaged (AddressableList's checkbox) — feedback_topics had no such state
-- at all, so the Feedback tab's checklist was mock data with nothing to
-- write to. Note: each "Refresh" in FeedbackTopics runs a fresh clustering
-- pass into a brand-new feedback_topic_runs row with brand-new topic_ids
-- (see nlp-service/app.py save_run) — there's no merge across runs like
-- question groups have, so addressed state here only survives until the
-- next refresh regenerates topics from scratch. That's an accepted
-- limitation, not a bug to fix here.

alter table public.feedback_topics
  add column if not exists addressed boolean not null default false,
  add column if not exists addressed_at timestamptz;

create policy "analytics update topics" on public.feedback_topics
  for update using (is_analytics()) with check (is_analytics());
