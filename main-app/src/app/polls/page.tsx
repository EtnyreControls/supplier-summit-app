import { createClient } from "@/lib/supabase/server";
import { PollsPageClient, type SurveyGroup } from "./polls-page-client";

/**
 * Route: /polls ("Polls & feedback" in TopNav)
 * Server Component: reads live poll/feedback data from Supabase (RLS scopes
 * "own answer" rows to the signed-in attendee; aggregate vote tallies come
 * from get_feedback_vote_counts() since RLS can't show other attendees'
 * individual answers — see 20260821150000_poll_voting_rpc.sql). Each
 * session's questions split into a 'poll' and/or 'feedback' response_group
 * (see 20260821160000_feedback_question_response_groups.sql) — a group can
 * mix mcq/rating/text questions and renders as a single click-through flow
 * when it has more than one question.
 */

type FeedbackRow = {
  feedback_id: string;
  feedback_name: string | null;
  status: string;
  event_id: string | null;
  is_anonymous: boolean | null;
};

type FeedbackQuestionRow = {
  feedback_question_id: string;
  feedback_id: string;
  question_text: string;
  question_type: "mcq" | "text" | "rating";
  options: string | null;
  response_group: "poll" | "feedback";
};

type EventRow = { event_id: string; event_name: string; status: string };

type VoteCountRow = { feedback_question_id: string; answer_value: string; vote_count: number };

export default async function PollsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: feedbackRows }, { data: questionRows }, { data: eventRows }, { data: voteCounts }] =
    await Promise.all([
      supabase
        .from("feedback")
        .select("feedback_id, feedback_name, status, event_id, is_anonymous")
        .returns<FeedbackRow[]>(),
      supabase
        .from("feedback_questions")
        .select("feedback_question_id, feedback_id, question_text, question_type, options, response_group")
        .returns<FeedbackQuestionRow[]>(),
      supabase.from("event").select("event_id, event_name, status").returns<EventRow[]>(),
      supabase.rpc("get_feedback_vote_counts"),
    ]);
  const voteCountRows = (voteCounts ?? []) as VoteCountRow[];

  // Own table name per event, so the "Best Table" poll can exclude it from
  // its options below — voting for your own table isn't the point of that
  // poll. Keyed by event_id since table membership is scoped per event.
  const myTableNameByEvent = new Map<string, string>();
  if (user) {
    const { data: myTableRows } = await supabase
      .from("event_table_members")
      .select("event_tables(table_name, event_id)")
      .eq("user_id", user.id)
      .returns<{ event_tables: { table_name: string; event_id: string } | null }[]>();
    for (const row of myTableRows ?? []) {
      if (row.event_tables) myTableNameByEvent.set(row.event_tables.event_id, row.event_tables.table_name);
    }
  }

  // table_name ("1".."12", what the "Best Table" poll's options/votes are
  // actually keyed on) -> table_label (friendly name, 'TBD' until set) — the
  // poll displays "label (name)" for each option, kept separate from the id
  // so existing votes/tallies keyed on table_name stay valid even after
  // labels are renamed.
  const { data: tableRows } = await supabase.from("event_tables").select("table_name, table_label");
  const tableLabelByName = new Map((tableRows ?? []).map((t) => [t.table_name, t.table_label as string]));

  let myAnswers: { feedback_question_id: string; answer_value: string }[] = [];
  if (user) {
    const { data: myResponses } = await supabase
      .from("feedback_responses")
      .select("feedback_response_id")
      .eq("respondent_id", user.id);
    const responseIds = (myResponses ?? []).map((r) => r.feedback_response_id);
    if (responseIds.length > 0) {
      const { data } = await supabase
        .from("feedback_answers")
        .select("feedback_question_id, answer_value")
        .in("feedback_response_id", responseIds);
      myAnswers = data ?? [];
    }
  }

  const eventById = new Map((eventRows ?? []).map((e) => [e.event_id, e]));
  const votesByQuestion = new Map<string, Map<string, number>>();
  for (const row of voteCountRows) {
    const byAnswer = votesByQuestion.get(row.feedback_question_id) ?? new Map<string, number>();
    byAnswer.set(row.answer_value, row.vote_count);
    votesByQuestion.set(row.feedback_question_id, byAnswer);
  }
  const myAnswerByQuestion = new Map(myAnswers.map((a) => [a.feedback_question_id, a.answer_value]));

  const scheduledPolls: SurveyGroup[] = [];
  const sessionFeedback: SurveyGroup[] = [];

  for (const feedback of feedbackRows ?? []) {
    if (feedback.is_anonymous || !feedback.event_id) continue; // anonymous end-of-day survey has its own card
    const event = eventById.get(feedback.event_id);
    // feedback_name is the survey's own title — several surveys share one
    // event_id (e.g. Procurement & Operations rides the Executive Business
    // Update slot), so leading with event_name would show duplicate labels.
    const tiedTo = feedback.feedback_name ?? event?.event_name ?? "";
    const questions = (questionRows ?? []).filter((q) => q.feedback_id === feedback.feedback_id);

    for (const responseGroup of ["poll", "feedback"] as const) {
      const groupQuestions = questions.filter((q) => q.response_group === responseGroup);
      if (groupQuestions.length === 0) continue;

      const group: SurveyGroup = {
        id: `${feedback.feedback_id}:${responseGroup}`,
        tiedTo,
        live: feedback.status === "live",
        locked: feedback.status === "locked",
        lockLabel: feedback.status === "locked" ? "Opens after this session ends" : undefined,
        questions: groupQuestions.map((q) => {
          if (q.question_type === "text") {
            return {
              id: q.feedback_question_id,
              question: q.question_text,
              kind: "text" as const,
              myAnswer: myAnswerByQuestion.get(q.feedback_question_id) ?? null,
            };
          }
          const isBestTable = feedback.feedback_name === "Best Table";
          // Best Table's options are event_tables.table_name ("1".."12") —
          // what votes/tallies/"own table" exclusion are keyed on. Displayed
          // as "label (name)" via tableLabelByName; every other mcq/rating
          // question's options are already literal, human-readable labels.
          let optionIds = (q.options ?? "").split(",").map((o) => o.trim()).filter(Boolean);
          if (isBestTable) {
            const myTable = myTableNameByEvent.get(feedback.event_id!);
            if (myTable) optionIds = optionIds.filter((id) => id !== myTable);
          }
          const tally = votesByQuestion.get(q.feedback_question_id);
          return {
            id: q.feedback_question_id,
            question: q.question_text,
            kind: "choice" as const,
            options: optionIds.map((id) => ({
              id,
              label: isBestTable ? `${tableLabelByName.get(id) ?? id} (${id})` : id,
              votes: tally?.get(id) ?? 0,
            })),
            myAnswer: myAnswerByQuestion.get(q.feedback_question_id) ?? null,
          };
        }),
      };

      (responseGroup === "poll" ? scheduledPolls : sessionFeedback).push(group);
    }
  }

  // live sessions first so attendees see what's actionable right now
  scheduledPolls.sort((a, b) => Number(b.live) - Number(a.live));
  sessionFeedback.sort((a, b) => Number(b.live) - Number(a.live));

  return <PollsPageClient scheduledPolls={scheduledPolls} sessionFeedback={sessionFeedback} />;
}
