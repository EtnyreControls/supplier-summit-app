import Link from "next/link";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components";
import type { AddressableItem, FeedbackTopicsResponse, GrowthMachineBoardSummary, GrowthMachineTableProgress } from "@/components";
import { AnalyticsPageClient, type AnalyticsPoll } from "./analytics-page-client";

/**
 * Route: /analytics ("Analytics" in TopNav for role="analytics" users, see
 * top-nav.tsx; admin reaches it via the admin console's own nav instead,
 * see admin/(protected)/layout.tsx). Server Component: the actual access
 * control lives here, not in the nav — hiding the link doesn't stop someone
 * hitting the URL directly, so this checks the real DB role (replacing the
 * old demo PIN gate) before rendering anything. Also lets role="admin" in:
 * every table this page reads is now covered by either an
 * `is_admin()`-gated RLS policy or an open "authenticated" one (see
 * 20260825130000_admin_analytics_access.sql for the ones that weren't).
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

type FeedbackRow = { feedback_id: string; status: string };
type FeedbackQuestionRow = {
  feedback_question_id: string;
  feedback_id: string;
  question_text: string;
  question_type: "mcq" | "text" | "rating";
  options: string | null;
};
type VoteCountRow = { feedback_question_id: string; answer_value: string; vote_count: number };

type EventTableRow = { table_id: string; table_name: string | null };
type TableMemberRow = { table_id: string; user_id: string; is_builder: boolean | null };
type GrowthBoardRow = { board_id: string; table_id: string; submitted_by: string | null; created_at: string };
type GrowthEntryRow = { table_id: string; part: string };
type UserNameRow = { user_id: string; first_name: string | null; last_name: string | null };

function fullName(row: Pick<UserNameRow, "first_name" | "last_name"> | undefined): string {
  if (!row) return "Attendee";
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || "Attendee";
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile } = authUser
    ? await supabase.from("user").select("role").eq("user_id", authUser.id).single()
    : { data: null };

  if (profile?.role !== "analytics" && profile?.role !== "admin") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <EmptyState
          icon={<LockRoundedIcon sx={{ fontSize: 32 }} />}
          title="Analytics access only"
          body="This area is restricted to the analytics and admin roles."
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
  // Same "current attempt only" logic as unroutedCount — a question can
  // have an old declined attempt in its history but be pending/accepted
  // elsewhere now (re-routed since), so only the latest attempt counts.
  const declinedCount = initialQuestions.filter((q) => q.routing?.status === "declined").length;

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

  // Growth Machine: team progress + a submissions browser. Progress is
  // computed purely from what's in Postgres (event_table_members.is_builder,
  // whether growth_machine_boards has a row for the table) — cheap and
  // accurate enough to tell analytics which tables to go check on, though it
  // can't see in-progress drawing content (that only lives in the tldraw
  // sync-server's live room, not the DB). See growth_machine_board_sync
  // migration for the RLS that scopes growth_machine_boards to analytics.
  const { data: tableRows } = await supabase
    .from("event_tables")
    .select("table_id, table_name")
    .order("table_name")
    .returns<EventTableRow[]>();

  const { data: memberRows } = await supabase
    .from("event_table_members")
    .select("table_id, user_id, is_builder")
    .returns<TableMemberRow[]>();

  const { data: boardRows } = await supabase
    .from("growth_machine_boards")
    .select("board_id, table_id, submitted_by, created_at")
    .order("created_at", { ascending: false })
    .returns<GrowthBoardRow[]>();

  const { data: entryRows } = await supabase
    .from("growth_machine_entries")
    .select("table_id, part")
    .returns<GrowthEntryRow[]>();
  const promptsCompletedByTable = new Map<string, number>();
  for (const e of entryRows ?? []) {
    promptsCompletedByTable.set(e.table_id, (promptsCompletedByTable.get(e.table_id) ?? 0) + 1);
  }
  const PROMPTS_TOTAL = 5;

  const userIds = Array.from(
    new Set([
      ...(memberRows ?? []).map((m) => m.user_id),
      ...(boardRows ?? []).map((b) => b.submitted_by).filter((id): id is string => !!id),
    ]),
  );
  const { data: userRows } = userIds.length
    ? await supabase.from("user").select("user_id, first_name, last_name").in("user_id", userIds).returns<UserNameRow[]>()
    : { data: [] as UserNameRow[] };
  const userById = new Map((userRows ?? []).map((u) => [u.user_id, u]));

  const membersByTable = new Map<string, TableMemberRow[]>();
  for (const m of memberRows ?? []) {
    membersByTable.set(m.table_id, [...(membersByTable.get(m.table_id) ?? []), m]);
  }
  const boardsByTable = new Map<string, GrowthBoardRow[]>();
  for (const b of boardRows ?? []) {
    boardsByTable.set(b.table_id, [...(boardsByTable.get(b.table_id) ?? []), b]);
  }
  const tableNameById = new Map((tableRows ?? []).map((t) => [t.table_id, t.table_name ?? "Unnamed table"]));

  const growthMachineTables: GrowthMachineTableProgress[] = (tableRows ?? []).map((t) => {
    const members = membersByTable.get(t.table_id) ?? [];
    const builder = members.find((m) => m.is_builder);
    // boardRows is already ordered by created_at desc, so [0] is the latest.
    const boards = boardsByTable.get(t.table_id) ?? [];
    return {
      tableId: t.table_id,
      tableName: t.table_name ?? "Unnamed table",
      status: boards.length > 0 ? "submitted" : builder ? "building" : "not_started",
      builderName: builder ? fullName(userById.get(builder.user_id)) : null,
      memberCount: members.length,
      submissionCount: boards.length,
      lastSubmittedAt: boards[0]?.created_at ?? null,
      promptsCompleted: promptsCompletedByTable.get(t.table_id) ?? 0,
      promptsTotal: PROMPTS_TOTAL,
    };
  });

  // boardsByTable's arrays are ordered by created_at desc (from boardRows'
  // own ordering above), so [0] per table is each table's latest submission
  // — older re-submissions from the same table aren't worth browsing.
  const growthMachineBoards: GrowthMachineBoardSummary[] = (tableRows ?? [])
    .map((t) => boardsByTable.get(t.table_id)?.[0])
    .filter((b): b is GrowthBoardRow => b != null)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((b) => ({
      boardId: b.board_id,
      tableId: b.table_id,
      tableName: tableNameById.get(b.table_id) ?? "Unknown table",
      submittedByName: fullName(b.submitted_by ? userById.get(b.submitted_by) : undefined),
      createdAt: b.created_at,
    }));

  // Poll results — same source and get_feedback_vote_counts() RPC as the
  // attendee-facing /polls page (see 20260821150000_poll_voting_rpc.sql for
  // why an RPC is needed: RLS on feedback_answers only exposes each
  // attendee's own rows, so a plain select can't show the group tally).
  // Only mcq/rating questions in the 'poll' response_group render here —
  // free-text feedback answers belong in the Feedback tab, not Poll results.
  const [{ data: feedbackRows }, { data: feedbackQuestionRows }, { data: voteCounts }] = await Promise.all([
    supabase.from("feedback").select("feedback_id, status").returns<FeedbackRow[]>(),
    supabase
      .from("feedback_questions")
      .select("feedback_question_id, feedback_id, question_text, question_type, options")
      .eq("response_group", "poll")
      .returns<FeedbackQuestionRow[]>(),
    supabase.rpc("get_feedback_vote_counts"),
  ]);
  const voteCountRows = (voteCounts ?? []) as VoteCountRow[];

  const feedbackStatusById = new Map((feedbackRows ?? []).map((f) => [f.feedback_id, f.status]));
  const votesByQuestion = new Map<string, Map<string, number>>();
  for (const row of voteCountRows) {
    const byAnswer = votesByQuestion.get(row.feedback_question_id) ?? new Map<string, number>();
    byAnswer.set(row.answer_value, row.vote_count);
    votesByQuestion.set(row.feedback_question_id, byAnswer);
  }

  const polls: AnalyticsPoll[] = (feedbackQuestionRows ?? [])
    .filter((q) => q.question_type !== "text")
    .map((q) => {
      const optionLabels = (q.options ?? "").split(",").map((o) => o.trim()).filter(Boolean);
      const tally = votesByQuestion.get(q.feedback_question_id);
      return {
        id: q.feedback_question_id,
        question: q.question_text,
        live: feedbackStatusById.get(q.feedback_id) === "live",
        options: optionLabels.map((label) => ({ id: label, label, votes: tally?.get(label) ?? 0 })),
      };
    });

  return (
    <AnalyticsPageClient
      initialQuestions={initialQuestions}
      initialFeedbackTopics={initialFeedbackTopics}
      unroutedCount={unroutedCount}
      declinedCount={declinedCount}
      availableSpeakers={availableSpeakers}
      growthMachineTables={growthMachineTables}
      growthMachineBoards={growthMachineBoards}
      polls={polls}
    />
  );
}
