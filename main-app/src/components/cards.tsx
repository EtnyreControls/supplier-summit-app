"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";

/** Agenda session. `live` renders the amber "Live now" chip (distinct from
 * primary yellow, so it doesn't compete with actual call-to-action buttons).
 * `featured` marks a must-see/keynote session with an amber edge + eyebrow,
 * so it stands out from the general schedule at a glance. */
export function SessionCard({
  title,
  time,
  location,
  live,
  featured,
  onClick,
}: {
  title: string;
  time: string;
  location: string;
  live?: boolean;
  featured?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card className={featured ? "border-l-4 !border-l-amber-500" : ""}>
      <CardActionArea onClick={onClick} className="p-4">
        {featured && (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-amber-700">Keynote</p>
        )}
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-semibold leading-snug text-ink">{title}</p>
          {live && (
            <Chip size="small" label="Live now" sx={{ backgroundColor: "var(--color-amber-500)", color: "#fff" }} />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-grey-600">
          <span className="inline-flex items-center gap-1">
            <ScheduleRoundedIcon sx={{ fontSize: 16 }} /> {time}
          </span>
          <span className="inline-flex items-center gap-1">
            <PlaceRoundedIcon sx={{ fontSize: 16 }} /> {location}
          </span>
        </div>
      </CardActionArea>
    </Card>
  );
}

/** Speaker card: name, role, avatar. With `expandable`, tap reveals the bio
 * (used by the agenda's "All speakers" list only — session-detail cards stay
 * plain, no bio). */
export function SpeakerCard({
  name,
  role,
  initials,
  bio,
  photoUrl,
  expandable = false,
}: {
  name: string;
  role: string;
  initials: string;
  bio?: string;
  photoUrl?: string;
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const canExpand = expandable && !!bio;

  return (
    <Card className="p-0">
      <CardActionArea
        onClick={() => canExpand && setExpanded((e) => !e)}
        disabled={!canExpand}
        className="p-4"
        aria-expanded={canExpand ? expanded : undefined}
      >
        <div className="flex items-center gap-3">
          <Avatar src={photoUrl} sx={{ width: 46, height: 46 }}>
            {initials}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{name}</p>
            <p className="truncate text-[13px] text-grey-600">{role}</p>
          </div>
          {canExpand && (
            <KeyboardArrowDownRoundedIcon
              sx={{
                fontSize: 20,
                color: "var(--color-grey-500)",
                flexShrink: 0,
                transition: "transform 0.15s",
                transform: expanded ? "rotate(180deg)" : "none",
              }}
            />
          )}
        </div>
        {canExpand && !expanded && (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-grey-500">
            Tap to expand for details
          </p>
        )}
        {canExpand && expanded && (
          <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-grey-700">{bio}</p>
        )}
      </CardActionArea>
    </Card>
  );
}

/** Big-number stat tile (analytics dashboard, about section). */
export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-(--radius-card) bg-grey-50 px-3 py-4 text-center">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-grey-600">{label}</p>
    </div>
  );
}
