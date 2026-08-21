"use client";
import * as React from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
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
  useToast,
  useProfileModal,
  useBadgeQrModal,
  type PollOption,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";
import { submitFeedback } from "@/lib/supabase/submit-feedback";
import { submitPollVote } from "@/lib/supabase/submit-poll-vote";

/**
 * Two tabs: Polls and Feedback, both driven by `feedback`/`feedback_questions`
 * grouped per session by `response_group` ('poll' vs 'feedback' — see
 * 20260821160000_feedback_question_response_groups.sql). A session's group
 * can mix mcq/rating/text questions; a group with more than one question
 * renders as a click-through stepper (SurveyGroupCard below) instead of
 * separate cards. Each group stays `locked` until its linked agenda session
 * ends, at which point a DB trigger flips it to `live`. "My questions" lives
 * at its own route (/questions) rather than as a tab here.
 */

type SectionKey = "polls" | "feedback";

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactElement }[] = [
  { key: "polls", label: "Polls", icon: <HowToVoteRoundedIcon fontSize="small" /> },
  { key: "feedback", label: "Feedback", icon: <RateReviewRoundedIcon fontSize="small" /> },
];

export interface SurveyQuestion {
  id: string;
  question: string;
  kind: "choice" | "text";
  options?: PollOption[];
  myAnswer: string | null;
}

export interface SurveyGroup {
  id: string;
  tiedTo: string;
  live: boolean;
  locked: boolean;
  lockLabel?: string;
  questions: SurveyQuestion[];
}

function withVote(options: PollOption[], votedId: string | null | undefined) {
  if (!votedId) return options;
  return options.map((o) => (o.id === votedId ? { ...o, votes: o.votes + 1 } : o));
}

/**
 * Renders one session's poll/feedback group. A single question renders as
 * one plain card; multiple questions render as a click-through stepper
 * (Back/Next, same shell as the anonymous Summit feedback stepper) mixing
 * PollCard steps for choice questions and text-input steps for free text.
 */
function SurveyGroupCard({
  group,
  freshVotes,
  freshText,
  drafts,
  busyId,
  onVote,
  onDraftChange,
  onSubmitText,
}: {
  group: SurveyGroup;
  freshVotes: Record<string, string>;
  freshText: Record<string, string>;
  drafts: Record<string, string>;
  busyId: string | null;
  onVote: (questionId: string, optionLabel: string) => void;
  onDraftChange: (questionId: string, value: string) => void;
  onSubmitText: (questionId: string) => Promise<boolean>;
}) {
  const [step, setStep] = React.useState(0);
  const total = group.questions.length;

  const answerFor = (q: SurveyQuestion) =>
    q.kind === "choice" ? (freshVotes[q.id] ?? q.myAnswer) : (freshText[q.id] ?? q.myAnswer);

  if (group.locked) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-grey-500">
          <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
          {group.tiedTo}
        </p>
        <div className="rounded-(--radius-card) border border-dashed border-grey-300 p-4">
          <p className="text-xs font-medium text-grey-500">{group.lockLabel}</p>
        </div>
      </div>
    );
  }

  const allAnswered = group.questions.every((q) => answerFor(q) !== null && answerFor(q) !== undefined);
  if (total > 1 && allAnswered) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-grey-500">
          <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
          {group.tiedTo}
        </p>
        <div className="rounded-(--radius-card) border border-grey-200 bg-surface p-4">
          <p className="text-sm font-medium text-ink">Thanks — you&apos;re all set here</p>
          <ul className="mt-2 flex flex-col gap-2">
            {group.questions.map((q) => (
              <li key={q.id}>
                <p className="text-xs font-medium text-grey-500">{q.question}</p>
                <p className="text-sm text-grey-700">{answerFor(q)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const q = group.questions[step];
  const answer = answerFor(q);
  const answered = answer !== null && answer !== undefined;
  const last = step === total - 1;
  const canAdvance = q.kind === "choice" ? answered : (drafts[q.id] ?? "").trim().length > 0;

  const handleNext = async () => {
    if (q.kind === "text" && !answered) {
      const ok = await onSubmitText(q.id);
      if (!ok) return;
    }
    if (!last) setStep((s) => s + 1);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-grey-500">
        <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
        {group.tiedTo}
      </p>

      {total > 1 && (
        <p className="text-xs font-semibold uppercase tracking-wider text-grey-500">
          {step + 1} of {total}
        </p>
      )}

      {q.kind === "choice" ? (
        <PollCard
          question={q.question}
          live={group.live}
          votedId={answer}
          onVote={(optionId) => onVote(q.id, optionId)}
          options={freshVotes[q.id] ? withVote(q.options ?? [], freshVotes[q.id]) : (q.options ?? [])}
        />
      ) : (
        <div className="rounded-(--radius-card) border border-grey-200 bg-surface p-4">
          <p className="text-[15px] font-semibold leading-snug text-ink">{q.question}</p>
          {answered ? (
            <p className="mt-3 text-sm text-grey-700">{answer}</p>
          ) : (
            <TextField
              className="mt-3"
              multiline
              minRows={3}
              placeholder="Share your thoughts"
              value={drafts[q.id] ?? ""}
              onChange={(e) => onDraftChange(q.id, e.target.value)}
              fullWidth
            />
          )}
        </div>
      )}

      {total > 1 && (
        <div className="mt-1 flex justify-between">
          <Button size="small" variant="text" color="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={(!canAdvance && !answered) || busyId === q.id || (last && answered)}
            onClick={handleNext}
          >
            {last ? "Done" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function PollsPageClient({
  scheduledPolls,
  sessionFeedback,
}: {
  scheduledPolls: SurveyGroup[];
  sessionFeedback: SurveyGroup[];
}) {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const [section, setSection] = React.useState<SectionKey>("polls");
  const [freshVotes, setFreshVotes] = React.useState<Record<string, string>>({});
  const [freshText, setFreshText] = React.useState<Record<string, string>>({});
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = React.useState(false);
  const [submittingFeedback, setSubmittingFeedback] = React.useState(false);

  const voteChoice = async (questionId: string, optionLabel: string) => {
    if (freshVotes[questionId]) return;
    setFreshVotes((v) => ({ ...v, [questionId]: optionLabel }));
    const { error } = await submitPollVote(questionId, optionLabel);
    if (error) {
      setFreshVotes((v) => {
        const next = { ...v };
        delete next[questionId];
        return next;
      });
      showToast(error, "error");
      return;
    }
    showToast("Vote recorded");
  };

  const submitText = async (questionId: string): Promise<boolean> => {
    const value = (drafts[questionId] ?? "").trim();
    if (!value) return false;
    setBusyId(questionId);
    const { error } = await submitPollVote(questionId, value);
    setBusyId(null);
    if (error) {
      showToast(error, "error");
      return false;
    }
    setFreshText((v) => ({ ...v, [questionId]: value }));
    showToast("Feedback submitted — thank you");
    return true;
  };

  const renderGroups = (groups: SurveyGroup[]) => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <SurveyGroupCard
          key={group.id}
          group={group}
          freshVotes={freshVotes}
          freshText={freshText}
          drafts={drafts}
          busyId={busyId}
          onVote={voteChoice}
          onDraftChange={(questionId, value) => setDrafts((v) => ({ ...v, [questionId]: value }))}
          onSubmitText={submitText}
        />
      ))}
    </div>
  );

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
              Scheduled polls unlock automatically once each session ends — check back
              throughout the day.
            </Banner>

            <SectionHeader eyebrow="Tied to today's agenda" title="Scheduled polls" />
            {scheduledPolls.length === 0 ? (
              <EmptyState
                icon={<HowToVoteRoundedIcon sx={{ fontSize: 36 }} />}
                title="No polls yet"
                body="Session polls will show up here as today's agenda gets underway."
              />
            ) : (
              renderGroups(scheduledPolls)
            )}
          </>
        )}

        {section === "feedback" && (
          <>
            {sessionFeedback.length > 0 && (
              <>
                <SectionHeader eyebrow="Tied to today's agenda" title="Session feedback" />
                {renderGroups(sessionFeedback)}
              </>
            )}

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
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
