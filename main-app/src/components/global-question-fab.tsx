"use client";
import { usePathname } from "next/navigation";
import { QuestionFab, type QuestionSubmission } from "./question-fab";
import { useToast } from "./feedback";
import { submitQuestion } from "@/lib/supabase/submit-question";

/** Routes with no event content to ask a question about — pre-login and the
 * one-time post-login welcome reveal. */
const HIDDEN_ON = ["/login", "/welcome"];

export function GlobalQuestionFab() {
  const pathname = usePathname();
  const { toast, showToast } = useToast();

  // The analytics dashboard is a staff moderation view — no FAB over it.
  // Scoped by route rather than by role so an analytics-role user still
  // gets the FAB everywhere else in the app (they're an attendee too).
  if (pathname.startsWith("/analytics")) return null;
  if (HIDDEN_ON.includes(pathname)) return null;

  const handleSubmit = async ({ question, topic, isAnonymous }: QuestionSubmission) => {
    const { error } = await submitQuestion(question, topic, isAnonymous);
    showToast(error ?? "Question submitted", error ? "error" : "success");
  };

  return (
    <>
      <QuestionFab onSubmit={handleSubmit} />
      {toast}
    </>
  );
}