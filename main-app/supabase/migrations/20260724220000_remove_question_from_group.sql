-- Lets analytics manually split a question back out of its AI-merged group
-- (the auto-grouping pipeline is best-effort similarity matching, not
-- always right — this is the human override). Detaching a question moves
-- it into a brand-new singleton group, same shape submit_question() creates
-- for a fresh submission, and resets its own status/checked back to
-- pending/false since it's now unreviewed again. If that was the last
-- question in the old group, the now-empty group is deleted.
--
-- SECURITY DEFINER for two reasons: question_groups has no INSERT policy
-- (same reason submit_question needs it), and questions has no UPDATE
-- policy at all (the same gap that broke propagate_group_changes — see the
-- fix_question_group_propagation_rls migration). Restricted to the
-- analytics role explicitly, since unlike submit_question this isn't meant
-- to be callable by any attendee.

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
  if not is_analytics() then
    raise exception 'Only analytics can remove a question from its group';
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

grant execute on function public.remove_question_from_group(uuid) to authenticated;
