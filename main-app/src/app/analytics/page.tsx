import Link from "next/link";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components";
import type { AddressableItem, FeedbackTopicsResponse } from "@/components";
import { AnalyticsPageClient } from "./analytics-page-client";

/**
 * Route: /analytics ("Analytics" in TopNav — only shown there for
 * role="analytics" users, see top-nav.tsx). Server Component: the actual
 * access control lives here, not in the nav — hiding the link doesn't stop
 * someone hitting the URL directly, so this checks the real DB role
 * (replacing the old demo PIN gate) before rendering anything.
 */

type QuestionGroupRow = {
  group_id: string;
  composed_question: string | null;
  topic: string | null;
  checked: boolean;
  checked_at: string | null;
  answer_text: string | null;
  questions: { question_id: string; submission_info: string | null }[] | null;
};

type FeedbackTopicRow = {
  topic_id: string;
  label: string;
  summary: string;
  addressed: boolean;
  addressed_at: string | null;
  feedback_topic_items: { item_id: string; raw_text: string }[] | null;
};

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile } = authUser
    ? await supabase.from("user").select("role").eq("user_id", authUser.id).single()
    : { data: null };

  if (profile?.role !== "analytics") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <EmptyState
          icon={<LockRoundedIcon sx={{ fontSize: 32 }} />}
          title="Analytics access only"
          body="This area is restricted to the analytics role."
          action={
            <Link href="/" className="text-sm font-semibold text-ink underline underline-offset-2">
              Back home
            </Link>
          }
        />
      </div>
    );
  }

  const { data: groupRows } = await supabase
    .from("question_groups")
    .select("group_id, composed_question, topic, checked, checked_at, answer_text, questions(question_id, submission_info)")
    .order("created_at", { ascending: false })
    .returns<QuestionGroupRow[]>();

  // A group's size (how many attendees asked essentially the same question,
  // per the AI clustering) is the popularity signal, same number as the
  // "N similar" chip; the raw per-attendee wording is what the chip expands
  // to show, so analytics can see what was actually merged, not just a count.
  const initialQuestions: AddressableItem[] = (groupRows ?? []).map((row) => {
    const groupCount = row.questions?.length ?? 0;
    return {
      id: row.group_id,
      text: row.composed_question ?? row.topic ?? "(no question text)",
      count: groupCount,
      groupCount: groupCount > 1 ? groupCount : undefined,
      groupItems: (row.questions ?? [])
        .filter((q) => !!q.submission_info)
        .map((q) => ({ id: q.question_id, text: q.submission_info as string })),
      answerText: row.answer_text,
      addressed: row.checked,
      addressedAt: row.checked_at ? new Date(row.checked_at).getTime() : null,
    };
  });

  const { data: latestRun } = await supabase
    .from("feedback_topic_runs")
    .select("run_id, cached_at")
    .order("cached_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: topicRows } = latestRun
    ? await supabase
        .from("feedback_topics")
        .select("topic_id, label, summary, addressed, addressed_at, feedback_topic_items(item_id, raw_text)")
        .eq("run_id", latestRun.run_id)
        .returns<FeedbackTopicRow[]>()
    : { data: null };

  const initialFeedbackTopics: FeedbackTopicsResponse = {
    status: latestRun ? "ok" : "not_yet_run",
    cached_at: latestRun?.cached_at ?? null,
    topics: (topicRows ?? []).map((row) => ({
      topic_id: row.topic_id,
      label: row.label,
      item_count: row.feedback_topic_items?.length ?? 0,
      summary: row.summary,
      items: (row.feedback_topic_items ?? []).map((i) => i.raw_text),
      addressed: row.addressed,
      addressed_at: row.addressed_at,
    })),
  };

  return <AnalyticsPageClient initialQuestions={initialQuestions} initialFeedbackTopics={initialFeedbackTopics} />;
}
