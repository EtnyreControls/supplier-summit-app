-- A speaker needs to preview a routed question's full group (composed
-- text, other near-duplicate submissions, any existing checked/answer_text)
-- BEFORE accepting it — accept_question_routing() is what sets
-- question_groups.speaker_id, so the existing "speaker view routed groups"
-- policy (keyed on that column, init_schema.sql) only covers AFTER
-- acceptance. Without this, /speaker's list can see question_routing (which
-- already snapshots question_text) but silently gets nothing back for
-- questions/question_groups under RLS, so the grouped/answerable view never
-- renders anything.
--
-- Purely additive SELECT policies — Postgres OR's multiple SELECT policies
-- together, so this only widens visibility beyond the existing
-- already-assigned case, nothing narrower is removed.

create policy "speaker view questions routed to them" on public.questions for select
  using (
    exists (
      select 1 from public.question_routing qr
      join public.speakers s on s.speaker_id = qr.speaker_id
      where qr.question_id = questions.question_id and s.user_id = auth.uid()
    )
  );

create policy "speaker view groups routed to them" on public.question_groups for select
  using (
    exists (
      select 1 from public.questions q
      join public.question_routing qr on qr.question_id = q.question_id
      join public.speakers s on s.speaker_id = qr.speaker_id
      where q.group_id = question_groups.group_id and s.user_id = auth.uid()
    )
  );
