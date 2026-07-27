-- Adds an anonymity toggle and a fixed topic tag to attendee question
-- submissions. Topic stays the existing free varchar(200) column (no new
-- enum) — the frontend just constrains the picker to a fixed short list for
-- now ("General" / "Growth Journey" / "Growth Machine"); nothing here
-- enforces that at the DB level, same as question status today.
--
-- is_anonymous is a display-only flag: submitter_id is still recorded on
-- every question (needed for the existing "view own questions" /
-- "submit own questions" RLS policies, and for abuse follow-up), it's just
-- not shown to speakers/analytics for anonymous submissions. This differs
-- from feedback_responses, which nulls respondent_id outright — questions
-- don't have an equivalent "submitted by" display anywhere yet, so there's
-- nothing to hide from today; this flag exists so that whenever such a
-- display is built, anonymous submissions are excluded from it correctly.

alter table public.questions
  add column if not exists is_anonymous boolean not null default false;

-- Postgres overloads functions by argument signature rather than replacing
-- them, so the old 2-arg version has to be dropped explicitly or both would
-- exist side by side and any 2-arg caller left in old cached PostgREST
-- schema would keep silently hitting the version with no anonymity support.
drop function if exists public.submit_question(text, text);

create or replace function public.submit_question(p_topic text, p_question text, p_is_anonymous boolean default false)
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

  insert into public.questions (topic, submission_info, submitter_id, group_id, status, checked, is_anonymous)
  values (p_topic, p_question, auth.uid(), v_group_id, 'pending', false, coalesce(p_is_anonymous, false))
  returning question_id into v_question_id;

  return v_question_id;
end;
$$;

grant execute on function public.submit_question(text, text, boolean) to authenticated;
