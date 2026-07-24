"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Submits an attendee question straight into "questions" (no AI grouping
 * yet — see the submit_question migration). Runs as the caller, not the
 * service role, so submit_question()'s auth.uid() check resolves to the
 * actual signed-in user.
 */
export async function submitQuestion(question: string, topic?: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_question", {
    p_topic: topic ?? null,
    p_question: question,
  });

  if (error) {
    return { error: "Could not submit your question. Please try again." };
  }

  return { error: null };
}
