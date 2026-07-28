import { createClient } from "@/lib/supabase/server";
import { QuestionsPageClient } from "./questions-page-client";
import type { SubmittedQuestion } from "@/components";

/**
 * Route: /questions ("My questions" in TopNav)
 * Server Component: reads the signed-in user's own submitted questions
 * (RLS's "view own questions" / "view own question group" policies scope
 * this to submitter_id = auth.uid()). Split out of /polls into its own
 * route so it's no longer just a tab buried in Polls & feedback.
 */

type QuestionRow = {
  question_id: string;
  submission_info: string | null;
  status: string;
  question_groups: { answer_text: string | null; created_at: string } | null;
};

export default async function QuestionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = user
    ? await supabase
        .from("questions")
        .select("question_id, submission_info, status, question_groups(answer_text, created_at)")
        .eq("submitter_id", user.id)
        .order("created_at", { foreignTable: "question_groups", ascending: false })
        .returns<QuestionRow[]>()
    : { data: null };

  const myQuestions: SubmittedQuestion[] = (data ?? []).map((row) => ({
    id: row.question_id,
    text: row.submission_info ?? "",
    status: row.status,
    answerText: row.question_groups?.answer_text ?? null,
  }));

  return <QuestionsPageClient initialQuestions={myQuestions} />;
}
