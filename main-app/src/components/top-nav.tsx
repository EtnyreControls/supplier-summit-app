"use client";
import * as React from "react";
import Link from "next/link";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
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
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { ModeToggle } from "./mode-toggle";

export interface NavItem {
  key: string;
  label: string;
  href: string; // routes ("/agenda") or scroll anchors ("/#about")
  icon?: React.ReactNode; // shown in the mobile drawer
}

/**
 * Fixed app-wide nav — the three sections defined for this project.
 * Edit here if the information architecture changes; not passed as a prop
 * so every page is guaranteed to render the same nav.
 */
const NAV_ITEMS: NavItem[] = [
  { key: "about", label: "About us", href: "/#about" },
  { key: "agenda", label: "Agenda & speakers", href: "/agenda" },
  { key: "polls", label: "Polls & feedback", href: "/polls" },
  { key: "growth-machine", label: "Growth Machine", href: "/growth-machine" },
  {
    key: "admin",
    label: "Administration",
    href: "/admin",
    icon: <LockRoundedIcon sx={{ fontSize: 16 }} />,
  },
];

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

  return (
    <header className="sticky top-0 z-40 border-b border-grey-200 bg-grey-50 shadow-sm">
      {/* Narrower left/right inset than CONTAINER below `lg:` — the hamburger +
          logo need to sit closer to the screen edge on mobile than the rest
          of the page's content column. */}
      <div className="mx-auto flex h-16 w-[92%] max-w-[1400px] items-center gap-2 px-1 lg:px-10">
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
          {NAV_ITEMS.map((item) => {
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
        <div className="ml-3 flex shrink-0 items-center gap-1.5 md:ml-0 md:gap-3">
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
            <Avatar sx={{ width: 42, height: 42, fontSize: 15 }}>{initials}</Avatar>
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
          {NAV_ITEMS.map((item) => {
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