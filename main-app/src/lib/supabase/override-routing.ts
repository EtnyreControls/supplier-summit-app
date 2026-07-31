"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Lets analytics manually redirect a question to a specific, untried
 * speaker — runs as the caller so override_question_routing()'s
 * is_analytics() check resolves to the real signed-in user, same trust
 * model as answerQuestionGroup/toggleQuestionGroupChecked.
 */
export async function overrideQuestionRouting(questionId: string, newSpeakerId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("override_question_routing", {
    p_question_id: questionId,
    p_new_speaker_id: newSpeakerId,
  });

  if (error) {
    return { error: error.message || "Could not reassign this question." };
  }

  return { error: null };
}
