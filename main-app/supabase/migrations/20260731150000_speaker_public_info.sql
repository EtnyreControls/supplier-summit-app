-- Pre-existing gap found while adding real agenda data: "user" RLS only
-- has "view own user row" / "admin view all users" — no policy lets a
-- regular attendee see a speaker's name at all, so agenda/page.tsx's
-- speakers.user(...) embed has always silently resolved to null for
-- non-admins. Fixing this with a broader "user" RLS policy would expose the
-- whole row (email, phone) for anyone with a speakers row, to every
-- attendee — narrower to follow this file's existing pattern (is_admin(),
-- verify_pin(), submit_question()) instead: a SECURITY DEFINER function
-- that only ever returns the 3 columns agenda/page.tsx actually needs, and
-- only for users who are actually speakers.

create or replace function public.speaker_public_info()
returns table (user_id uuid, first_name varchar, last_name varchar, company varchar)
language sql
stable security definer
set search_path = public, extensions
as $$
  select u.user_id, u.first_name, u.last_name, u.company
  from public."user" u
  where exists (select 1 from public.speakers s where s.user_id = u.user_id);
$$;

grant execute on function public.speaker_public_info() to authenticated;
