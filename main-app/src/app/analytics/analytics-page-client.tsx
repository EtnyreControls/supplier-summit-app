"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import PollRoundedIcon from "@mui/icons-material/PollRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  PollCard,
  StatCard,
  LabeledProgress,
  EmptyState,
  useToast,
  useProfileModal,
  useBadgeQrModal,
  AddressableList,
  VoteLeaderboard,
  FeedbackTopics,
  type PollOption,
  type AddressableItem,
  type VoteEntry,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";
import { toggleQuestionGroupChecked } from "@/lib/supabase/toggle-question-group";

/**
 * Route: /analytics ("Analytics" in TopNav, role="analytics" only —
 * see app/analytics/page.tsx for the server-side role check).
 * Sections: Questions & Feedback are ranked, checkable worklists (checking
 * an item off sends it to the bottom); Voting is a read-only leaderboard;
 * Polls shows live/closed poll results; Dashboard is a lightweight summary
 * built from the same in-memory state, so resolving items elsewhere updates
 * it live.
 *
 * Questions are real data (question_groups, fetched in page.tsx); Feedback/
 * Voting/Polls are still mock — TODO: swap those for real queries too.
 */

type SectionKey = "questions" | "feedback" | "voting" | "polls" | "dashboard";

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactElement }[] = [
  { key: "questions", label: "Questions", icon: <QuestionAnswerRoundedIcon fontSize="small" /> },
  { key: "feedback", label: "Feedback", icon: <RateReviewRoundedIcon fontSize="small" /> },
  { key: "voting", label: "Voting", icon: <HowToVoteRoundedIcon fontSize="small" /> },
  { key: "polls", label: "Polls", icon: <PollRoundedIcon fontSize="small" /> },
  { key: "dashboard", label: "Dashboard", icon: <InsightsRoundedIcon fontSize="small" /> },
];

const INITIAL_FEEDBACK: AddressableItem[] = [
  { id: "f1", text: "Breakout rooms ran long — Q&A got cut short twice.", count: 17, groupCount: 4, addressed: false, addressedAt: null },
  { id: "f2", text: "Would love more hands-on demo time next year vs. slides.", count: 13, groupCount: 3, addressed: false, addressedAt: null },
  { id: "f3", text: "Wifi in Breakout Room B was unreliable during the session.", count: 10, addressed: false, addressedAt: null },
  { id: "f4", text: "Lunch line took 40+ minutes — consider a second station.", count: 9, groupCount: 2, addressed: false, addressedAt: null },
  { id: "f5", text: "Loved the logistics breakout — more like this please.", count: 7, addressed: false, addressedAt: null },
  { id: "f6", text: "Badge printer at check-in jammed twice this morning.", count: 4, addressed: true, addressedAt: 1 },
];

const VOTE_TOPICS: VoteEntry[] = [
  { id: "v1", label: "Supplier scorecards deep-dive", votes: 142 },
  { id: "v2", label: "AI in demand forecasting", votes: 118 },
  { id: "v3", label: "Freight & logistics optimization", votes: 96 },
  { id: "v4", label: "Sustainable sourcing practices", votes: 71 },
  { id: "v5", label: "Supplier diversity program", votes: 44 },
];

const VOTE_SESSIONS: VoteEntry[] = [
  { id: "s1", label: "Supply chain roadmap keynote", votes: 88 },
  { id: "s2", label: "Manufacturing & quality breakout", votes: 61 },
  { id: "s3", label: "Logistics & fulfillment breakout", votes: 54 },
  { id: "s4", label: "Q&A with leadership", votes: 37 },
];

interface AnalyticsPoll {
  id: string;
  question: string;
  live: boolean;
  options: PollOption[];
}

const POLLS: AnalyticsPoll[] = [
  {
    id: "p1",
    question: "Which topic should headline next year's keynote?",
    live: true,
    options: [
      { id: "o1", label: "Supply chain resilience", votes: 61 },
      { id: "o2", label: "AI-driven forecasting", votes: 54 },
      { id: "o3", label: "Sustainability & ESG", votes: 22 },
    ],
  },
  {
    id: "p2",
    question: "How would you rate today's breakout sessions?",
    live: false,
    options: [
      { id: "o4", label: "Excellent", votes: 77 },
      { id: "o5", label: "Good", votes: 45 },
      { id: "o6", label: "Fair", votes: 11 },
      { id: "o7", label: "Needs work", votes: 4 },
    ],
  },
  {
    id: "p3",
    question: "Preferred cadence for supplier check-ins?",
    live: false,
    options: [
      { id: "o8", label: "Monthly", votes: 58 },
      { id: "o9", label: "Quarterly", votes: 66 },
      { id: "o10", label: "As-needed", votes: 19 },
    ],
  },
];

function addressedRate(items: AddressableItem[]) {
  if (items.length === 0) return 0;
  return (items.filter((i) => i.addressed).length / items.length) * 100;
}

export function AnalyticsPageClient({ initialQuestions }: { initialQuestions: AddressableItem[] }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const [section, setSection] = React.useState<SectionKey>("questions");
  const [questions, setQuestions] = React.useState(initialQuestions);
  const [feedback, setFeedback] = React.useState(INITIAL_FEEDBACK);
  const [regrouping, setRegrouping] = React.useState(false);
  const clockRef = React.useRef(10);

  // Regrouping (merging near-duplicate questions) changes which ids exist,
  // so it can't be applied as a local optimistic patch like toggleQuestion
  // — this re-syncs local state whenever page.tsx's server query re-runs.
  React.useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  const handleRegroup = async () => {
    setRegrouping(true);
    try {
      const res = await fetch("/api/questions/groups/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Regroup failed");
      router.refresh();
      showToast("Questions regrouped");
    } catch {
      showToast("Couldn't regroup questions", "error");
    } finally {
      setRegrouping(false);
    }
  };

  const toggleQuestion = async (id: string) => {
    const current = questions.find((q) => q.id === id);
    if (!current) return;
    const nextAddressed = !current.addressed;

    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, addressed: nextAddressed, addressedAt: nextAddressed ? Date.now() : null } : q))
    );

    const { error } = await toggleQuestionGroupChecked(id, nextAddressed);
    if (error) {
      setQuestions((prev) => prev.map((q) => (q.id === id ? current : q)));
      showToast(error, "error");
    }
  };
  const toggleFeedback = (id: string) =>
    setFeedback((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, addressed: !f.addressed, addressedAt: f.addressed ? null : clockRef.current++ } : f
      )
    );

  const questionsOpen = questions.filter((q) => !q.addressed).length;
  const feedbackOpen = feedback.filter((f) => !f.addressed).length;

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeKey="analytics"
        logo={<NavLogo />}
        initials="SC"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />

      <PageContainer>
        <SectionHeader eyebrow="Analytics only" title="Analytics" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          {/* Desktop sidebar — same active-item convention as TopNav's mobile drawer. */}
          <nav
            aria-label="Analytics sections"
            className="hidden rounded-(--radius-card) border border-grey-200 bg-surface p-2 lg:sticky lg:top-24 lg:block"
          >
            {SECTIONS.map((s) => {
              const active = s.key === section;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-(--radius-control) border-l-[3px] px-3 py-3 text-left text-sm transition-colors ${
                    active
                      ? "border-yellow bg-yellow-tint font-semibold text-ink"
                      : "border-transparent text-grey-700 hover:bg-grey-50"
                  }`}
                >
                  <span className={active ? "text-ink" : "text-grey-500"}>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Mobile section switcher */}
          <div className="-mx-1 lg:hidden">
            <Tabs
              value={section}
              onChange={(_, v: SectionKey) => setSection(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Analytics sections"
            >
              {SECTIONS.map((s) => (
                <Tab key={s.key} value={s.key} icon={s.icon} iconPosition="start" label={s.label} sx={{ minHeight: 44 }} />
              ))}
            </Tabs>
          </div>

          <div>
            {section === "questions" && (
              <>
                <SectionHeader
                  eyebrow={`${questionsOpen} open`}
                  title="Submitted questions"
                  action={
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleRegroup}
                      disabled={regrouping}
                      startIcon={
                        regrouping ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <RefreshRoundedIcon fontSize="small" />
                        )
                      }
                    >
                      {regrouping ? "Regrouping…" : "Regroup"}
                    </Button>
                  }
                />
                <AddressableList items={questions} onToggle={toggleQuestion} />
              </>
            )}

            {section === "feedback" && (
              <>
                <SectionHeader eyebrow={`${feedbackOpen} open`} title="Session feedback" />
                <AddressableList items={feedback} onToggle={toggleFeedback} countLabel="flags" />

                <SectionHeader eyebrow="Auto-clustered" title="Feedback Topics" />
                <FeedbackTopics showToast={showToast} />
              </>
            )}

            {section === "voting" && (
              <>
                <SectionHeader eyebrow="Ranked results" title="Voting" />
                <div className="flex flex-col gap-4">
                  <VoteLeaderboard title="Next year's topic vote" entries={VOTE_TOPICS} />
                  <VoteLeaderboard title="Most-attended session (by badge scan)" entries={VOTE_SESSIONS} />
                </div>
              </>
            )}

            {section === "polls" && (
              <>
                <SectionHeader eyebrow="Live & closed" title="Poll results" />
                <div className="flex flex-col gap-4">
                  {POLLS.map((poll) => (
                    <PollCard key={poll.id} question={poll.question} options={poll.options} live={poll.live} showResults />
                  ))}
                </div>
              </>
            )}

            {section === "dashboard" && (
              <>
                <SectionHeader eyebrow="Overview" title="Analytics dashboard" />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard value="486" label="Badges checked in" />
                  <StatCard value={String(questions.length + feedback.length)} label="Submissions today" />
                  <StatCard value="79%" label="Poll participation" />
                  <StatCard value="4.4 / 5" label="Avg. session rating" />
                </div>

                <SectionHeader eyebrow="Follow-up" title="Resolution progress" />
                <div className="flex flex-col gap-4 rounded-(--radius-card) border border-grey-200 bg-surface p-4">
                  <LabeledProgress label="Questions addressed" value={addressedRate(questions)} />
                  <LabeledProgress label="Feedback reviewed" value={addressedRate(feedback)} />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <VoteLeaderboard title="Top question themes" entries={VOTE_TOPICS.slice(0, 4)} />
                  <VoteLeaderboard title="Engagement by session" entries={VOTE_SESSIONS} />
                </div>

                {questionsOpen === 0 && feedbackOpen === 0 && (
                  <div className="mt-6">
                    <EmptyState title="All caught up" body="Every question and feedback item has been addressed." />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
