-- Analytics needs to show which speaker a question is/was routed to, but
-- the analytics role has no RLS visibility into "user" (only "admin view
-- all users" / own-row select — analytics was never granted a broad read
-- there, and shouldn't be just for this). nlp-service already has
-- privileged access to speakers/user via its service-role client, so it
-- snapshots the name at routing time — same pattern as question_text — and
-- analytics reads it straight off question_routing, no new RLS anywhere.
alter table public.question_routing add column if not exists speaker_name text;
