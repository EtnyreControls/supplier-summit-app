-- Seeds a "vote for the best table" poll tied to the Growth Machine
-- Interactive Workshop event (mirrors 20260821140000_seed_session_polls_and_
-- feedback.sql's pattern: locked, auto-unlocks when that event completes).
--
-- Options are every current Growth Machine table name (1-12). The app
-- (polls/page.tsx) filters the signed-in attendee's own table out of the
-- options it renders, since "own table" varies per viewer and can't be
-- baked into the static options string here.

do $$
declare
  v_feedback_id uuid;
  v_event_id uuid;
  v_options text;
begin
  select event_id into v_event_id
  from public.event
  where event_name in ('Growth Machine: Interactive Supplier Workshop', 'Growth Machine - Interactive Workshop')
  order by start_time desc
  limit 1;

  if v_event_id is null then
    raise exception 'Growth Machine event not found';
  end if;

  select string_agg(table_name, ',' order by table_name::int) into v_options
  from public.event_tables
  where event_id = v_event_id;

  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Best Table', 'locked', false, v_event_id)
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options, response_group)
  values (v_feedback_id, 'Which table impressed you the most? (not your own)', 'mcq', v_options, 'poll');
end $$;
