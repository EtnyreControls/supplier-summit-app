"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Fetches one submitted board's full tldraw document on demand — the
 * submissions list in analytics only loads metadata (see /analytics
 * page.tsx) since the documents themselves can be large; this is called
 * only when analytics actually opens a submission to view it. RLS's
 * "analytics view all boards" policy (growth_machine_board_sync migration)
 * is what actually gates this, not any check here.
 */
export async function getGrowthMachineBoardSnapshot(
  boardId: string,
): Promise<{ snapshot: unknown | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("growth_machine_boards")
    .select("snapshot")
    .eq("board_id", boardId)
    .single();

  if (error || !data) {
    return { snapshot: null, error: "Couldn't load this submission." };
  }
  return { snapshot: data.snapshot, error: null };
}

/**
 * Fetches the most recent submission for a table — used by Spectators to
 * view what the Builder just submitted (see SpectatorBuilderStatusWatcher
 * in text.tsx). Gated by the same "table members view their boards" RLS
 * policy analytics uses (growth_machine_board_sync migration), which checks
 * table membership generally, not is_builder — so this works for Spectators
 * too without any new policy.
 */
export async function getLatestGrowthMachineBoardForTable(
  tableId: string,
): Promise<{ snapshot: unknown | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("growth_machine_boards")
    .select("snapshot")
    .eq("table_id", tableId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { snapshot: null, error: "Couldn't load the submitted board." };
  }
  return { snapshot: data.snapshot, error: null };
}
