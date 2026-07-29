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
import { enterGrowthMachine } from "@/lib/supabase/growth-machine";

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
  const [joining, setJoining] = React.useState(false);

  const chooseRole = async (role: Role) => {
    if (joining) return;
    setSelectedRole(role);
    setJoining(true);

    // Resolve the attendee's assigned table and claim/release the builder
    // seat in the database — one builder per table is enforced there (see
    // the growth_machine_board_sync migration), so two people tapping
    // Builder at once can't both get it.
    // On error (RPC unavailable, signed-out local dev) fall back to the
    // shared default room with the chosen role — same as before the
    // database wiring, so the board is never blocked on the lookup.
    const { tableId, isBuilder } = await enterGrowthMachine(role === "builder").catch(() => ({
      tableId: null,
      isBuilder: false,
    }));

    let finalRole: Role = role;
    if (role === "builder" && !isBuilder && tableId) {
      finalRole = "spectator";
      showToast("Your table already has a Builder — joining as a Spectator");
    }

    const table = tableId ? `&table=${tableId}` : "";
    // Brief pause so the green "answered" state is visible before the
    // board route takes over.
    setTimeout(() => router.push(`/growth-machine/board?role=${finalRole}${table}`), 180);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TopNav
        activeKey="growth-machine"
        logo={<NavLogo />}
        initials="SC"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />
      <PageContainer className="flex grow flex-col">
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

        {/* grow soaks up the leftover viewport height below the role picker;
            justify-center parks the marquee in the middle of that gap, i.e.
            halfway between the Builder/Spectator block and the page bottom. */}
        <div className="flex grow flex-col justify-center">
          <ChipspreaderMarquee />
        </div>
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
