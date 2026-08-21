"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Casts one vote for an mcq/rating feedback_question via submit_poll_vote()
 * (see 20260821150000_poll_voting_rpc.sql) — needs to run as the caller so
 * auth.uid() resolves to the signed-in attendee for dedup + attribution.
 */
export async function submitPollVote(feedbackQuestionId: string, answerValue: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_poll_vote", {
    p_feedback_question_id: feedbackQuestionId,
    p_answer_value: answerValue,
  });

  if (error) {
    return { error: error.message.includes("already voted") ? "You already voted on this poll." : "Could not record your vote. Please try again." };
  }

  return { error: null };
}
