"use client";
import * as React from "react";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  EmptyState,
  MyQuestionsList,
  useToast,
  useProfileModal,
  useBadgeQrModal,
  type SubmittedQuestion,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";

export function QuestionsPageClient({ initialQuestions }: { initialQuestions: SubmittedQuestion[] }) {
  const { toast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeKey="questions"
        logo={<NavLogo />}
        initials="SC"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />
      <PageContainer>
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
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
