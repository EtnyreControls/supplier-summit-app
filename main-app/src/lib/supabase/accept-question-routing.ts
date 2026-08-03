"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Accepts a routed question AND grants the speaker permission to answer its
 * group in one call (see accept_question_routing() in the
 * accept_question_routing migration) — RLS's "speaker answer routed groups"
 * policy only lets a speaker touch a group whose speaker_id already equals
 * theirs, so this first assignment has to go through a SECURITY DEFINER
 * function. Runs as the caller so auth.uid() inside the function is the
 * real signed-in speaker.
 */
export async function acceptQuestionRouting(routingId: string): Promise<{ groupId: string | null; error: string | null }> {
  const supabase = await createClient();

  const { data: groupId, error } = await supabase.rpc("accept_question_routing", {
    p_routing_id: routingId,
  });

  if (error || !groupId) {
    return { groupId: null, error: "Couldn't accept this question. Please try again." };
  }

  return { groupId, error: null };
}
