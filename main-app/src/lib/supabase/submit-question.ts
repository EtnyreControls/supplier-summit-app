"use server";

import { createClient } from "@/lib/supabase/server";

const NLP_SERVICE_URL = "http://localhost:8001";

/**
 * Submits an attendee question straight into "questions". Runs as the
 * caller, not the service role, so submit_question()'s auth.uid() check
 * resolves to the actual signed-in user.
 *
 * submit_question() always creates a fresh singleton question_groups row
 * (see its migration), so every submission triggers a regroup pass to fold
 * it in with any near-duplicate pending questions via nlp-service. That
 * call is best-effort: the submission has already succeeded by this point,
 * so a failed/slow regroup is swallowed rather than surfaced to the
 * submitter — the manual "Regroup" button in analytics covers retrying.
 */
export async function submitQuestion(question: string, topic?: string, isAnonymous = false) {
  const supabase = await createClient();

  const { data: questionId, error } = await supabase.rpc("submit_question", {
    p_topic: topic ?? null,
    p_question: question,
    p_is_anonymous: isAnonymous,
  });

  if (error) {
    return { error: "Could not submit your question. Please try again." };
  }

  fetch(`${NLP_SERVICE_URL}/api/questions/groups/refresh`, { method: "POST" }).catch(() => {});
  fetch(`${NLP_SERVICE_URL}/api/questions/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question_id: questionId, question_text: question }),
  }).catch(() => {});

  return { error: null };
}
