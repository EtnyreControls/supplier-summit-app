"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { SpeakerCard } from "@/components/cards";
import type { AgendaSession } from "./agenda-timeline";

export type AgendaSpeaker = {
  id: string;
  name: string;
  role: string;
  initials: string;
  bio?: string;
};

/** Detail panel for the selected agenda session: speaker cards up top, full copy below. */
export function SessionDetail({
  session,
  speakers,
}: {
  session: AgendaSession;
  speakers: AgendaSpeaker[];
}) {
  return (
    <Card className="p-5 lg:p-6">
      {session.live && (
        <Chip
          size="small"
          label="Live now"
          className="mb-2"
          sx={{ backgroundColor: "var(--color-amber-500)", color: "#fff" }}
        />
      )}
      <h3 className="text-xl font-bold text-ink">{session.title}</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-grey-600">
        <span className="inline-flex items-center gap-1">
          <ScheduleRoundedIcon sx={{ fontSize: 16 }} /> {session.time}
        </span>
        <span className="inline-flex items-center gap-1">
          <PlaceRoundedIcon sx={{ fontSize: 16 }} /> {session.location}
        </span>
      </div>

      {speakers.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {speakers.map((sp) => (
            <SpeakerCard key={sp.id} {...sp} />
          ))}
        </div>
      )}

      <p className="mt-5 text-[14px] leading-relaxed text-grey-700">{session.description}</p>

      <div className="mt-6 flex justify-end">
        <IconButton
          component="a"
          href="#all-speakers"
          aria-label="View all speakers"
          className="border border-grey-200 bg-surface hover:bg-grey-50"
        >
          <GroupsRoundedIcon fontSize="small" className="text-grey-700" />
        </IconButton>
      </div>
    </Card>
  );
}
