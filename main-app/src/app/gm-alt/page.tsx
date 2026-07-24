"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { PageContainer, SectionHeader, TopNav, NavLogo, useToast, useProfileModal, useBadgeQrModal } from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";

/**
 * Route: /gm-alt
 * Excalidraw-based backup of /growth-machine (which uses tldraw — a
 * commercial license is required for production use of tldraw; this route
 * mirrors the same role-picker → collaborative-board flow, built on the
 * MIT-licensed Excalidraw instead, as a drop-in fallback if that license
 * isn't secured). See components/gm-alt/excalidraw-board.tsx for the
 * canvas implementation and the license-comparison notes.
 *
 * Deliberately unlinked from TopNav's nav items — this is a backup
 * implementation to evaluate, not a second user-facing feature alongside
 * the real Growth Machine entry.
 */
type Role = "builder" | "spectator";

const ROLES: { id: Role; label: string; description: string; icon: typeof ConstructionRoundedIcon }[] = [
  {
    id: "builder",
    label: "Builder",
    description: "Add and edit ideas on the shared canvas.",
    icon: ConstructionRoundedIcon,
  },
  {
    id: "spectator",
    label: "Spectator",
    description: "Follow along and watch the canvas update live.",
    icon: VisibilityRoundedIcon,
  },
];

function RoleCard({
  role,
  selected,
  onSelect,
}: {
  role: (typeof ROLES)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = role.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-[132px] w-[132px] flex-col items-center justify-center gap-2 rounded-(--radius-card) border-2 transition-colors sm:h-[150px] sm:w-[150px] ${
        selected ? "border-yellow bg-yellow-tint" : "border-grey-200 bg-surface hover:border-grey-400"
      }`}
    >
      <Icon className={selected ? "text-ink" : "text-grey-500"} sx={{ fontSize: 32 }} />
    </button>
  );
}

export default function GmAltPage() {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeKey="growth-machine"
        logo={<NavLogo />}
        initials="SC"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />
      <PageContainer>
        <SectionHeader eyebrow="Collaborate live · Excalidraw backup" title="Growth Machine (alt)" />

        <div className="flex flex-col items-center gap-8 py-6 sm:flex-row sm:justify-center sm:gap-14">
          <RoleCard role={ROLES[0]} selected={false} onSelect={() => router.push(`/gm-alt/board?role=${ROLES[0].id}`)} />

          <div className="hidden flex-col items-center gap-2 sm:flex">
            <span className="h-10 w-px bg-grey-200" />
            <span className="text-xs font-semibold uppercase tracking-wide text-grey-500">Or</span>
            <span className="h-10 w-px bg-grey-200" />
          </div>

          <RoleCard role={ROLES[1]} selected={false} onSelect={() => router.push(`/gm-alt/board?role=${ROLES[1].id}`)} />
        </div>

        <div className="-mt-2 flex justify-center gap-8 sm:gap-14">
          <p className="w-[132px] text-center text-sm font-medium text-ink sm:w-[150px]">{ROLES[0].label}</p>
          <div className="hidden w-10 sm:block" />
          <p className="w-[132px] text-center text-sm font-medium text-ink sm:w-[150px]">{ROLES[1].label}</p>
        </div>
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
