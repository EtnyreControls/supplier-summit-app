-- Seeds the per-session poll/feedback surveys for the Supplier Summit agenda
-- and adds an auto-unlock trigger so each survey flips from 'locked' to
-- 'live' the moment its linked agenda session's status becomes 'completed'.
--
-- No existing "scheduled" feedback rows are removed here: the only feedback
-- row in the database is the anonymous end-of-day pulse survey
-- (11111111-1111-4111-8111-111111111111, status='live', event_id=null),
-- which stays untouched. The previously-referenced "scheduled polls" only
-- ever existed as hardcoded mock data in polls-page-client.tsx, not as DB
-- rows, so there is nothing to delete at the database level.
--
-- event_id mapping (confirmed against the live agenda; two surveys share a
-- session slot with another survey by design):
--   Executive Business Update -> f4d4c383-7e4e-4d0e-a8b6-8fee7450d440
--   Business Unit Gallery Walk -> d14e0216-4a24-486b-8603-3ce5d286f6c6
--   Global Growth & Strategic Sourcing -> 1ecf01ef-b001-4a4e-bca9-f8ace46917a5
--   Procurement & Operations -> f4d4c383-7e4e-4d0e-a8b6-8fee7450d440 (shares Executive Business Update slot)
--   Morning Feedback -> 9a08bbcf-2446-4b01-85db-18ef798e457f
--   Growth Machine Interactive Workshop -> 6cbf1179-d7b3-4157-a16a-71945768de09
--   Voice of Supplier -> 295b52d6-0047-46c2-b05e-1e73f0817ccb
--   End-of-Day Feedback -> 295b52d6-0047-46c2-b05e-1e73f0817ccb (shares Voice of Supplier slot)

-- Auto-unlock: when a linked event's status transitions to 'completed',
-- open every still-locked feedback survey tied to it.
create or replace function public.auto_unlock_feedback_on_event_complete()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    update public.feedback
    set status = 'live'
    where event_id = new.event_id
      and status = 'locked';
  end if;
  return new;
end;
$$;

create trigger auto_unlock_feedback_on_event_complete_trigger
  after update on public.event
  for each row
  execute function public.auto_unlock_feedback_on_event_complete();

do $$
declare
  v_feedback_id uuid;
begin
  -- 1. Executive Business Update: Etnyre's 7-Year Growth Strategy
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Executive Business Update: Etnyre''s 7-Year Growth Strategy', 'locked', false,
          'f4d4c383-7e4e-4d0e-a8b6-8fee7450d440')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'Do you understand how your organization can support Etnyre''s growth plans?', 'mcq', 'Yes,Partially,No'),
    (v_feedback_id, 'Which part of Etnyre''s growth strategy is most relevant to your organization?', 'text', null),
    (v_feedback_id, 'What support, information or resources would help your organization align with the strategy?', 'text', null),
    (v_feedback_id, 'What risks or challenges could affect your ability to support Etnyre''s growth?', 'text', null);

  -- 2. Business Unit Gallery Walk
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Business Unit Gallery Walk', 'locked', false, 'd14e0216-4a24-486b-8603-3ce5d286f6c6')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'Did the Gallery Walk improve your understanding of Etnyre''s business units?', 'mcq', 'Yes,Partially,No'),
    (v_feedback_id, 'How useful was the Gallery Walk in identifying potential opportunities?', 'rating', '1 - Not useful,2,3,4,5 - Extremely useful'),
    (v_feedback_id, 'Which business unit or opportunity was most relevant to your organization?', 'text', null),
    (v_feedback_id, 'What additional information would you like to receive about Etnyre''s business units?', 'text', null);

  -- 3. Global Growth & Strategic Sourcing
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Global Growth & Strategic Sourcing', 'locked', false, '1ecf01ef-b001-4a4e-bca9-f8ace46917a5')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'How clearly did you understand the difference between Strategic Sourcing and Procurement & Operations?', 'mcq', 'Very clear,Fairly clear,Not clear'),
    (v_feedback_id, 'Did the session help you understand how strategic sourcing supports Etnyre''s growth?', 'mcq', 'Yes,Partially,No'),
    (v_feedback_id, 'Where do you see the greatest opportunity for your organization to support Etnyre''s global growth?', 'text', null);

  -- 4. Procurement & Operations (shares Executive Business Update's event slot)
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Procurement & Operations', 'locked', false, 'f4d4c383-7e4e-4d0e-a8b6-8fee7450d440')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'Did the session help you understand how Procurement & Operations supports Etnyre''s growth?', 'mcq', 'Yes,Partially,No'),
    (v_feedback_id, 'How well does your organization currently meet Etnyre''s expectations for quality, delivery, cost and service?', 'rating', '1 - Significant improvement required,2,3,4,5 - Exceeds expectations'),
    (v_feedback_id, 'What could Etnyre or your organization do to improve day-to-day operational collaboration?', 'text', null);

  -- 5. Morning Feedback
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Morning Feedback', 'locked', false, '9a08bbcf-2446-4b01-85db-18ef798e457f')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'How excited are you to be part of Etnyre''s growth journey?', 'rating', '1 - Not excited,2,3,4,5 - Extremely excited'),
    (v_feedback_id, 'What was your biggest takeaway from the morning sessions?', 'text', null);

  -- 6. Growth Machine Interactive Workshop
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Growth Machine Interactive Workshop', 'locked', false, '6cbf1179-d7b3-4157-a16a-71945768de09')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'Did you enjoy the interactive Growth Machine workshop?', 'mcq', 'Yes,Partially,No'),
    (v_feedback_id, 'Did the workshop encourage meaningful collaboration and idea-sharing?', 'rating', '1 - Strongly disagree,2,3,4,5 - Strongly agree');

  -- 7. Voice of Supplier
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('Voice of Supplier', 'locked', false, '295b52d6-0047-46c2-b05e-1e73f0817ccb')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'Did you feel suppliers were given an appropriate opportunity to provide honest feedback?', 'mcq', 'Yes,Partially,No'),
    (v_feedback_id, 'How confident are you that Etnyre will consider and act on supplier feedback?', 'rating', '1 - Not confident,2,3,4,5 - Extremely confident'),
    (v_feedback_id, 'What is the most important change Etnyre could make to strengthen the supplier relationship', 'text', null);

  -- 8. End-of-Day Feedback (shares Voice of Supplier's event slot)
  insert into public.feedback (feedback_name, status, is_anonymous, event_id)
  values ('End-of-Day Feedback', 'locked', false, '295b52d6-0047-46c2-b05e-1e73f0817ccb')
  returning feedback_id into v_feedback_id;

  insert into public.feedback_questions (feedback_id, question_text, question_type, options) values
    (v_feedback_id, 'Did the summit increase your confidence in the future partnership with Etnyre?', 'rating', '1 - Strongly disagree,2,3,4,5 - Strongly agree'),
    (v_feedback_id, 'How likely are you to attend or recommend a future Etnyre Supplier Summit?', 'rating', '1 - Very unlikely,2,3,4,5 - Very likely'),
    (v_feedback_id, 'What did you enjoy most about the Supplier Summit?', 'text', null),
    (v_feedback_id, 'What excites you most following today''s discussions?', 'text', null),
    (v_feedback_id, 'What concerns, if any, do you have following today''s discussions?', 'text', null),
    (v_feedback_id, 'What should Etnyre add, remove or change at the next Supplier Summit?', 'text', null);
end $$;
