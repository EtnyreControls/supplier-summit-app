"use client";
import { usePathname } from "next/navigation";
import { QuestionFab } from "./question-fab";
import { useToast } from "./feedback";
import { submitQuestion } from "@/lib/supabase/submit-question";

/** Routes with no event content to ask a question about — pre-login and the
 * one-time post-login welcome reveal. */
const HIDDEN_ON = ["/login", "/welcome"];

export function GlobalQuestionFab() {
  const pathname = usePathname();
  const { toast, showToast } = useToast();
  if (HIDDEN_ON.includes(pathname)) return null;

  const handleSubmit = async (q: string) => {
    const { error } = await submitQuestion(q);
    showToast(error ?? "Question submitted", error ? "error" : "success");
  };

  return (
    <>
      <QuestionFab onSubmit={handleSubmit} />
      {toast}
    </>
  );
}