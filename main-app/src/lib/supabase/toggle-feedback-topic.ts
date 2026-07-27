"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marks a feedback_topics row addressed/unaddressed from the analytics
 * dashboard, mirroring toggle-question-group.ts. No cross-table cascade
 * needed here (unlike questions), so a plain client-side update under RLS's
 * "analytics update topics" policy is enough.
 */
export async function toggleFeedbackTopicAddressed(topicId: string, addressed: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("feedback_topics")
    .update({ addressed, addressed_at: addressed ? new Date().toISOString() : null })
    .eq("topic_id", topicId);

  if (error) {
    return { error: "Could not update that item. Please try again." };
  }

  return { error: null };
}
