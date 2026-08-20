"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  ChipspreaderMarquee,
  AsphaltDistributorLoader,
  GrowthMachineBoardViewer,
  EmptyState,
  useToast,
  useProfileModal,
  useBadgeQrModal,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";
import { enterGrowthMachine, getGrowthMachineStatus } from "@/lib/supabase/growth-machine";
import { getLatestGrowthMachineBoardForTable } from "@/lib/supabase/get-growth-machine-board";
import { createClient } from "@/lib/supabase/client";

/**
 * Gates the whole page on live_state.growth_machine_session_live (toggled
 * from /admin/live) — attendees see a locked screen until the admin turns
 * the session on, and it unlocks live for everyone already on the page via
 * the same Supabase Realtime subscription the agenda/banner use.
 */
function useGrowthMachineSessionLock() {
  const [checkingLock, setCheckingLock] = React.useState(true);
  const [sessionLive, setSessionLive] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("live_state")
      .select("growth_machine_session_live")
      .eq("id", true)
      .single()
      .then(({ data }) => {
        setSessionLive(Boolean(data?.growth_machine_session_live));
        setCheckingLock(false);
      });

    const channel = supabase
      .channel("growth-machine-session-lock")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_state" },
        (payload) => {
          const updated = payload.new as { growth_machine_session_live: boolean };
          setSessionLive(updated.growth_machine_session_live);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { checkingLock, sessionLive };
}

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
    <Button
      variant={selected ? "contained" : "outlined"}
      onClick={onSelect}
      aria-pressed={selected}
      className="flex h-[132px] w-[132px] flex-col items-center gap-2 sm:h-[150px] sm:w-[150px]"
    >
      <Icon sx={{ fontSize: 32 }} />
      {role.label}
    </Button>
  );
}

/**
 * Once a table has submitted its board, there's nothing left to pick a
 * role for — everyone at that table just sees the finished board
 * (GrowthMachineBoardViewer, same grid-then-static-page view analytics
 * uses), and the table's Builder additionally gets an "Edit board" action
 * to go back into the live canvas. `checkingStatus` covers the brief
 * get_growth_machine_status() round-trip before either that or the normal
 * role picker below can render.
 */
function useGrowthMachineStatus() {
  const [checkingStatus, setCheckingStatus] = React.useState(true);
  const [submission, setSubmission] = React.useState<{
    tableId: string;
    isBuilder: boolean;
    snapshot: unknown | null;
    error: string | null;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getGrowthMachineStatus()
      .then(async (status) => {
        if (cancelled) return;
        if (status.error || !status.hasSubmission || !status.tableId) {
          setCheckingStatus(false);
          return;
        }
        const { snapshot, error } = await getLatestGrowthMachineBoardForTable(status.tableId);
        if (cancelled) return;
        setSubmission({ tableId: status.tableId, isBuilder: status.isBuilder, snapshot, error });
        setCheckingStatus(false);
      })
      .catch(() => {
        // RPC unavailable, signed-out local dev, etc. — fall back to the
        // normal role picker rather than blocking the page.
        if (!cancelled) setCheckingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { checkingStatus, submission };
}

export default function GrowthMachinePage() {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
  const [joining, setJoining] = React.useState(false);
  const { checkingStatus, submission } = useGrowthMachineStatus();
  const { checkingLock, sessionLive } = useGrowthMachineSessionLock();

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

  if (checkingStatus || checkingLock) {
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
        <AsphaltDistributorLoader label="Loading" />
        {profileModal}
        {badgeQrModal}
      </div>
    );
  }

  if (submission) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        {submission.snapshot ? (
          <GrowthMachineBoardViewer
            snapshot={submission.snapshot}
            onClose={() => router.push("/welcome")}
            editHref={submission.isBuilder ? `/growth-machine/board?role=builder&table=${submission.tableId}` : undefined}
          />
        ) : (
          <>
            <TopNav
              activeKey="growth-machine"
              logo={<NavLogo />}
              initials="SC"
              onQrClick={openBadgeQr}
              onProfile={openProfile}
              onLogout={handleLogout}
            />
            <PageContainer className="flex grow flex-col items-center justify-center text-center">
              <p className="text-sm text-grey-600">{submission.error ?? "Couldn't load the submitted board."}</p>
            </PageContainer>
          </>
        )}
        {profileModal}
        {badgeQrModal}
      </div>
    );
  }

  if (!sessionLive) {
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
        <PageContainer className="flex grow flex-col items-center justify-center">
          <EmptyState
            icon={<LockRoundedIcon fontSize="large" />}
            title="Growth Machine hasn't started yet"
            body="This session unlocks the moment it goes live — check back shortly."
          />
        </PageContainer>
        {profileModal}
        {badgeQrModal}
      </div>
    );
  }

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

        {/* grow soaks up the leftover viewport height below the role picker;
            justify-center parks the marquee in the middle of that gap, i.e.
            halfway between the Builder/Spectator block and the page bottom. */}
        <div className="flex grow flex-col justify-center">
          <ChipspreaderMarquee />
        </div>
      </PageContainer>
      {joining && <AsphaltDistributorLoader label="Joining table" />}
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
