-- Unified badge QR: the same code drives both auto-login and contact
-- sharing (see docs discussion — one token, two behaviors chosen by
-- session state at scan time, not by the QR itself):
--
--   * No active session on the scanning device -> self-login as the badge
--     owner (kiosk / fresh phone scanning your own badge).
--   * Active session already exists -> never switch identity. Instead pull
--     the badge owner's opted-in contact fields (share_email/phone/company)
--     and save them into the scanner's contacts list.
--
-- Unlike the PIN, the raw token must be redisplayed to its owner on demand
-- (the in-app "My badge QR" button), so it's stored as plaintext rather
-- than hashed like `pin` — already covered by the existing "view own user
-- row" / "admin view all users" RLS policies. Acceptable here since badge
-- QR codes are only issued to the lowest-privilege attendee tier.

alter table public."user" add column if not exists qr_token varchar(64);
alter table public."user" add constraint user_qr_token_key unique (qr_token);

-- verify_qr_token: SECURITY DEFINER so an unauthenticated scanner (no
-- auth.uid() yet, e.g. self-login on a fresh device) can still resolve a
-- token to the owning user_id without RLS getting in the way.
create or replace function public.verify_qr_token(p_token text)
returns uuid
language sql
stable security definer
set search_path = public, extensions
as $$
  select user_id from public."user" where qr_token = p_token;
$$;

grant execute on function public.verify_qr_token(text) to anon, authenticated;

-- contacts: what a scanner saves when they scan someone ELSE's badge while
-- already signed in. Snapshotted at scan time (not a live join) so it
-- reflects what was actually shared at that moment, even if the other
-- person later changes their share toggles or info.
create table public.contacts (
  owner_id uuid not null references public."user" (user_id) on update cascade on delete cascade,
  contact_user_id uuid not null references public."user" (user_id) on update cascade on delete cascade,
  first_name varchar(100),
  last_name varchar(100),
  company varchar(150),
  email varchar(255),
  phone varchar(30),
  saved_at timestamptz not null default now(),
  primary key (owner_id, contact_user_id),
  constraint contacts_not_self check (owner_id <> contact_user_id)
);

alter table public.contacts enable row level security;

create policy "view own contacts" on public.contacts for select using (owner_id = auth.uid());
create policy "save own contacts" on public.contacts for insert with check (owner_id = auth.uid());
create policy "update own contacts" on public.contacts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own contacts" on public.contacts for delete using (owner_id = auth.uid());
