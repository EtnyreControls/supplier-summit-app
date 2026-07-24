-- The poll_* tables were actually modeling event feedback forms, not a
-- distinct "polls" concept — renaming to feedback_* accordingly. What
-- "polls" should actually be is being revisited separately later; this is
-- a pure rename, no structural/behavioral changes. Nothing in the app code
-- references any of these identifiers yet, so no frontend changes needed.
--
-- Renaming a table/type in Postgres carries its RLS policies, FKs, and
-- table-prefixed index/constraint names along automatically (tracked by
-- OID, not name) — only column names need explicit renaming.

alter type public.poll_status rename to feedback_status;
alter type public.question_type rename to feedback_question_type;

alter table public.polls rename to feedback;
alter table public.poll_questions rename to feedback_questions;
alter table public.poll_responses rename to feedback_responses;
alter table public.poll_answers rename to feedback_answers;
alter table public.poll_submission_status rename to feedback_submission_status;

alter table public.feedback rename column poll_id to feedback_id;
alter table public.feedback rename column poll_name to feedback_name;

alter table public.feedback_questions rename column poll_question_id to feedback_question_id;
alter table public.feedback_questions rename column poll_id to feedback_id;

alter table public.feedback_responses rename column poll_response_id to feedback_response_id;
alter table public.feedback_responses rename column poll_id to feedback_id;

alter table public.feedback_answers rename column poll_answer_id to feedback_answer_id;
alter table public.feedback_answers rename column poll_question_id to feedback_question_id;
alter table public.feedback_answers rename column poll_response_id to feedback_response_id;

alter table public.feedback_submission_status rename column poll_id to feedback_id;
