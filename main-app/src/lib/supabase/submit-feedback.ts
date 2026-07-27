"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Submits the anonymous Summit-feedback survey (rating + free-text step)
 * via submit_feedback(), same reasoning as submit-question.ts: this needs
 * to run as the caller (not the service role) so auth.uid() resolves to the
 * signed-in attendee, even though the resulting row is stored anonymously.
 */
export async function submitFeedback(rating: string, comment: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_feedback", {
    p_rating: rating,
    p_comment: comment,
  });

  if (error) {
    return { error: "Could not submit your feedback. Please try again." };
  }

  return { error: null };
}
