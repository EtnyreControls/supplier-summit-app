-- Routes the anonymous Summit-feedback survey (rating + free-text step,
-- see FeedbackStepper in polls-page-client.tsx) into feedback_responses /
-- feedback_answers.
--
-- SECURITY DEFINER because, unlike submit_question, this isn't a missing-
-- policy problem: feedback_responses/feedback_answers DO have INSERT
-- policies for the anonymous case (respondent_id is null + feedback.
-- is_anonymous = true). The problem is downstream of the insert — the
-- feedback_answers INSERT policy's WITH CHECK does
-- `exists (select 1 from feedback_responses where ...)`, and that subquery
-- is itself subject to feedback_responses' SELECT policy ("view own poll
-- response", respondent_id = auth.uid()). Since we intentionally insert
-- respondent_id = null (anonymous), that row is invisible to the caller's
-- own subquery, so the answers insert would fail RLS even though the
-- attendee is exactly who's supposed to be allowed to submit. Same
-- resolution as submit_question: one controlled, definer-owned entry point
-- that does both inserts atomically instead of patching the policy chain.

create or replace function public.submit_feedback(p_rating text, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_feedback_id uuid;
  v_rating_question_id uuid;
  v_text_question_id uuid;
  v_response_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to submit feedback';
  end if;

  select feedback_id into v_feedback_id
  from public.feedback
  where status = 'live' and is_anonymous = true
  order by created_at desc
  limit 1;

  if v_feedback_id is null then
    raise exception 'No feedback survey is currently open';
  end if;

  select feedback_question_id into v_rating_question_id
  from public.feedback_questions
  where feedback_id = v_feedback_id and question_type = 'rating'
  limit 1;

  select feedback_question_id into v_text_question_id
  from public.feedback_questions
  where feedback_id = v_feedback_id and question_type = 'text'
  limit 1;

  insert into public.feedback_responses (feedback_id, respondent_id)
  values (v_feedback_id, null)
  returning feedback_response_id into v_response_id;

  if v_rating_question_id is not null and p_rating is not null and btrim(p_rating) <> '' then
    insert into public.feedback_answers (feedback_question_id, feedback_response_id, answer_value)
    values (v_rating_question_id, v_response_id, p_rating);
  end if;

  if v_text_question_id is not null and p_comment is not null and btrim(p_comment) <> '' then
    insert into public.feedback_answers (feedback_question_id, feedback_response_id, answer_value)
    values (v_text_question_id, v_response_id, p_comment);
  end if;

  return v_response_id;
end;
$$;

grant execute on function public.submit_feedback(text, text) to authenticated;
