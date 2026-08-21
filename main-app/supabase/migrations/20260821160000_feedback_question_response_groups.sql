-- Splits each session survey's questions into two independent response
-- groups so a session can present, say, one single-question "Polls" card
-- plus a separate multi-question "Feedback" flow (or vice versa) rather
-- than grouping strictly by question_type. Per the latest content sign-off,
-- several rating/mcq questions move from the poll group into the combined
-- feedback flow for their session (see overrides below), and some sessions
-- end up with only one group populated.

alter table public.feedback_questions
  add column response_group text not null default 'poll'
  check (response_group in ('poll', 'feedback'));

update public.feedback_questions set response_group = 'poll' where question_type in ('mcq', 'rating');
update public.feedback_questions set response_group = 'feedback' where question_type = 'text';

-- Explicit overrides: choice-type questions moved into their session's
-- combined "Feedback (all in one)" flow instead of the "Polls" section.
update public.feedback_questions set response_group = 'feedback'
where feedback_question_id in (
  '9ce2e708-68ef-410c-9e9b-9b3582fa3393', -- Business Unit Gallery Walk: usefulness rating
  'fe18d03d-53c2-498a-977a-96ebbad5d21e', -- Procurement & Operations: quality/delivery rating
  '9cdef577-51e5-4f7b-b314-f69746cce00b', -- Morning Feedback: excitement rating
  '44fa1a42-cf05-4ff6-997b-5703461a1b8c', -- Voice of Supplier: honest-feedback mcq
  'b2262eef-421f-4968-84c1-4f5e4963b048', -- Voice of Supplier: confidence rating
  'aa697fd1-9dcf-46a8-bbe3-acbcfe770ac1'  -- End-of-Day Feedback: recommend-summit rating
);
