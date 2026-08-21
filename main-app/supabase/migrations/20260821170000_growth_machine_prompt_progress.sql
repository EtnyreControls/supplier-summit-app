-- Wires up the previously-unused growth_machine_entries table (part enum:
-- engine/fuel/gears/brakes/turbo_boost — matches components/text.tsx's
-- PROMPT_HEADINGS 1:1) so the Builder's progress through the 5 prompts is
-- visible live, instead of only knowing "not started / building /
-- submitted" from the one final growth_machine_boards snapshot.
--
-- One row per (table_id, part): the Builder submits a short text summary as
-- they finish each prompt (not the drawing itself — that still lives in the
-- tldraw sync room until the final board snapshot). Same controlled-entry
-- SECURITY DEFINER pattern as submit_growth_machine_board(), since the
-- existing "builder submit entries" INSERT policy alone can't support the
-- upsert-on-resubmit case (a Builder revising a prompt they already
-- recorded).

alter table public.growth_machine_entries
  add constraint growth_machine_entries_table_part_unique unique (table_id, part);

create or replace function public.submit_growth_machine_prompt(
  p_table_id uuid,
  p_part public.machine_part,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to submit';
  end if;

  if not exists (
    select 1 from public.event_table_members
    where table_id = p_table_id
      and user_id = auth.uid()
      and is_builder
  ) then
    raise exception 'Only the table''s current builder can submit prompts';
  end if;

  insert into public.growth_machine_entries (table_id, part, content, submitted_by)
  values (p_table_id, p_part, coalesce(p_content, ''), auth.uid())
  on conflict (table_id, part) do update
    set content = excluded.content, submitted_by = excluded.submitted_by, created_at = now();
end;
$$;

grant execute on function public.submit_growth_machine_prompt(uuid, public.machine_part, text) to authenticated;
