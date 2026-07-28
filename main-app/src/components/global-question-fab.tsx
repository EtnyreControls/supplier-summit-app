"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { QuestionFab, type QuestionSubmission } from "./question-fab";
import { useToast } from "./feedback";
import { submitQuestion } from "@/lib/supabase/submit-question";
import { createClient } from "@/lib/supabase/client";

/** Routes with no event content to ask a question about — pre-login and the
 * one-time post-login welcome reveal. */
const HIDDEN_ON = ["/login", "/welcome"];

export function GlobalQuestionFab() {
  const pathname = usePathname();
  const { toast, showToast } = useToast();
  const [isAnalytics, setIsAnalytics] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user").select("role").eq("user_id", user.id).single();
      if (data?.role === "analytics") setIsAnalytics(true);
    })();
  }, []);

  // Analytics-role users are staff moderating attendee questions, not
  // attendees asking them — the FAB doesn't apply to that view.
  if (isAnalytics) return null;
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