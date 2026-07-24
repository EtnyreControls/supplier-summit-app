import Link from "next/link";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components";
import type { AddressableItem } from "@/components";
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
  questions: { question_id: string; submission_info: string | null }[] | null;
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
    .select("group_id, composed_question, topic, checked, checked_at, questions(question_id, submission_info)")
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
      groupItems: (row.questions ?? []).map((q) => q.submission_info).filter((t): t is string => !!t),
      addressed: row.checked,
      addressedAt: row.checked_at ? new Date(row.checked_at).getTime() : null,
    };
  });

  return <AnalyticsPageClient initialQuestions={initialQuestions} />;
}
