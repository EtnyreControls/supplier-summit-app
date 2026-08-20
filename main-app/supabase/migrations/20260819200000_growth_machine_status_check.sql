-- Read-only counterpart to enter_growth_machine(): lets /growth-machine
-- check "has this table already submitted?" before showing the role
-- picker, without enter_growth_machine's side effect of claiming/releasing
-- the builder seat just from loading the page.

create or replace function public.get_growth_machine_status()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_table_id uuid;
  v_is_builder boolean := false;
  v_has_submission boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('table_id', null, 'is_builder', false, 'has_submission', false);
  end if;

  select table_id, is_builder into v_table_id, v_is_builder
  from public.event_table_members
  where user_id = auth.uid()
  limit 1;

  if v_table_id is not null then
    select exists(
      select 1 from public.growth_machine_boards where table_id = v_table_id
    ) into v_has_submission;
  end if;

  return jsonb_build_object('table_id', v_table_id, 'is_builder', v_is_builder, 'has_submission', v_has_submission);
end;
$$;

grant execute on function public.get_growth_machine_status() to authenticated;
