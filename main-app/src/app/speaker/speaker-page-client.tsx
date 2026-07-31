"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  EmptyState,
  useToast,
  useProfileModal,
  useBadgeQrModal,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";
import { decideRouting } from "@/lib/supabase/decide-routing";

export interface RoutedQuestion {
  routingId: string;
  questionId: string;
  questionText: string;
  similarityScore: number | null;
  createdAt: string;
}

/**
 * Route: /speaker. A speaker's pending routing queue — Accept keeps the row
 * as-is (status flips to "accepted"); Decline hands the question back to
 * decideRouting, which re-routes it to the next-best remaining speaker
 * server-side. Either way the item drops out of this list immediately.
 */
export function SpeakerPageClient({ initialRouting }: { initialRouting: RoutedQuestion[] }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const [routing, setRouting] = React.useState(initialRouting);
  const [decidingId, setDecidingId] = React.useState<string | null>(null);

  const handleDecide = async (item: RoutedQuestion, decision: "accepted" | "declined") => {
    setDecidingId(item.routingId);
    const { error } = await decideRouting(item.routingId, decision, item.questionId, item.questionText);
    setDecidingId(null);

    if (error) {
      showToast(error, "error");
      return;
    }

    setRouting((prev) => prev.filter((r) => r.routingId !== item.routingId));
    showToast(decision === "accepted" ? "Question accepted" : "Question declined — routing to the next speaker");
    router.refresh();
  };

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
        <SectionHeader eyebrow={`${routing.length} pending`} title="Questions routed to you" />

        {routing.length === 0 ? (
          <EmptyState title="No pending questions" body="Questions routed to you will show up here." />
        ) : (
          <div className="flex flex-col gap-3">
            {routing.map((item) => (
              <div key={item.routingId} className="rounded-(--radius-card) border border-grey-200 bg-surface p-4">
                <p className="text-[15px] text-ink">{item.questionText}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<CheckRoundedIcon fontSize="small" />}
                    disabled={decidingId === item.routingId}
                    onClick={() => handleDecide(item, "accepted")}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloseRoundedIcon fontSize="small" />}
                    disabled={decidingId === item.routingId}
                    onClick={() => handleDecide(item, "declined")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
