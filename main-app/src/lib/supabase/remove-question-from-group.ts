"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Detaches one question from its AI-merged group back into its own
 * singleton group — the manual override when the auto-grouping pipeline
 * merged something that doesn't actually belong. See the
 * remove_question_from_group migration for what this does server-side.
 */
export async function removeQuestionFromGroup(questionId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("remove_question_from_group", { p_question_id: questionId });

  if (error) {
    return { error: "Could not remove that question from the group. Please try again." };
  }

  return { error: null };
}
