-- Lets admin accounts use the /analytics view (previously analytics-role
-- only). Most of what /analytics reads is already covered for admin: the
-- 20260820120000_admin_panel_live_state.sql migration granted "for all
-- using (is_admin())" on question_groups/questions/question_routing/
-- feedback_topic_*/growth_machine_*, which includes select. What's left:
--
-- 1. feedback_responses/feedback_answers/feedback_submission_status (the
--    poll-response tables — renamed from poll_responses/poll_answers/
--    poll_submission_status by a later migration than the one this repo's
--    RLS grep first suggested) only ever had an analytics-gated select
--    policy, no admin equivalent — added below.
-- 2. override_question_routing() and remove_question_from_group() are
--    SECURITY DEFINER functions with an explicit `if not is_analytics()`
--    check inside the function body (not RLS, so granting a table policy
--    wouldn't have helped) — relaxed to accept either role below.

create policy "admin view all poll responses" on public.feedback_responses for select using (is_admin());
create policy "admin view all poll answers" on public.feedback_answers for select using (is_admin());
create policy "admin view all submission status" on public.feedback_submission_status for select using (is_admin());

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
  if not (is_analytics() or is_admin()) then
    raise exception 'Only analytics or admin can reassign question routing';
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

create or replace function public.remove_question_from_group(p_question_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old_group_id uuid;
  v_new_group_id uuid;
  v_text text;
  v_topic varchar(200);
  v_remaining int;
begin
  if not (is_analytics() or is_admin()) then
    raise exception 'Only analytics or admin can remove a question from its group';
  end if;

  select group_id, submission_info, topic into v_old_group_id, v_text, v_topic
  from public.questions
  where question_id = p_question_id;

  if v_old_group_id is null then
    raise exception 'Question not found';
  end if;

  insert into public.question_groups (topic, composed_question, status, checked)
  values (v_topic, v_text, 'pending', false)
  returning group_id into v_new_group_id;

  update public.questions
  set group_id = v_new_group_id, status = 'pending', checked = false
  where question_id = p_question_id;

  select count(*) into v_remaining from public.questions where group_id = v_old_group_id;
  if v_remaining = 0 then
    delete from public.question_groups where group_id = v_old_group_id;
  end if;

  return v_new_group_id;
end;
$$;
