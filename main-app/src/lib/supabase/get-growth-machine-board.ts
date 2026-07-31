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
