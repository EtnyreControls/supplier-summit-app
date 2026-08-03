"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  EmptyState,
  useToast,
  useProfileModal,
  useBadgeQrModal,
  AddressableList,
  type AddressableItem,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";
import { decideRouting } from "@/lib/supabase/decide-routing";
import { acceptQuestionRouting } from "@/lib/supabase/accept-question-routing";
import { toggleQuestionGroupChecked } from "@/lib/supabase/toggle-question-group";
import { answerQuestionGroup } from "@/lib/supabase/answer-question-group";
import type { PendingRoutingAttempt } from "./page";

/**
 * Route: /speaker. Same grouped/checkbox/answer format as analytics'
 * Questions tab (AddressableList) — there's no separate "Accept" button.
 * Checking a question off or submitting an answer IS accepting it: both
 * handlers call acceptQuestionRouting first (idempotent per group via
 * acceptedGroups below), which is what actually grants RLS permission to
 * write to the group (see accept_question_routing() in its migration).
 * Decline stays a distinct action since it does real work — re-routing to
 * the next speaker — that answering doesn't imply.
 */
export function SpeakerPageClient({
  initialQuestions,
  routingByGroupId,
}: {
  initialQuestions: AddressableItem[];
  routingByGroupId: Record<string, PendingRoutingAttempt[]>;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const [questions, setQuestions] = React.useState(initialQuestions);
  const acceptedGroups = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  // Accepts every still-pending routing attempt behind this group, once per
  // group — the first answer/checkbox interaction is what claims it, so
  // neither handler below needs its own "Accept" step visible to the user.
  const ensureAccepted = async (groupId: string): Promise<{ error: string | null }> => {
    if (acceptedGroups.current.has(groupId)) return { error: null };
    const attempts = routingByGroupId[groupId] ?? [];
    for (const attempt of attempts) {
      const { error } = await acceptQuestionRouting(attempt.routingId);
      if (error) return { error };
    }
    acceptedGroups.current.add(groupId);
    return { error: null };
  };

  const toggleQuestion = async (id: string) => {
    const current = questions.find((q) => q.id === id);
    if (!current) return;
    const nextAddressed = !current.addressed;

    const { error: acceptError } = await ensureAccepted(id);
    if (acceptError) {
      showToast(acceptError, "error");
      return;
    }

    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, addressed: nextAddressed, addressedAt: nextAddressed ? Date.now() : null } : q))
    );

    const { error } = await toggleQuestionGroupChecked(id, nextAddressed);
    if (error) {
      setQuestions((prev) => prev.map((q) => (q.id === id ? current : q)));
      showToast(error, "error");
    }
  };

  const handleSubmitAnswer = async (groupId: string, answerText: string) => {
    const { error: acceptError } = await ensureAccepted(groupId);
    if (acceptError) {
      showToast(acceptError, "error");
      return;
    }

    const { error } = await answerQuestionGroup(groupId, answerText);
    if (error) {
      showToast(error, "error");
      return;
    }
    setQuestions((prev) =>
      prev.map((q) => (q.id === groupId ? { ...q, answerText, addressed: true, addressedAt: Date.now() } : q))
    );
    showToast("Answer saved");
  };

  const handleDecline = async (groupId: string) => {
    const attempts = routingByGroupId[groupId] ?? [];
    for (const attempt of attempts) {
      const { error } = await decideRouting(attempt.routingId, "declined", attempt.questionId, attempt.questionText);
      if (error) {
        showToast(error, "error");
        return;
      }
    }
    setQuestions((prev) => prev.filter((q) => q.id !== groupId));
    showToast("Declined — routing to the next speaker");
    router.refresh();
  };

  const openCount = questions.filter((q) => !q.addressed).length;

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeKey="speaker"
        logo={<NavLogo />}
        initials="SP"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />

      <PageContainer>
        <SectionHeader eyebrow={`${openCount} pending`} title="Questions routed to you" />

        {questions.length === 0 ? (
          <EmptyState title="No pending questions" body="Questions routed to you will show up here." />
        ) : (
          <AddressableList
            items={questions}
            onToggle={toggleQuestion}
            onSubmitAnswer={handleSubmitAnswer}
            onDecline={handleDecline}
          />
        )}
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
