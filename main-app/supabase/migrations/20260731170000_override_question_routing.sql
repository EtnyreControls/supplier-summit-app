-- Lets analytics manually redirect a question to a specific, not-yet-tried
-- speaker — covers "I disagree with the ML pick" and "rescue an unrouted
-- question" alike. Mirrors nlp-service's route_question() insert shape but
-- is a controlled, audited entry point analytics calls directly, same
-- SECURITY DEFINER pattern as submit_question/verify_pin elsewhere in this
-- schema. Never touches questions/question_groups. The existing
-- (question_id, speaker_id) unique constraint still applies here exactly
-- as it does for automatic routing — analytics can't send a question to a
-- speaker who already declined/was already attempted for it.

create or replace function public.override_question_routing(p_question_id uuid, p_new_speaker_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_question_text text;
  v_attempt_number int;
  v_new_routing_id uuid;
begin
  if not is_analytics() then
    raise exception 'Only analytics can reassign question routing';
  end if;

  if exists (
    select 1 from public.question_routing
    where question_id = p_question_id and speaker_id = p_new_speaker_id
  ) then
    raise exception 'This question was already routed to that speaker before';
  end if;

  select question_text, attempt_number
    into v_question_text, v_attempt_number
    from public.question_routing
    where question_id = p_question_id
    order by attempt_number desc
    limit 1;

  if v_attempt_number is null then
    -- No routing history yet for this question at all.
    select submission_info into v_question_text from public.questions where question_id = p_question_id;
    v_attempt_number := 0;
  else
    update public.question_routing
      set status = 'reassigned', decided_at = now()
      where question_id = p_question_id and attempt_number = v_attempt_number
        and status in ('pending', 'accepted');
  end if;

  insert into public.question_routing (question_id, speaker_id, status, attempt_number, question_text)
  values (p_question_id, p_new_speaker_id, 'pending', v_attempt_number + 1, v_question_text)
  returning routing_id into v_new_routing_id;

  return v_new_routing_id;
end;
$$;

grant execute on function public.override_question_routing(uuid, uuid) to authenticated;
