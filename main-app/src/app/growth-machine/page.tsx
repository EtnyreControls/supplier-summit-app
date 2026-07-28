"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  ChipspreaderMarquee,
  useToast,
  useProfileModal,
  useBadgeQrModal,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";

/**
 * Route: /growth-machine ("Growth Machine" in TopNav)
 * Entry gate for the Growth Machine whiteboard session — pick a role, then
 * get sent straight to /growth-machine/board?role=... , which renders the
 * real collaborative Tldraw canvas (components/text.tsx) and enforces the
 * role: Builder can draw, Spectator is put in the editor's readonly mode
 * (editor.updateInstanceState({ isReadonly: true }) in onMount) so they can
 * only watch the Builder's changes, not make their own.
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
        selected
          ? "border-green bg-green-tint"
          : "border-grey-200 bg-surface hover:border-grey-400"
      }`}
    >
      <Icon className={selected ? "text-ink" : "text-grey-500"} sx={{ fontSize: 32 }} />
    </button>
  );
}

export default function GrowthMachinePage() {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);

  const chooseRole = (role: Role) => {
    setSelectedRole(role);
    // Brief pause so the green "answered" state is visible before the
    // board route takes over.
    setTimeout(() => router.push(`/growth-machine/board?role=${role}`), 180);
  };

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
        <SectionHeader eyebrow="Collaborate live" title="Growth Machine" />

        <div className="flex flex-col items-center gap-8 py-6 sm:flex-row sm:justify-center sm:gap-14">
          <RoleCard
            role={ROLES[0]}
            selected={selectedRole === ROLES[0].id}
            onSelect={() => chooseRole(ROLES[0].id)}
          />

          <div className="hidden flex-col items-center gap-2 sm:flex">
            <span className="h-10 w-px bg-grey-200" />
            <span className="text-xs font-semibold uppercase tracking-wide text-grey-500">Or</span>
            <span className="h-10 w-px bg-grey-200" />
          </div>

          <RoleCard
            role={ROLES[1]}
            selected={selectedRole === ROLES[1].id}
            onSelect={() => chooseRole(ROLES[1].id)}
          />
        </div>

        <div className="-mt-2 flex justify-center gap-8 sm:gap-14">
          <p className="w-[132px] text-center text-sm font-medium text-ink sm:w-[150px]">
            {ROLES[0].label}
          </p>
          <div className="hidden w-10 sm:block" />
          <p className="w-[132px] text-center text-sm font-medium text-ink sm:w-[150px]">
            {ROLES[1].label}
          </p>
        </div>

        <ChipspreaderMarquee />
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
