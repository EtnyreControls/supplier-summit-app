-- Wires speaker "accept" up to actually grant answering permission.
--
-- question_groups.speaker_id is what "speaker answer routed groups" (RLS,
-- init_schema.sql) actually checks before letting a speaker update
-- checked/answer_text — but nothing has ever written to it. question_routing
-- and override_question_routing() are explicitly "additive only... never
-- touches questions/question_groups" (see their migrations), and
-- nlp-service's route_question() says the same in its own docstring. So
-- today, accepting a routed question doesn't grant the ability to answer it
-- — this is the missing write.
--
-- A speaker can't grant themselves this via a plain RLS-checked update
-- (the existing policy only lets them touch a group where speaker_id
-- ALREADY equals theirs — the first assignment has no policy to go
-- through), so this needs a SECURITY DEFINER function, same pattern as
-- override_question_routing().

create or replace function public.accept_question_routing(p_routing_id uuid)
returns uuid -- the group_id now unlocked for answering
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_question_id uuid;
  v_speaker_id uuid;
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to accept a routed question';
  end if;

  -- Matches the routing row's OWN speaker_id against one of the caller's
  -- speakers rows (a person can have more than one, see analytics/page.tsx)
  -- rather than assuming a single speaker_id per user — same join shape as
  -- the "speaker decide own pending routing" RLS policy this mirrors.
  update public.question_routing qr
  set status = 'accepted', decided_at = now()
  where qr.routing_id = p_routing_id
    and qr.status = 'pending'
    and exists (
      select 1 from public.speakers s
      where s.speaker_id = qr.speaker_id and s.user_id = auth.uid()
    )
  returning qr.question_id, qr.speaker_id into v_question_id, v_speaker_id;

  if v_question_id is null then
    raise exception 'This question is no longer pending, or is not yours to accept';
  end if;

  select group_id into v_group_id from public.questions where question_id = v_question_id;

  -- Assumed one active speaker per group at a time — same assumption
  -- analytics/page.tsx's routing display already makes ("routing/reassign
  -- is shown and acted on once per item, not once per merged duplicate").
  update public.question_groups set speaker_id = v_speaker_id where group_id = v_group_id;

  return v_group_id;
end;
$$;

grant execute on function public.accept_question_routing(uuid) to authenticated;
