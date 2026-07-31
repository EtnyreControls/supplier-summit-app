-- Bug fix: override_question_routing()'s insert never set speaker_name, so
-- an analytics-reassigned row displayed "Unknown speaker" until the next
-- automatic route touched it. Looks the name up the same way
-- nlp-service's route_question() does (speakers -> user), safe here since
-- this function is already SECURITY DEFINER.

create or replace function public.override_question_routing(p_question_id uuid, p_new_speaker_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_question_text text;
  v_attempt_number int;
  v_speaker_name text;
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

  select trim(concat_ws(' ', u.first_name, u.last_name))
    into v_speaker_name
    from public.speakers s
    join public."user" u on u.user_id = s.user_id
    where s.speaker_id = p_new_speaker_id;

  select question_text, attempt_number
    into v_question_text, v_attempt_number
    from public.question_routing
    where question_id = p_question_id
    order by attempt_number desc
    limit 1;

  if v_attempt_number is null then
    select submission_info into v_question_text from public.questions where question_id = p_question_id;
    v_attempt_number := 0;
  else
    update public.question_routing
      set status = 'reassigned', decided_at = now()
      where question_id = p_question_id and attempt_number = v_attempt_number
        and status in ('pending', 'accepted');
  end if;

  insert into public.question_routing (question_id, speaker_id, status, attempt_number, question_text, speaker_name)
  values (p_question_id, p_new_speaker_id, 'pending', v_attempt_number + 1, v_question_text, v_speaker_name)
  returning routing_id into v_new_routing_id;

  return v_new_routing_id;
end;
$$;
