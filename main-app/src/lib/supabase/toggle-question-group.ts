"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marks a question_groups row addressed/unaddressed from the analytics
 * dashboard. Runs as the caller (analytics role) so RLS's "analytics manage
 * all groups" policy is what actually authorizes the write — the
 * propagate_group_changes trigger then cascades `checked` AND `status` down
 * to every questions row in the group, and set_checked_at_trigger stamps
 * checked_at.
 *
 * status has to move here too, not just checked — the submitter-facing "My
 * Questions" view (polls/page.tsx) reads questions.status directly, and
 * without this it stays stuck on "pending" forever even after analytics
 * checks a question off. Note: this doesn't set answer_text, so the
 * submitter sees a plain "answered" state with no answer body — there's no
 * "write an answer" UI yet (question_groups.answer_text/answered_at exist
 * but nothing writes them); this only fixes the status propagation bug.
 */
export async function toggleQuestionGroupChecked(groupId: string, checked: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("question_groups")
    .update({ checked, status: checked ? "answered" : "pending" })
    .eq("group_id", groupId);

  if (error) {
    return { error: "Could not update the question. Please try again." };
  }

  return { error: null };
}
