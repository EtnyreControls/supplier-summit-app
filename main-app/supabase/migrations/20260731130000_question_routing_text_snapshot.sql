-- Speakers (and the admin-visible unrouted view) need to read question text
-- without any new RLS policy on "questions" — out of scope per hard
-- constraint. Snapshotting text onto question_routing at routing time keeps
-- the entire speaker/admin read path inside the already-scoped new table.
alter table public.question_routing add column if not exists question_text text;
