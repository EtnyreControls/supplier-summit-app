"use server";

import { createClient } from "@/lib/supabase/server";

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL ?? "http://localhost:8080";

/**
 * Writes a speaker's accept/decline on a routed question. Runs as the
 * caller, not the service role — RLS's "speaker decide own pending routing"
 * policy is what actually enforces "own row, still pending", same trust
 * model as answerQuestionGroup.
 *
 * A decline fires a best-effort re-route call: nlp-service reads
 * question_routing itself to figure out which speakers are already
 * attempted (this row now included), so no extra state needs to travel with
 * the request. Failure is swallowed the same way submitQuestion's regroup
 * call is — the decline has already been saved by this point.
 */
export async function decideRouting(
  routingId: string,
  decision: "accepted" | "declined",
  questionId: string,
  questionText: string,
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("question_routing")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("routing_id", routingId);

  if (error) {
    return { error: "Could not save your decision. Please try again." };
  }

  if (decision === "declined") {
    fetch(`${NLP_SERVICE_URL}/api/questions/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, question_text: questionText }),
    }).catch(() => {});
  }

  return { error: null };
}
