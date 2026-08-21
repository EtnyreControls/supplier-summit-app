-- Locks an account out after 3 failed PIN attempts. Admins are exempt (same
-- carve-out as the bulk PIN reset in 20260821180000_force_pin_change.sql) —
-- they're never tracked or locked, so admin/login keeps working unchanged.
--
-- verify_pin() keeps its exact name/signature (uuid in, uuid out) so both
-- callers (login/actions.ts, admin/login/actions.ts) need no changes beyond
-- attendee login handling the new lockout message — is_login_locked() is
-- the only new surface, called after a failed verify_pin to tell "wrong
-- PIN" apart from "already locked" without ever exposing the pin hash.

alter table public."user"
  add column failed_login_attempts integer not null default 0,
  add column locked_at timestamptz;

create or replace function public.verify_pin(p_unique_id text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_pin_hash text;
  v_locked_at timestamptz;
  v_attempts integer;
begin
  select user_id, role, pin, locked_at, failed_login_attempts
    into v_user_id, v_role, v_pin_hash, v_locked_at, v_attempts
  from public."user"
  where unique_id = p_unique_id;

  if v_user_id is null or v_pin_hash is null then
    return null;
  end if;

  if v_role = 'admin' then
    if crypt(p_pin, v_pin_hash) = v_pin_hash then
      return v_user_id;
    end if;
    return null;
  end if;

  -- Already locked — don't even check the PIN, and don't keep bumping the
  -- attempt count past the lock.
  if v_locked_at is not null then
    return null;
  end if;

  if crypt(p_pin, v_pin_hash) = v_pin_hash then
    update public."user" set failed_login_attempts = 0 where user_id = v_user_id;
    return v_user_id;
  end if;

  update public."user"
  set failed_login_attempts = v_attempts + 1,
      locked_at = case when v_attempts + 1 >= 3 then now() else null end
  where user_id = v_user_id;

  return null;
end;
$$;

grant execute on function public.verify_pin(text, text) to anon, authenticated;

create or replace function public.is_login_locked(p_unique_id text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(locked_at is not null, false)
  from public."user"
  where unique_id = p_unique_id;
$$;

grant execute on function public.is_login_locked(text) to anon, authenticated;
