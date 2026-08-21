"use server";

import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MachinePart = "engine" | "fuel" | "gears" | "brakes" | "turbo_boost";

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
 * Read-only check for /growth-machine's initial render — resolves the
 * caller's table and whether it already has a submission, without
 * enter_growth_machine's side effect of claiming/releasing the builder
 * seat just from loading the page. See get_growth_machine_status() in the
 * growth_machine_status_check migration.
 *
 * A table with a submission skips the role picker entirely: everyone sees
 * the finished board (GrowthMachineBoardViewer), and only the current
 * builder additionally gets an Edit action — see GrowthMachinePage.
 */
export async function getGrowthMachineStatus(): Promise<{
  tableId: string | null;
  isBuilder: boolean;
  hasSubmission: boolean;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_growth_machine_status");

  if (error) {
    return { tableId: null, isBuilder: false, hasSubmission: false, error: "Couldn't load your table." };
  }
  const row = data as { table_id: string | null; is_builder: boolean; has_submission: boolean };
  return { tableId: row.table_id, isBuilder: row.is_builder, hasSubmission: row.has_submission, error: null };
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

/**
 * Records the Builder's progress on one of the 5 prompts (see
 * PROMPT_HEADINGS in components/text.tsx) as they finish it, so analytics
 * can see live per-prompt progress instead of only a final not_started /
 * building / submitted state. Re-submitting the same part overwrites its
 * prior content — see submit_growth_machine_prompt()'s ON CONFLICT upsert.
 */
export async function submitGrowthMachinePrompt(
  tableId: string,
  part: MachinePart,
  content: string,
): Promise<{ error: string | null }> {
  if (!UUID_RE.test(tableId)) {
    return { error: "No table assigned — progress wasn't saved." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_growth_machine_prompt", {
    p_table_id: tableId,
    p_part: part,
    p_content: content,
  });

  if (error) {
    return { error: "Couldn't save your progress. Please try again." };
  }
  return { error: null };
}
