-- Tracks when a question_groups row was last checked off, so the analytics
-- dashboard can order addressed questions by actual check-off time instead
-- of an in-memory-only counter. Cleared on uncheck since a null checked_at
-- unambiguously means "not currently addressed".

alter table public.question_groups add column checked_at timestamptz;

create or replace function public.set_checked_at()
returns trigger
language plpgsql
as $$
begin
  if new.checked is distinct from old.checked then
    new.checked_at = case when new.checked then now() else null end;
  end if;
  return new;
end;
$$;

create trigger set_checked_at_trigger
  before update on public.question_groups
  for each row
  execute function public.set_checked_at();
