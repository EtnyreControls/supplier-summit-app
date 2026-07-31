import Link from "next/link";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components";
import type { AddressableItem, FeedbackTopicsResponse, GrowthMachineBoardSummary, GrowthMachineTableProgress } from "@/components";
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

type EventTableRow = { table_id: string; table_name: string | null };
type TableMemberRow = { table_id: string; user_id: string; is_builder: boolean | null };
type GrowthBoardRow = { board_id: string; table_id: string; submitted_by: string | null; created_at: string };
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
    };
  });

  const growthMachineBoards: GrowthMachineBoardSummary[] = (boardRows ?? []).map((b) => ({
    boardId: b.board_id,
    tableId: b.table_id,
    tableName: tableNameById.get(b.table_id) ?? "Unknown table",
    submittedByName: fullName(b.submitted_by ? userById.get(b.submitted_by) : undefined),
    createdAt: b.created_at,
  }));

  return (
    <AnalyticsPageClient
      initialQuestions={initialQuestions}
      initialFeedbackTopics={initialFeedbackTopics}
      growthMachineTables={growthMachineTables}
      growthMachineBoards={growthMachineBoards}
    />
  );
}
