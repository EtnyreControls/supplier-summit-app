# Supplier Summit — Row Level Security & Data Protection Reference

```markdown
# Supplier Summit — Row Level Security & Data Protection Reference

*Prepared for IT review. Covers all RLS policies as designed, plus supplementary risk measures beyond RLS.*

---

## 1. Role Model & Helper Functions

Four roles, resolved via a shared PIN (unique per role) + unique `user_id` — individual identity is always resolvable via `auth.uid()`, regardless of shared credentials.

```sql
create or replace function current_role_name()
returns varchar as $$
  select role::text from "user" where user_id = auth.uid();
$$ language sql security definer stable;

create or replace function is_admin() returns boolean as $$
  select current_role_name() = 'admin';
$$ language sql security definer stable;

create or replace function is_analytics() returns boolean as $$
  select current_role_name() = 'analytics';
$$ language sql security definer stable;

create or replace function is_speaker() returns boolean as $$
  select current_role_name() = 'speaker';
$$ language sql security definer stable;
```

**Drawback:** these functions run `security definer`, meaning they execute with the function owner's privileges rather than the caller's. This is necessary to avoid a chicken-and-egg problem (a caller needs to query `"user"` to know their own role, but might not yet have a policy granting that access) — but it means these four functions are a concentrated point of trust. If compromised or altered, every downstream policy that calls them is compromised. They should be owned by a locked-down role, not left owned by whichever developer account created them first, and any future edits to these functions should go through the same review rigor as a schema migration.

---

## 2. Table-by-Table Policies

### `user`
```sql
alter table "user" enable row level security;

create policy "view own user row" on "user" for select
using (user_id = auth.uid());

create policy "admin view all users" on "user" for select
using (is_admin());

create policy "update own user row" on "user" for update
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "admin update all users" on "user" for update
using (is_admin()) with check (is_admin());

create policy "admin insert users" on "user" for insert
with check (is_admin());
```

**Supplementary trigger** — RLS `with check` validates row-level conditions, not column-level ones, so a user could technically submit an update that includes a changed `role` field even though `user_id = auth.uid()` still holds. This trigger closes that gap:

```sql
create or replace function prevent_self_role_change()
returns trigger as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only admin can change a user''s role';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger prevent_self_role_change_trigger
before update on "user"
for each row execute function prevent_self_role_change();
```

**Drawback:** self-service profile edits (e.g., updating phone/email) and privileged role escalation both pass through the *same* update path, distinguished only by which column changed. This trigger is the only thing preventing privilege escalation via a crafted request — if it's ever accidentally dropped during a migration, the RLS policy alone will not catch it.

---

### `speakers`, `event`, `transcript`
Same shape across all three: public read for any authenticated session, admin-only writes.

```sql
alter table speakers enable row level security;
alter table "event" enable row level security;
alter table transcript enable row level security;

-- repeat per table:
create policy "view all <table>" on <table> for select
using (auth.role() = 'authenticated');

create policy "admin insert <table>" on <table> for insert
with check (is_admin());

create policy "admin update <table>" on <table> for update
using (is_admin()) with check (is_admin());

create policy "admin delete <table>" on <table> for delete
using (is_admin());
```

**`event` also has an automated status pipeline:**
```sql
alter table "event" add column start_time timestamptz, add column end_time timestamptz, add column status_override boolean default false;
```
A `pg_cron` job (`security definer`, runs as background Postgres role — bypasses RLS by design, not a client request) transitions `status` automatically based on `start_time`/`end_time`. A trigger flags `status_override = true` whenever a real user session (`auth.uid() is not null`) manually changes status, so the automated job skips overridden rows going forward except for the final "mark completed" transition, which always fires regardless of override.

**Drawback — `transcript` writes:** insert/update for transcript content will come from a backend `service_role` key (transcription pipeline), which bypasses RLS entirely. The admin-only policies here are a fallback, not the actual access path. This means the real security boundary for transcript writes is **how tightly the `service_role` key is held on the backend**, not these policies — if that key leaks, RLS on this table provides no protection at all, since `service_role` ignores RLS unconditionally.

---

### `question_groups`, `questions`

```sql
alter table question_groups enable row level security;
alter table questions enable row level security;

-- questions
create policy "submit own questions" on questions for insert
with check (submitter_id = auth.uid());

create policy "view own questions" on questions for select
using (submitter_id = auth.uid());

create policy "analytics view all questions" on questions for select
using (is_analytics());

-- question_groups
create policy "view own question group" on question_groups for select
using (exists (
  select 1 from questions
  where questions.group_id = question_groups.group_id
  and questions.submitter_id = auth.uid()
));

create policy "speaker view routed groups" on question_groups for select
using (speaker_id in (select speaker_id from speakers where user_id = auth.uid()));

create policy "analytics view all groups" on question_groups for select
using (is_analytics());

create policy "speaker answer routed groups" on question_groups for update
using (speaker_id in (select speaker_id from speakers where user_id = auth.uid()))
with check (speaker_id in (select speaker_id from speakers where user_id = auth.uid()));

create policy "analytics manage all groups" on question_groups for update
using (is_analytics()) with check (is_analytics());
```

**Supplementary triggers:**
```sql
-- propagate checked/status changes from group down to every member question
create or replace function propagate_group_changes() returns trigger as $$
begin
  if new.checked is distinct from old.checked or new.status is distinct from old.status then
    update questions set checked = new.checked, status = new.status where group_id = new.group_id;
  end if;
  return new;
end; $$ language plpgsql;

create trigger propagate_group_changes_trigger
after update on question_groups for each row execute function propagate_group_changes();

-- auto-stamp answered_at
create or replace function set_answered_at() returns trigger as $$
begin
  if new.status = 'answered' and old.status is distinct from new.status then
    new.answered_at = now();
  end if;
  return new;
end; $$ language plpgsql;

create trigger set_answered_at_trigger
before update on question_groups for each row execute function set_answered_at();
```

**Drawback:** there is intentionally **no insert policy on `question_groups`** — group creation only happens via the ML clustering pipeline (`service_role`). If that pipeline is ever exposed to client-side calls instead of a locked-down backend job, this table has no RLS insert protection at all to fall back on.

---

### `polls`, `poll_questions`, `poll_responses`, `poll_answers`, `poll_submission_status`

```sql
alter table polls enable row level security;
alter table poll_questions enable row level security;
alter table poll_responses enable row level security;
alter table poll_answers enable row level security;
alter table poll_submission_status enable row level security;

-- polls
create policy "view all polls" on polls for select using (auth.role() = 'authenticated');
create policy "admin insert polls" on polls for insert with check (is_admin());
create policy "admin update polls" on polls for update using (is_admin()) with check (is_admin());
create policy "analytics update poll status" on polls for update using (is_analytics()) with check (is_analytics());

-- poll_questions
create policy "view all poll questions" on poll_questions for select using (auth.role() = 'authenticated');
create policy "admin manage poll questions" on poll_questions for insert with check (is_admin());
create policy "admin update poll questions" on poll_questions for update using (is_admin()) with check (is_admin());

-- poll_responses
create policy "submit own poll response" on poll_responses for insert
with check (
  respondent_id = auth.uid()
  or (respondent_id is null and exists (
    select 1 from polls where polls.poll_id = poll_responses.poll_id and polls.is_anonymous = true
  ))
);
create policy "view own poll response" on poll_responses for select using (respondent_id = auth.uid());
create policy "analytics view all poll responses" on poll_responses for select using (is_analytics());

-- poll_answers
create policy "submit own poll answers" on poll_answers for insert
with check (exists (
  select 1 from poll_responses
  where poll_responses.poll_response_id = poll_answers.poll_response_id
  and (poll_responses.respondent_id = auth.uid() or poll_responses.respondent_id is null)
));
create policy "view own poll answers" on poll_answers for select
using (exists (
  select 1 from poll_responses
  where poll_responses.poll_response_id = poll_answers.poll_response_id
  and poll_responses.respondent_id = auth.uid()
));
create policy "analytics view all poll answers" on poll_answers for select using (is_analytics());

-- poll_submission_status
create policy "manage own submission status" on poll_submission_status for insert with check (user_id = auth.uid());
create policy "update own submission status" on poll_submission_status for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "view own submission status" on poll_submission_status for select using (user_id = auth.uid());
create policy "analytics view all submission status" on poll_submission_status for select using (is_analytics());
```

**Known, accepted gap:** the `poll_answers` insert policy allows any authenticated user to insert an answer row against **any** anonymous response (`respondent_id is null`), not only the one they just created — because once anonymized, there is no column left to verify "this is the same person." **Mitigation is application-layer, not database-layer:** the submission flow must create the `poll_responses` row and its associated `poll_answers` rows within a single request/transaction, closing the window before a second party could interject.

---

### `event_tables`, `event_table_members`, `growth_machine_entries`, `growth_machine_votes`

```sql
alter table event_tables enable row level security;
alter table event_table_members enable row level security;
alter table growth_machine_entries enable row level security;
alter table growth_machine_votes enable row level security;

-- event_tables
create policy "view all tables" on event_tables for select using (auth.role() = 'authenticated');
create policy "admin manage tables" on event_tables for insert with check (is_admin());
create policy "admin update tables" on event_tables for update using (is_admin()) with check (is_admin());

-- event_table_members
create policy "view table members" on event_table_members for select using (auth.role() = 'authenticated');
create policy "admin manage table members" on event_table_members for insert with check (is_admin());
create policy "admin update table members" on event_table_members for update using (is_admin()) with check (is_admin());

-- growth_machine_entries (insert-only — no update/delete policy means entries are immutable once submitted, by omission)
create policy "view all gm entries" on growth_machine_entries for select using (auth.role() = 'authenticated');
create policy "builder submit entries" on growth_machine_entries for insert
with check (exists (
  select 1 from event_table_members
  where event_table_members.table_id = growth_machine_entries.table_id
  and event_table_members.user_id = auth.uid()
  and event_table_members.is_builder = true
));

-- growth_machine_votes
create policy "view all gm votes" on growth_machine_votes for select using (auth.role() = 'authenticated');
create policy "cast own vote" on growth_machine_votes for insert with check (voter_uid = auth.uid());
```

**Structural safeguard, not RLS:** one-vote-per-person is enforced by the table's primary key `(voter_uid, event_id)` — a duplicate insert fails at the constraint level regardless of what any policy allows, which is a stronger guarantee than RLS alone provides (RLS governs whether a query is *attempted*, not whether the underlying data model permits the result).

---

## 3. Risk Measures Beyond RLS

RLS governs *row-level authorization* once a request reaches Postgres — it does nothing for the layers before that. Areas still needing explicit attention:

### Injection & input handling
- **Supabase's client library (`@supabase/supabase-js`) parameterizes all queries by default** when using its query builder — raw string concatenation into `.rpc()` or `.from().select()` calls is the actual injection risk, not the query builder itself. Any place the app constructs raw SQL (e.g., inside `security definer` functions like `hash_pin`) must use parameterized inputs, never string-interpolate user input into dynamic SQL (`execute format(...)` patterns are a common injection vector inside PL/pgSQL if built carelessly).
- **PIN handling**: raw PINs must never be logged, displayed in error messages, or passed through client-visible query strings. Hashing happens via a `before insert/update` trigger using `pgcrypto`'s `crypt()`/`gen_salt('bf')`, so the raw value never persists — but the *login check* itself should be a `security definer` RPC function server-side, not a raw `select` comparing plaintext, so the hashed value is never returned to the client for comparison.

### Key management
- **`service_role` key bypasses RLS entirely** and is used for: the ML question-grouping pipeline, the transcription backend, and the `pg_cron` event-status automation. This key must live only in backend environment variables, never in any client bundle, mobile app, or public repo. Anyone holding this key has unrestricted read/write across every table regardless of the policies documented above — it is a bigger single point of failure than any individual RLS policy.
- **`anon`/publishable key** is safe for client exposure by design (RLS is the actual gate), but should still be scoped to only the Supabase project's public API, with CORS/allowed origins locked to your app's actual domain(s) rather than left open.

### Rate limiting & abuse
- No current policy prevents a single authenticated user from submitting an unbounded number of `questions`, `growth_machine_entries` (if they were somehow granted builder status improperly), or `poll_responses` beyond the natural one-per-poll constraint. For a live event with ~120 known attendees this is low-risk, but Supabase/PostgREST rate limiting (or a simple `created_at`-based throttle trigger) is worth adding if abuse becomes a concern.

### Data minimization
- Per the stated model: **only `admin` can ever access `user`'s PII fields** (name, phone, email) beyond a person's own row. This is enforced correctly by the `user` table policies above — no other role's policies grant broad `select` on `user`, including `analytics`, which only sees question/poll/GM content, not identity fields directly (though `submitter_id`/`voter_uid` foreign keys mean analytics *can* infer participation patterns per `user_id`, even without reading the `user` table itself — worth being explicit with stakeholders that "analytics can't see PII" means they can't see name/email/phone, not that submissions are fully anonymous to them).

### Backup & audit
- **No audit logging is currently designed into this schema** — if you need to answer "who changed this event's status" or "who edited this speaker bio" after the fact, that requires either Supabase's built-in Postgres logs (retained per your plan tier) or an explicit `audit_log` table populated by triggers on admin-writable tables. Given the single-admin structural model, this may be lower priority, but worth flagging as a gap if a security review asks for change traceability.
```
