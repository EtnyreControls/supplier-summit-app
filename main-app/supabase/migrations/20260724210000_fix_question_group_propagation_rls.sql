-- propagate_group_changes (the trigger that cascades question_groups.checked
-- and .status down to child questions rows) has always silently no-opped in
-- production: it's a plain trigger function, not SECURITY DEFINER, so its
-- `update questions ...` runs under the RLS context of whoever triggered
-- it (the analytics/speaker user updating question_groups). public.questions
-- has no UPDATE policy at all — only SELECT/INSERT — so RLS filters out
-- every row from that cascade UPDATE with no error, just 0 rows affected.
-- Confirmed against real data: checked-off groups had checked/status
-- correctly set, but their child questions rows never moved off
-- pending/unchecked, which is why submitters never saw their question's
-- status change.
--
-- Fix, matching the existing pattern for exactly this situation
-- (submit_question, assign_attendee_table, verify_pin are all
-- SECURITY DEFINER because they need to write across a table boundary RLS
-- doesn't otherwise permit): make the trigger function SECURITY DEFINER so
-- its cascade write bypasses RLS on questions, scoped narrowly to only the
-- two columns (checked, status) it already touched.

create or replace function public.propagate_group_changes()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.checked is distinct from old.checked or new.status is distinct from old.status then
    update questions
    set checked = new.checked,
        status = new.status
    where group_id = new.group_id;
  end if;
  return new;
end;
$$;

-- One-time backfill: repair questions rows left stuck pending/unchecked by
-- the RLS bug above, for groups that were already checked off before this
-- fix landed.
update public.questions q
set checked = qg.checked,
    status = qg.status
from public.question_groups qg
where q.group_id = qg.group_id
  and (q.checked is distinct from qg.checked or q.status is distinct from qg.status);
