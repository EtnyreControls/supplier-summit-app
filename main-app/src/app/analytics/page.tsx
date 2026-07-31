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

type RoutingAttemptRow = {
  status: string;
  speaker_id: string | null;
  speaker_name: string | null;
  attempt_number: number;
};

type SpeakerInfoRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

type QuestionGroupRow = {
  group_id: string;
  composed_question: string | null;
  topic: string | null;
  checked: boolean;
  checked_at: string | null;
  answer_text: string | null;
  questions:
    | { question_id: string; submission_info: string | null; question_routing: RoutingAttemptRow[] | null }[]
    | null;
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
    .select(
      "group_id, composed_question, topic, checked, checked_at, answer_text, questions(question_id, submission_info, question_routing(status, speaker_id, speaker_name, attempt_number))"
    )
    .order("created_at", { ascending: false })
    .returns<QuestionGroupRow[]>();

  // A question can have several routing attempts (one per decline/reassign);
  // only the highest attempt_number reflects where it currently stands.
  const latestRouting = (attempts: RoutingAttemptRow[] | null) => {
    if (!attempts || attempts.length === 0) return null;
    return attempts.reduce((latest, a) => (a.attempt_number > latest.attempt_number ? a : latest));
  };

  // Reassign dropdown source: every speaker with a real bio (excludes
  // retired/placeholder speakers whose bio was cleared) plus their display
  // name via speaker_public_info() — same RLS workaround as agenda/page.tsx,
  // since analytics can't read arbitrary "user" rows directly either.
  const [{ data: allSpeakerRows }, { data: speakerInfoData }] = await Promise.all([
    supabase.from("speakers").select("speaker_id, user_id, bio"),
    supabase.rpc("speaker_public_info"),
  ]);

  // A person can have more than one speakers row (one per session they
  // speak at, e.g. "VP Supply Chain" opening AND closing) — each is a
  // distinct FK target for question_routing.speaker_id, but they're the
  // same real human being. Expand "already attempted" to every alias of an
  // attempted person, so the never-repeat-a-speaker rule holds by PERSON,
  // not just by row, and dedupe the dropdown itself to one entry per person.
  const speakerIdToUserId = new Map((allSpeakerRows ?? []).map((s) => [s.speaker_id, s.user_id]));
  const speakerIdAliasesByUserId = new Map<string, string[]>();
  for (const s of allSpeakerRows ?? []) {
    if (!s.user_id) continue;
    const list = speakerIdAliasesByUserId.get(s.user_id) ?? [];
    list.push(s.speaker_id);
    speakerIdAliasesByUserId.set(s.user_id, list);
  }
  const expandAttemptedSpeakerIds = (rawIds: string[]): string[] => {
    const expanded = new Set<string>();
    for (const id of rawIds) {
      expanded.add(id);
      const userId = speakerIdToUserId.get(id);
      if (userId) for (const alias of speakerIdAliasesByUserId.get(userId) ?? []) expanded.add(alias);
    }
    return [...expanded];
  };

  const speakerInfoByUserId = new Map(((speakerInfoData ?? []) as SpeakerInfoRow[]).map((r) => [r.user_id, r]));
  const seenSpeakerUserIds = new Set<string>();
  const availableSpeakers = (allSpeakerRows ?? [])
    .filter((s) => !!s.bio && !!s.user_id)
    .filter((s) => {
      if (seenSpeakerUserIds.has(s.user_id as string)) return false;
      seenSpeakerUserIds.add(s.user_id as string);
      return true;
    })
    .map((s) => {
      const info = speakerInfoByUserId.get(s.user_id as string);
      const name = info ? [info.first_name, info.last_name].filter(Boolean).join(" ") : null;
      return { speakerId: s.speaker_id as string, name: name || "Speaker" };
    });

  // A group's size (how many attendees asked essentially the same question,
  // per the AI clustering) is the popularity signal, same number as the
  // "N similar" chip; the raw per-attendee wording is what the chip expands
  // to show, so analytics can see what was actually merged, not just a count.
  //
  // Routing is stored per underlying question_id, but analytics sees ONE
  // list item per group — so routing/reassign is shown and acted on once
  // per item, not once per merged duplicate. "Current" routing is whichever
  // underlying question has routing history (near-duplicates are near-
  // identical text, so they route near-identically in practice); a reassign
  // applies to every underlying question_id in the group at once.
  const initialQuestions: AddressableItem[] = (groupRows ?? []).map((row) => {
    const rawQuestions = (row.questions ?? []).filter((q) => !!q.submission_info);
    const groupCount = rawQuestions.length;
    const allAttempts = rawQuestions.flatMap((q) => q.question_routing ?? []);
    const primaryRouting = rawQuestions.map((q) => latestRouting(q.question_routing)).find((r) => r) ?? null;

    return {
      id: row.group_id,
      text: row.composed_question ?? row.topic ?? "(no question text)",
      count: groupCount,
      groupCount: groupCount > 1 ? groupCount : undefined,
      groupItems: rawQuestions.map((q) => ({ id: q.question_id, text: q.submission_info as string })),
      routing: primaryRouting
        ? { status: primaryRouting.status, speakerId: primaryRouting.speaker_id, speakerName: primaryRouting.speaker_name }
        : null,
      // Every speaker (by person, not just row) ever attempted across ANY
      // underlying question in this group — excluded from reassign options,
      // mirroring the DB's own (question_id, speaker_id) unique constraint.
      attemptedSpeakerIds: expandAttemptedSpeakerIds(
        allAttempts.map((a) => a.speaker_id).filter((id): id is string => !!id)
      ),
      questionIds: rawQuestions.map((q) => q.question_id),
      answerText: row.answer_text,
      addressed: row.checked,
      addressedAt: row.checked_at ? new Date(row.checked_at).getTime() : null,
    };
  });

  // Derived from initialQuestions' own routing field — the same "primary"
  // latest-attempt lookup the list itself sorts and the reassign dropdown
  // displays. A raw "any row ever had status=unrouted" query (the previous
  // approach) goes stale the moment a question gets reassigned: the old
  // exhausted attempt row still exists for the audit trail, but it's no
  // longer the CURRENT state, so it must not still count here.
  const unroutedCount = initialQuestions.filter((q) => q.routing?.status === "unrouted").length;

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

  return (
    <AnalyticsPageClient
      initialQuestions={initialQuestions}
      initialFeedbackTopics={initialFeedbackTopics}
      unroutedCount={unroutedCount}
      availableSpeakers={availableSpeakers}
    />
  );
}
