-- Resets every non-admin account's PIN to a shared placeholder and adds a
-- `must_change_pin` flag so the proxy auth gate (src/proxy.ts) can force a
-- one-time PIN change before letting them reach anywhere else in the app.
--
-- hash_pin_trigger only rehashes when new.pin is distinct from old.pin — it
-- compares the plaintext being written against the *hashed* old value, so
-- writing the same plaintext to every row still rehashes each one (with its
-- own bcrypt salt) rather than silently no-op'ing.

alter table public."user"
  add column must_change_pin boolean not null default true;

-- Admin accounts keep their current PIN and are never forced through the
-- change-PIN gate.
update public."user" set must_change_pin = false where role = 'admin';

-- Attendees, speakers, and analytics accounts all reset to the same
-- placeholder PIN and must change it on next login.
update public."user"
set pin = 'EtnyreSummit2026', must_change_pin = true
where role <> 'admin';
