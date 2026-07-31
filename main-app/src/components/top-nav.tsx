"use client";
import * as React from "react";
import Link from "next/link";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import RecordVoiceOverRoundedIcon from "@mui/icons-material/RecordVoiceOverRounded";
import { ModeToggle } from "./mode-toggle";
import { createClient } from "@/lib/supabase/client";

export interface NavItem {
  key: string;
  label: string;
  href: string; // routes ("/agenda") or scroll anchors ("/#about")
  icon?: React.ReactNode; // shown in the mobile drawer
}

/**
 * Fixed app-wide nav — the three sections defined for this project, plus
 * Analytics, which is appended at render time only for role="analytics"
 * users (see the role fetch in TopNav below).
 */
const NAV_ITEMS: NavItem[] = [
  { key: "about", label: "About Us", href: "/#about" },
  { key: "agenda", label: "Agenda & Speakers", href: "/agenda" },
  { key: "polls", label: "Polls & Feedback", href: "/polls" },
  { key: "questions", label: "My Questions", href: "/questions" },
  { key: "growth-machine", label: "Growth Machine", href: "/growth-machine" },
];

const ANALYTICS_NAV_ITEM: NavItem = {
  key: "analytics",
  label: "Analytics",
  href: "/analytics",
  icon: <InsightsRoundedIcon sx={{ fontSize: 16 }} />,
};

const SPEAKER_NAV_ITEM: NavItem = {
  key: "speaker",
  label: "Speaker Inbox",
  href: "/speaker",
  icon: <RecordVoiceOverRoundedIcon sx={{ fontSize: 16 }} />,
};

/**
 * Responsive top navigation.
 * Desktop (md+): logo · centered links (yellow underline = active) · QR + profile.
 * Mobile: hamburger (far left) · logo · QR + profile; links live in a drawer.
 * The QR button is the ONE yellow element in the bar — keep it that way.
 * For scroll-anchor items ("/#about"), pair with useScrollSpy for activeKey.
 */
export function TopNav({
  activeKey,
  logo,
  initials,
  onQrClick,
  onProfile,
  onLogout,
}: {
  activeKey?: string;
  logo: React.ReactNode;
  initials: string;
  onQrClick?: () => void;
  onProfile?: () => void;
  onLogout?: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const [isAnalytics, setIsAnalytics] = React.useState(false);
  const [isSpeaker, setIsSpeaker] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user").select("role").eq("user_id", user.id).single();
      if (data?.role === "analytics") setIsAnalytics(true);
      if (data?.role === "speaker") setIsSpeaker(true);
    })();
  }, []);

  // Analytics/speaker-role users are staff, not attendees — "My questions"
  // (their own submitted Q&A) doesn't apply to them, so it's swapped out for
  // their respective staff section instead of just appending onto the
  // attendee nav.
  const navItems = isAnalytics
    ? [...NAV_ITEMS.filter((item) => item.key !== "questions"), ANALYTICS_NAV_ITEM]
    : isSpeaker
      ? [...NAV_ITEMS.filter((item) => item.key !== "questions"), SPEAKER_NAV_ITEM]
      : NAV_ITEMS;

  return (
    <header className="sticky top-0 z-40 border-b border-grey-200 bg-grey-50 shadow-sm">
      <div className="flex h-16 w-full items-center gap-2 px-4">
        <IconButton
          aria-label="Open menu"
          className="md:hidden"
          size="small"
          onClick={() => setDrawerOpen(true)}
        >
          <MenuRoundedIcon fontSize="small" />
        </IconButton>

        <Link href="/" aria-label="Home" className="flex shrink-0 items-center gap-2">
          {logo}
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 self-stretch md:flex">
          {navItems.map((item) => {
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 self-stretch border-b-[3px] px-0.5 text-sm transition-colors ${
                  active
                    ? "border-yellow font-semibold text-ink"
                    : "border-transparent text-grey-600 hover:text-ink"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* Nav above is `hidden` (display:none, no layout contribution) below
            `md:`, so on mobile this spacer is what pushes the icon cluster to
            the right edge; at `md:` it hides and the nav's own flex-1 takes over. */}
        <div className="flex-1 md:hidden" />
        <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
          <ModeToggle size="small" />
          <IconButton
            aria-label="My badge QR"
            onClick={onQrClick}
            size="small"
            data-tour="qr-scan"
            className="rounded-(--radius-control) bg-yellow text-on-yellow hover:bg-yellow-hover"
          >
            <QrCode2Icon fontSize="small" />
          </IconButton>

          <IconButton aria-label="Profile menu" size="small" data-tour="profile" onClick={(e) => setAnchor(e.currentTarget)}>
            <PersonRoundedIcon fontSize="small" />
          </IconButton>
        </div>

        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onProfile?.();
            }}
            sx={{ fontSize: 14 }}
          >
            <ListItemIcon>
              <PersonRoundedIcon fontSize="small" />
            </ListItemIcon>
            My profile
          </MenuItem>
          <MenuItem
            component={Link}
            href="/contacts"
            onClick={() => setAnchor(null)}
            sx={{ fontSize: 14 }}
          >
            <ListItemIcon>
              <PeopleAltRoundedIcon fontSize="small" />
            </ListItemIcon>
            Saved contacts
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onLogout?.();
            }}
            sx={{ fontSize: 14 }}
          >
            <ListItemIcon>
              <LogoutRoundedIcon fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </div>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <nav className="w-72 p-2 pt-4" aria-label="Main menu">
          <div className="mb-3 px-3">{logo}</div>
          {navItems.map((item) => {
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 text-sm ${
                  active
                    ? "border-l-[3px] border-yellow bg-yellow-tint font-semibold text-ink"
                    : "border-l-[3px] border-transparent text-grey-700 hover:bg-grey-50"
                }`}
              >
                {item.icon && <span className="text-grey-600">{item.icon}</span>}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </Drawer>
    </header>
  );
}

/**
 * Scroll-spy for anchor sections. Pass section element ids; returns the id
 * currently in view (or null). Feed it into TopNav's activeKey:
 *
 *   const inView = useScrollSpy(["about"]);
 *   <TopNav activeKey={inView ?? routeKey} ... />
 */
export function useScrollSpy(sectionIds: string[], rootMargin = "-20% 0px -70% 0px") {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin }
    );
    const els = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds, rootMargin]);
  return activeId;
}