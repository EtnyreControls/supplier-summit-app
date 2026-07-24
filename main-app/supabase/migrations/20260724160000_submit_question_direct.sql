-- Routes attendee Q&A submissions straight into "questions" with no AI
-- grouping yet (that lands later — see README's RAG/Q&A description).
-- Every question still needs a group_id (not null per schema: "every
-- question is grouped at insertion"), so this creates a singleton
-- question_groups row alongside each submission — a 1:1 wrapper for now,
-- expected to later get consolidated once real grouping/merge logic exists.
--
-- SECURITY DEFINER because question_groups has no INSERT policy at all
-- (only speakers/analytics can view/answer routed groups — nothing lets a
-- plain attendee create one), so this is the one controlled entry point,
-- same pattern as verify_pin/verify_qr_token.

create or replace function public.submit_question(p_topic text, p_question text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group_id uuid;
  v_question_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to submit a question';
  end if;

  if p_question is null or btrim(p_question) = '' then
    raise exception 'Question text is required';
  end if;

  insert into public.question_groups (topic, composed_question, status, checked)
  values (p_topic, p_question, 'pending', false)
  returning group_id into v_group_id;

  insert into public.questions (topic, submission_info, submitter_id, group_id, status, checked)
  values (p_topic, p_question, auth.uid(), v_group_id, 'pending', false)
  returning question_id into v_question_id;

  return v_question_id;
end;
$$;

grant execute on function public.submit_question(text, text) to authenticated;
