"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Writes an actual answer for a question_groups row — the piece that was
 * missing before: analytics could check a question off (status flips to
 * "answered") but nothing ever set answer_text, so submitters saw an
 * "Answered" tag with no answer body. Runs as the caller (analytics role);
 * RLS's "analytics manage all groups" update policy already covers all
 * columns, and propagate_group_changes (now SECURITY DEFINER, see the
 * fix_question_group_propagation_rls migration) cascades status/checked
 * down to the child questions rows the submitter's view actually reads.
 */
export async function answerQuestionGroup(groupId: string, answerText: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("question_groups")
    .update({ answer_text: answerText, status: "answered", checked: true })
    .eq("group_id", groupId);

  if (error) {
    return { error: "Could not save the answer. Please try again." };
  }

  return { error: null };
}
