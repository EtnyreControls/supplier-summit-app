-- Seeds the single anonymous "Summit feedback" survey that the Feedback tab
-- on /polls submits to (see FeedbackStepper in polls-page-client.tsx: a
-- 1-5 rating step, then a free-text step). Submission was previously
-- client-state-only with nothing persisted — this is the row it now writes
-- feedback_responses/feedback_answers against.
--
-- is_anonymous = true so the "submit own feedback response" RLS policy
-- allows respondent_id = null inserts (see init_schema.sql).

insert into public.feedback (feedback_id, feedback_name, description, status, is_anonymous)
values (
  '11111111-1111-4111-8111-111111111111',
  'Summit feedback',
  'Quick end-of-day pulse survey collected anonymously from attendees.',
  'live',
  true
)
on conflict (feedback_id) do nothing;

insert into public.feedback_questions (feedback_question_id, feedback_id, question_text, question_type)
values
  (
    '22222222-2222-4222-8222-222222222221',
    '11111111-1111-4111-8111-111111111111',
    'How valuable has today been for your partnership with Etnyre?',
    'rating'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Anything we should change or do more of?',
    'text'
  )
on conflict (feedback_question_id) do nothing;
