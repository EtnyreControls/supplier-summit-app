-- Backs the real /polls page (see polls-page-client.tsx): attendees need to
-- see aggregate vote tallies for mcq/rating feedback_questions and cast one
-- vote each, without exposing other attendees' individual answers.
--
-- RLS on feedback_answers only lets a caller see rows joined to their own
-- feedback_responses (respondent_id = auth.uid()), so a plain select can
-- never show the group tally everyone else voted for. This mirrors the
-- submit_feedback() precedent (20260727121000_submit_feedback_direct.sql):
-- one controlled, definer-owned entry point instead of loosening RLS.

create or replace function public.get_feedback_vote_counts()
returns table (feedback_question_id uuid, answer_value text, vote_count bigint)
language sql
security definer
set search_path = public, extensions
stable
as $$
  select fa.feedback_question_id, fa.answer_value, count(*)::bigint
  from public.feedback_answers fa
  group by fa.feedback_question_id, fa.answer_value;
$$;

grant execute on function public.get_feedback_vote_counts() to authenticated;

-- Casts one vote for a single mcq/rating question. Dedup is per-question
-- (not per feedback survey) since a survey can bundle several poll
-- questions plus free-text ones, and voting on one shouldn't lock the rest.
create or replace function public.submit_poll_vote(p_feedback_question_id uuid, p_answer_value text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_feedback_id uuid;
  v_status public.feedback_status;
  v_response_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to vote';
  end if;

  select fq.feedback_id, f.status into v_feedback_id, v_status
  from public.feedback_questions fq
  join public.feedback f on f.feedback_id = fq.feedback_id
  where fq.feedback_question_id = p_feedback_question_id;

  if v_feedback_id is null then
    raise exception 'Poll question not found';
  end if;

  if v_status <> 'live' then
    raise exception 'This poll is not open right now';
  end if;

  if exists (
    select 1
    from public.feedback_answers fa
    join public.feedback_responses fr on fr.feedback_response_id = fa.feedback_response_id
    where fa.feedback_question_id = p_feedback_question_id
      and fr.respondent_id = auth.uid()
  ) then
    raise exception 'You already voted on this poll';
  end if;

  insert into public.feedback_responses (feedback_id, respondent_id)
  values (v_feedback_id, auth.uid())
  returning feedback_response_id into v_response_id;

  insert into public.feedback_answers (feedback_question_id, feedback_response_id, answer_value)
  values (p_feedback_question_id, v_response_id, p_answer_value);

  return v_response_id;
end;
$$;

grant execute on function public.submit_poll_vote(uuid, text) to authenticated;
