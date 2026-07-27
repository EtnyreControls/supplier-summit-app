"use client";
import * as React from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  PollCard,
  Banner,
  EmptyState,
  FeedbackStepper,
  MyQuestionsList,
  useToast,
  useProfileModal,
  useBadgeQrModal,
  type PollOption,
  type SubmittedQuestion,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";
import { submitFeedback } from "@/lib/supabase/submit-feedback";

/**
 * Three tabs: Polls (scheduled + anytime, both rendered with the shared
 * PollCard), Feedback (closing pulse stepper), and My questions (the
 * attendee's own submitted Q&A, fetched server-side in page.tsx).
 *
 * - Scheduled polls are tied to a specific agenda session and stay
 *   `locked` (see polls.tsx) until that session starts, then behave like
 *   any other live poll; past ones flip to `showResults`.
 * - Anytime polls are open all day, no schedule gate — this is also where
 *   we collect running attendee sentiment on AI in supply chain/procurement.
 *
 * TODO: swap all mock poll/feedback data below for real Supabase queries
 * once wired up; scheduled unlock/close should move server-side too.
 */

type SectionKey = "polls" | "feedback" | "questions";

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactElement }[] = [
  { key: "polls", label: "Polls", icon: <HowToVoteRoundedIcon fontSize="small" /> },
  { key: "feedback", label: "Feedback", icon: <RateReviewRoundedIcon fontSize="small" /> },
  { key: "questions", label: "My questions", icon: <QuestionAnswerRoundedIcon fontSize="small" /> },
];

type ScheduledStatus = "closed" | "live" | "locked";

interface ScheduledPoll {
  id: string;
  tiedTo: string;
  question: string;
  status: ScheduledStatus;
  lockLabel?: string;
  options: PollOption[];
}

const SCHEDULED_POLLS: ScheduledPoll[] = [
  {
    id: "sp0",
    tiedTo: "Registration & breakfast · 8:00 – 8:45 AM",
    question: "How was check-in this morning?",
    status: "closed",
    options: [
      { id: "o1", label: "Smooth", votes: 152 },
      { id: "o2", label: "A few hiccups", votes: 21 },
      { id: "o3", label: "Long wait", votes: 6 },
    ],
  },
  {
    id: "sp1",
    tiedTo: "Supply chain roadmap keynote · 10:30 – 11:15 AM",
    question: "Which roadmap priority should we dig into during the Q&A?",
    status: "live",
    options: [
      { id: "o4", label: "Sourcing diversification", votes: 34 },
      { id: "o5", label: "Digital PO & EDI rollout", votes: 41 },
      { id: "o6", label: "Freight consolidation", votes: 19 },
    ],
  },
  {
    id: "sp2",
    tiedTo: "Q&A with leadership · 11:15 AM – 12:00 PM",
    question: "How confident are you in the 18-month roadmap after today's Q&A?",
    status: "locked",
    lockLabel: "Opens when the Q&A begins — 11:15 AM",
    options: [
      { id: "o7", label: "Very confident", votes: 0 },
      { id: "o8", label: "Somewhat confident", votes: 0 },
      { id: "o9", label: "Not sure yet", votes: 0 },
    ],
  },
  {
    id: "sp3",
    tiedTo: "Manufacturing & quality breakout · 1:00 – 1:45 PM",
    question: "Was the quality-gate walkthrough actionable for your team?",
    status: "locked",
    lockLabel: "Opens at 1:00 PM, right as the breakout starts",
    options: [
      { id: "o10", label: "Yes, ready to apply it", votes: 0 },
      { id: "o11", label: "Somewhat — need more detail", votes: 0 },
      { id: "o12", label: "Not really", votes: 0 },
    ],
  },
];

interface AnytimePoll {
  id: string;
  question: string;
  options: PollOption[];
}

const ANYTIME_POLLS: AnytimePoll[] = [
  {
    id: "ap1",
    question: "How do you feel about AI's growing role in supply chain & procurement?",
    options: [
      { id: "a1", label: "Excited — bring it on", votes: 58 },
      { id: "a2", label: "Optimistic, with guardrails", votes: 77 },
      { id: "a3", label: "Neutral / not sure yet", votes: 34 },
      { id: "a4", label: "Cautious", votes: 22 },
      { id: "a5", label: "Concerned", votes: 9 },
    ],
  },
  {
    id: "ap2",
    question: "Which AI use case would help your team most this year?",
    options: [
      { id: "b1", label: "Demand forecasting", votes: 46 },
      { id: "b2", label: "Automated quality inspection", votes: 39 },
      { id: "b3", label: "Supplier risk scoring", votes: 28 },
      { id: "b4", label: "Automated RFQs & PO matching", votes: 33 },
    ],
  },
  {
    id: "ap3",
    question: "How is today's summit tracking against your expectations so far?",
    options: [
      { id: "c1", label: "Exceeding expectations", votes: 88 },
      { id: "c2", label: "Meeting expectations", votes: 63 },
      { id: "c3", label: "Below expectations", votes: 5 },
    ],
  },
];

function withVote(options: PollOption[], votedId: string | null | undefined) {
  if (!votedId) return options;
  return options.map((o) => (o.id === votedId ? { ...o, votes: o.votes + 1 } : o));
}

export function PollsPageClient({ initialQuestions }: { initialQuestions: SubmittedQuestion[] }) {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const [section, setSection] = React.useState<SectionKey>("polls");
  const [scheduledVotes, setScheduledVotes] = React.useState<Record<string, string>>({});
  const [anytimeVotes, setAnytimeVotes] = React.useState<Record<string, string>>({});
  const [rating, setRating] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = React.useState(false);
  const [submittingFeedback, setSubmittingFeedback] = React.useState(false);

  const voteScheduled = (pollId: string, optionId: string) => {
    setScheduledVotes((v) => (v[pollId] ? v : { ...v, [pollId]: optionId }));
    showToast("Vote recorded");
  };
  const voteAnytime = (pollId: string, optionId: string) => {
    setAnytimeVotes((v) => (v[pollId] ? v : { ...v, [pollId]: optionId }));
    showToast("Vote recorded");
  };

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeKey="polls"
        logo={<NavLogo />}
        initials="SC"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />
      <PageContainer>
        <SectionHeader eyebrow="Today · July 15" title="Polls & feedback" />

        <Tabs
          value={section}
          onChange={(_, v: SectionKey) => setSection(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Polls & feedback sections"
          sx={{ mb: 2 }}
        >
          {SECTIONS.map((s) => (
            <Tab key={s.key} value={s.key} icon={s.icon} iconPosition="start" label={s.label} sx={{ minHeight: 44 }} />
          ))}
        </Tabs>

        {section === "polls" && (
          <>
            <Banner>
              Scheduled polls unlock automatically as each session begins — check back
              throughout the day. Anytime polls are open right now.
            </Banner>

            <SectionHeader eyebrow="Tied to today's agenda" title="Scheduled polls" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {SCHEDULED_POLLS.map((poll) => (
                <div key={poll.id} className="flex flex-col gap-1.5">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-grey-500">
                    <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
                    {poll.tiedTo}
                  </p>
                  <PollCard
                    question={poll.question}
                    live={poll.status === "live"}
                    locked={poll.status === "locked"}
                    lockLabel={poll.lockLabel}
                    showResults={poll.status === "closed"}
                    votedId={scheduledVotes[poll.id] ?? null}
                    onVote={(optionId) => voteScheduled(poll.id, optionId)}
                    options={
                      poll.status === "live" ? withVote(poll.options, scheduledVotes[poll.id]) : poll.options
                    }
                  />
                </div>
              ))}
            </div>

            <SectionHeader eyebrow="Open all day" title="Anytime polls" />
            <Banner>
              We&apos;re gauging supplier sentiment on AI adoption below — your answers
              feed directly into next quarter&apos;s roadmap conversation.
            </Banner>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {ANYTIME_POLLS.map((poll) => (
                <PollCard
                  key={poll.id}
                  question={poll.question}
                  live
                  votedId={anytimeVotes[poll.id] ?? null}
                  onVote={(optionId) => voteAnytime(poll.id, optionId)}
                  options={withVote(poll.options, anytimeVotes[poll.id])}
                />
              ))}
            </div>
          </>
        )}

        {section === "feedback" && (
          <>
            <SectionHeader eyebrow="Quick pulse" title="Summit feedback" />
            {feedbackSubmitted ? (
              <EmptyState
                icon={<RateReviewRoundedIcon sx={{ fontSize: 36 }} />}
                title="Thanks for the feedback"
                body="Your response is anonymous and helps shape what we do next — session leads see a summary after the day wraps."
              />
            ) : (
              <FeedbackStepper
                steps={[
                  "How valuable has today been for your partnership with Etnyre?",
                  "Anything we should change or do more of?",
                ]}
                canAdvance={(i) => (i === 0 ? rating !== null : !submittingFeedback)}
                onComplete={async () => {
                  setSubmittingFeedback(true);
                  const { error } = await submitFeedback(rating ?? "", comment);
                  setSubmittingFeedback(false);
                  if (error) {
                    showToast(error, "error");
                    return;
                  }
                  setFeedbackSubmitted(true);
                  showToast("Feedback submitted — thank you");
                }}
              >
                {(i) =>
                  i === 0 ? (
                    <div className="flex gap-2">
                      {["1", "2", "3", "4", "5"].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRating(r)}
                          className={`h-11 w-11 rounded-(--radius-control) border text-[15px] font-semibold transition-colors ${
                            rating === r
                              ? "border-ink bg-yellow text-on-yellow"
                              : "border-grey-300 text-grey-700 hover:border-ink"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <TextField
                      multiline
                      minRows={3}
                      placeholder="Anything goes — this is anonymous"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  )
                }
              </FeedbackStepper>
            )}
          </>
        )}

        {section === "questions" && (
          <>
            <SectionHeader eyebrow={`${initialQuestions.length} submitted`} title="My questions" />
            {initialQuestions.length === 0 ? (
              <EmptyState
                icon={<QuestionAnswerRoundedIcon sx={{ fontSize: 32 }} />}
                title="No questions yet"
                body="Use the “Ask a question” button anywhere in the app to submit one — it'll show up here."
              />
            ) : (
              <MyQuestionsList questions={initialQuestions} />
            )}
          </>
        )}
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
