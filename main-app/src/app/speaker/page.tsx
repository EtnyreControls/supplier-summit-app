import Link from "next/link";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components";
import type { AddressableItem } from "@/components";
import { SpeakerPageClient } from "./speaker-page-client";

/**
 * Route: /speaker ("Speaker Inbox" in TopNav — shown there for role="speaker"
 * users, see top-nav.tsx). Server Component: same real-role access-control
 * pattern as /analytics (app/analytics/page.tsx) — hiding the nav link
 * doesn't stop someone hitting the URL directly.
 *
 * Also lets role="analytics" in: some analytics accounts (e.g. Zoey, Pranav)
 * are themselves speaking at sessions and need their own inbox alongside
 * their analytics access, rather than trading one for the other. Safe to
 * relax at the page level because the actual data access below is scoped by
 * the signed-in user's speakers rows (see RLS: "speaker view routed
 * groups"/"speaker decide own pending routing" key off speakers.user_id =
 * auth.uid(), not role) — an analytics user with no speakers row just sees
 * an empty inbox, same as a speaker account would.
 *
 * Shows the same grouped/checkbox/answer format as analytics' Questions tab
 * (AddressableList) rather than a bare Accept/Decline queue — answering a
 * question now IS accepting it (see acceptQuestionRouting, called from
 * speaker-page-client before the actual answer/checked write), so there's no
 * separate "Accept" action to click. Decline remains separate since it does
 * real work (re-routes to the next speaker), not just a status flip.
 */

type RoutingRow = {
  routing_id: string;
  question_id: string;
  question_text: string | null;
  created_at: string;
};

type QuestionRow = { question_id: string; group_id: string };

type QuestionGroupRow = {
  group_id: string;
  composed_question: string | null;
  topic: string | null;
  checked: boolean;
  checked_at: string | null;
  answer_text: string | null;
  questions: { question_id: string; submission_info: string | null }[] | null;
};

export interface PendingRoutingAttempt {
  routingId: string;
  questionId: string;
  questionText: string;
}

export interface RoutedGroupInfo {
  groupId: string;
  // Every still-pending routing attempt whose question_id lands in this
  // group — almost always exactly one, but a group can bundle more than one
  // underlying question (see nlp-service's regroup pass), each with its own
  // routing history. Accept/decline act on all of them at once, same as
  // analytics/page.tsx already assumes for reassign.
  attempts: PendingRoutingAttempt[];
}

export default async function SpeakerPage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile } = authUser
    ? await supabase.from("user").select("role").eq("user_id", authUser.id).single()
    : { data: null };

  if (profile?.role !== "speaker" && profile?.role !== "analytics") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <EmptyState
          icon={<LockRoundedIcon sx={{ fontSize: 32 }} />}
          title="Speaker access only"
          body="This area is restricted to speaker accounts."
          action={
            <Link href="/" className="text-sm font-semibold text-ink underline underline-offset-2">
              Back home
            </Link>
          }
        />
      </div>
    );
  }

  // A user can speak at more than one session (speakers.unique is
  // (user_id, event_id), not user_id alone), so this pulls every speaker_id
  // tied to the signed-in account rather than assuming exactly one.
  const { data: speakerRows } = await supabase.from("speakers").select("speaker_id").eq("user_id", authUser!.id);
  const speakerIds = (speakerRows ?? []).map((s) => s.speaker_id);

  const { data: routingRows } =
    speakerIds.length > 0
      ? await supabase
          .from("question_routing")
          .select("routing_id, question_id, question_text, created_at")
          .in("speaker_id", speakerIds)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .returns<RoutingRow[]>()
      : { data: null };

  const questionIds = (routingRows ?? []).map((r) => r.question_id);
  const { data: questionRows } = questionIds.length
    ? await supabase.from("questions").select("question_id, group_id").in("question_id", questionIds).returns<QuestionRow[]>()
    : { data: [] as QuestionRow[] };
  const groupIdByQuestionId = new Map((questionRows ?? []).map((q) => [q.question_id, q.group_id]));

  const routedGroups = new Map<string, RoutedGroupInfo>();
  for (const r of routingRows ?? []) {
    const groupId = groupIdByQuestionId.get(r.question_id);
    if (!groupId) continue;
    const attempt: PendingRoutingAttempt = {
      routingId: r.routing_id,
      questionId: r.question_id,
      questionText: r.question_text ?? "",
    };
    const existing = routedGroups.get(groupId);
    if (existing) existing.attempts.push(attempt);
    else routedGroups.set(groupId, { groupId, attempts: [attempt] });
  }
  const groupIds = [...routedGroups.keys()];

  const { data: groupRows } = groupIds.length
    ? await supabase
        .from("question_groups")
        .select("group_id, composed_question, topic, checked, checked_at, answer_text, questions(question_id, submission_info)")
        .in("group_id", groupIds)
        .returns<QuestionGroupRow[]>()
    : { data: [] as QuestionGroupRow[] };

  // Same shape analytics/page.tsx builds for the Questions tab — reusing
  // AddressableList as-is rather than a bespoke speaker card layout.
  const initialQuestions: AddressableItem[] = (groupRows ?? []).map((row) => {
    const rawQuestions = (row.questions ?? []).filter((q) => !!q.submission_info);
    const groupCount = rawQuestions.length;
    return {
      id: row.group_id,
      text: row.composed_question ?? row.topic ?? "(no question text)",
      count: groupCount,
      groupCount: groupCount > 1 ? groupCount : undefined,
      groupItems: rawQuestions.map((q) => ({ id: q.question_id, text: q.submission_info as string })),
      answerText: row.answer_text,
      addressed: row.checked,
      addressedAt: row.checked_at ? new Date(row.checked_at).getTime() : null,
    };
  });

  const routingByGroupId: Record<string, PendingRoutingAttempt[]> = Object.fromEntries(
    [...routedGroups.entries()].map(([groupId, info]) => [groupId, info.attempts]),
  );

  return <SpeakerPageClient initialQuestions={initialQuestions} routingByGroupId={routingByGroupId} />;
}
