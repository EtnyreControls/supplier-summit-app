"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marks a question_groups row addressed/unaddressed from the analytics
 * dashboard. Runs as the caller (analytics role) so RLS's "analytics manage
 * all groups" policy is what actually authorizes the write — the
 * propagate_group_changes trigger then cascades `checked` down to every
 * questions row in the group, and set_checked_at_trigger stamps checked_at.
 */
export async function toggleQuestionGroupChecked(groupId: string, checked: boolean) {
  const supabase = await createClient();

  const { error } = await supabase.from("question_groups").update({ checked }).eq("group_id", groupId);

  if (error) {
    return { error: "Could not update the question. Please try again." };
  }

  return { error: null };
}
