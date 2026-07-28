-- Badge QR self-login currently trusts the scanning device unconditionally:
-- no session on that device -> mint one as the badge owner, no questions
-- asked (see handleQrScan in src/app/qr/actions.ts). That means a photo of
-- someone's badge QR is a standing, reusable login for that person's
-- account, since nothing checks whether the badge owner already has a
-- session running somewhere else.
--
-- has_active_session closes that: it lets the server ask "is this user
-- already logged in on some device?" before deciding whether the QR
-- self-login fast path is actually a fresh kiosk login (owner has no
-- session anywhere) or a second party replaying a captured QR while the
-- real owner is already active. SECURITY DEFINER because auth.sessions
-- isn't exposed to anon/authenticated directly.
create or replace function public.has_active_session(p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from auth.sessions
    where user_id = p_user_id
      and (not_after is null or not_after > now())
  );
$$;

grant execute on function public.has_active_session(uuid) to anon, authenticated;
