"use server";

import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the caller's Growth Machine table and claims (or releases) the
 * builder seat — see enter_growth_machine() in the
 * growth_machine_board_sync migration. Runs as the caller so auth.uid()
 * inside the function is the real signed-in user.
 *
 * tableId null means the caller has no table assignment (staff roles, or
 * not signed in during local dev) — callers fall back to the shared
 * "default" sync room, the pre-database behavior.
 */
export async function enterGrowthMachine(asBuilder: boolean): Promise<{
  tableId: string | null;
  isBuilder: boolean;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enter_growth_machine", {
    p_as_builder: asBuilder,
  });

  if (error) {
    return { tableId: null, isBuilder: false, error: "Couldn't join the board. Please try again." };
  }
  const row = data as { table_id: string | null; is_builder: boolean };
  return { tableId: row.table_id, isBuilder: row.is_builder, error: null };
}

/**
 * Persists a finished board (the tldraw document snapshot) for the
 * caller's table. The database rejects anyone who isn't that table's
 * current builder — see submit_growth_machine_board().
 */
export async function submitGrowthMachineBoard(
  tableId: string,
  snapshot: unknown,
): Promise<{ error: string | null }> {
  if (!UUID_RE.test(tableId)) {
    return { error: "No table assigned — the board wasn't saved." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_growth_machine_board", {
    p_table_id: tableId,
    p_snapshot: snapshot,
  });

  if (error) {
    return { error: "Couldn't submit the board. Please try again." };
  }
  return { error: null };
}
