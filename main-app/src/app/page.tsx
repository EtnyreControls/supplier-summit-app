"use client";
import * as React from "react";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { PageContainer, SectionHeader, ListRow, TopNav, Banner, useToast, useProfileModal, useBadgeQrModal, SummitSummary, NavLogo, OnboardingTour } from "@/components";
import { EtnBanner } from "@/components/homepage/etn-banner"
import { MissionVision } from "@/components/homepage/mission-vision";
import { OurValues } from "@/components/homepage/values"
import { JourneyRoadmap } from "@/components/homepage/journey-roadmap";
import { RoadAheadDial } from "@/components/homepage/road-ahead-dial";
import { BusinessUnits } from "@/components/homepage/business-units";
import { GrowthMachine } from "@/components";
import { useSignOut } from "@/lib/supabase/use-sign-out";
import { createClient } from "@/lib/supabase/client";

/**
 * Route: / (landing page)
 * Part 1: Event Info, scoped deliberately narrow to avoid overlapping
 * the dedicated Agenda & Speakers page — see project whiteboard notes.
 * Three pieces only: a quiet "welcome back" for returning sessions
 * (the animated WelcomeReveal at /welcome only plays once, right after
 * QR login), a live Now/Next strip, and a single redirect card into
 * Agenda & Speakers rather than a duplicated list.
 *
 * TODO: swap the static session data below for real session state and the
 * live Now/Next feed once Supabase Realtime is wired up.
 */
export default function Home() {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const [firstName, setFirstName] = React.useState("Attendee");

  React.useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user").select("first_name").eq("user_id", user.id).single();
      if (data?.first_name) setFirstName(data.first_name);
    })();
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        activeKey="about"
        logo={<NavLogo />}
        initials="SC"
        onQrClick={openBadgeQr}
        onProfile={openProfile}
        onLogout={handleLogout}
      />
      <PageContainer>
        <SummitSummary
          name={firstName}
          stats={[
            { label: "Attendees", value: "480" },
            { label: "Speakers", value: "24" },
            { label: "Sessions", value: "36" },
            { label: "Exhibitors", value: "18" },
          ]}
        />
        <SectionHeader eyebrow="About Us" title="Our Brand" />
        <MissionVision />
        <OurValues />
        <BusinessUnits />
        <SectionHeader eyebrow="Our History" title="Roadmap of the Etnyre Journey" />
        <JourneyRoadmap />
        <SectionHeader title="Road Ahead" />
        <RoadAheadDial />
        <EtnBanner />
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
      <OnboardingTour />
    </div>
  );
}