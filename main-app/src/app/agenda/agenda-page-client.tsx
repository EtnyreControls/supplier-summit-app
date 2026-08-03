"use client";
import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  SpeakerCard,
  AgendaTimeline,
  SessionDetail,
  EmptyState,
  useToast,
  useProfileModal,
  useBadgeQrModal,
  type AgendaSession,
  type AgendaSpeaker,
} from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";

/**
 * The sidebar rail only shows a 4-session window — one before, the live
 * session, and two after (sessions is already ordered by start_time, see
 * page.tsx) — rather than the full agenda, so it stays a quick "what's now
 * and next" glance instead of a long scroll. Falls back to the first
 * session as the anchor when nothing is live yet. Clamped at either end of
 * the array so it still returns 4 items (just shifted) near the start/end
 * of the day, rather than a short window.
 */
function windowedSessions(sessions: AgendaSession[]): AgendaSession[] {
  if (sessions.length <= 4) return sessions;
  const liveIndex = sessions.findIndex((s) => s.live);
  const anchor = liveIndex === -1 ? 0 : liveIndex;
  let start = anchor - 1;
  let end = start + 4;
  if (start < 0) {
    start = 0;
    end = 4;
  }
  if (end > sessions.length) {
    end = sessions.length;
    start = end - 4;
  }
  return sessions.slice(start, end);
}

/**
 * Client half of /agenda — takes sessions/speakers already fetched
 * server-side (see page.tsx) and owns the interactive timeline selection.
 */
export function AgendaPageClient({
  sessions,
  speakers,
}: {
  sessions: AgendaSession[];
  speakers: AgendaSpeaker[];
}) {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const defaultSession = sessions.find((s) => s.live) ?? sessions[0];
  const [selectedId, setSelectedId] = React.useState(defaultSession?.id ?? "");
  const selected = sessions.find((s) => s.id === selectedId) ?? defaultSession;
  const speakersFor = (ids: string[]) => speakers.filter((sp) => ids.includes(sp.id));
  const visibleSessions = React.useMemo(() => windowedSessions(sessions), [sessions]);
  const [viewAllOpen, setViewAllOpen] = React.useState(false);
  // Mobile-only accordion: which row's detail is expanded inline (see
  // renderExpanded below). null = nothing expanded.
  const [mobileExpandedId, setMobileExpandedId] = React.useState<string | null>(null);

  // Desktop already shows the selected session inline next to the rail
  // (the lg:grid-cols-[360px_1fr] column below) — no expand-in-place
  // needed there, it'd just duplicate that column. Mobile stacks to a
  // single column, so tapping a row expands its detail inline instead.
  const [isDesktop, setIsDesktop] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const selectSession = (id: string) => {
    setSelectedId(id);
    if (!isDesktop) setMobileExpandedId((prev) => (prev === id ? null : id));
  };

  // Desktop: picking a session in the "view all" list also closes it,
  // same as before. Mobile: leave it open and just expand the row inline
  // (browsing + expanding without losing your place in the full list).
  const selectFromModal = (id: string) => {
    selectSession(id);
    if (isDesktop) setViewAllOpen(false);
  };

  const renderSessionDetail = (session: AgendaSession) => (
    <SessionDetail session={session} speakers={speakersFor(session.speakerIds)} />
  );

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeKey="agenda"
        logo={<NavLogo />}
        initials="SC"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />
      <PageContainer>
        <SectionHeader eyebrow="Schedule" title="Agenda" />

        {selected ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <AgendaTimeline
                sessions={visibleSessions}
                selectedId={selectedId}
                onSelect={selectSession}
                expandedId={mobileExpandedId}
                renderExpanded={isDesktop ? undefined : renderSessionDetail}
              />

              {sessions.length > visibleSessions.length && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setViewAllOpen(true)}
                  sx={{ mt: 1, minWidth: 0, px: 0.5 }}
                >
                  View all sessions
                </Button>
              )}

              {/* Mobile-only quick strip — mirrors the wireframe's row of speaker
                  avatars under the agenda list; jumps to the full directory. */}
              {speakers.length > 0 && (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1 lg:hidden">
                  {speakers.map((sp) => (
                    <a
                      key={sp.id}
                      href="#all-speakers"
                      className="flex shrink-0 flex-col items-center gap-1"
                    >
                      <Avatar sx={{ width: 46, height: 46, fontSize: 15 }}>{sp.initials}</Avatar>
                      <span className="max-w-[64px] truncate text-[11px] text-grey-600">
                        {sp.name.split(" ")[0]}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop only — mobile expands the same content inline under
                the tapped row instead (see renderSessionDetail above),
                since there's no adjacent column to point it at on a
                single-column layout. */}
            <div className="hidden lg:block">
              <SessionDetail session={selected} speakers={speakersFor(selected.speakerIds)} />
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<EventBusyRoundedIcon fontSize="large" />}
            title="No sessions to show yet"
            body="Either the schedule hasn't been published, or you need to be signed in to view it."
          />
        )}

        {speakers.length > 0 && (
          <>
            <SectionHeader eyebrow="Meet the lineup" title="All speakers" />
            <div id="all-speakers" className="scroll-mt-24 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {speakers.map((sp) => (
                <SpeakerCard key={sp.id} {...sp} />
              ))}
            </div>
          </>
        )}
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}

      <Dialog open={viewAllOpen} onClose={() => setViewAllOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle className="flex items-center justify-between gap-2">
          All sessions
          <IconButton aria-label="Close" onClick={() => setViewAllOpen(false)} size="small">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: "70vh", overflowY: "auto" }}>
          <AgendaTimeline
            sessions={sessions}
            selectedId={selectedId}
            onSelect={selectFromModal}
            expandedId={mobileExpandedId}
            renderExpanded={isDesktop ? undefined : renderSessionDetail}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
