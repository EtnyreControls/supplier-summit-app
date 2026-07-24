"use client";
import * as React from "react";
import Avatar from "@mui/material/Avatar";
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
              <AgendaTimeline sessions={sessions} selectedId={selectedId} onSelect={setSelectedId} />

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

            <SessionDetail session={selected} speakers={speakersFor(selected.speakerIds)} />
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
    </div>
  );
}
