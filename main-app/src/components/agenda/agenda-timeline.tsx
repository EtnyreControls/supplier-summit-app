"use client";
import * as React from "react";
import Chip from "@mui/material/Chip";

export type AgendaSession = {
  id: string;
  title: string;
  time: string;
  location: string;
  description: string;
  live?: boolean;
  speakerIds: string[];
};

/**
 * Vertical dot-and-line agenda rail (mirrors the whiteboard mockup). Each
 * session is a stop on the line; the active stop fills solid yellow, a
 * live session gets a yellow ring even when not selected.
 */
export function AgendaTimeline({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: AgendaSession[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="relative">
      {sessions.map((s, i) => {
        const active = s.id === selectedId;
        const isLast = i === sessions.length - 1;
        return (
          <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span className="absolute top-6 bottom-0 left-[9px] w-px bg-grey-200" aria-hidden />
            )}
            <span
              className={`relative z-10 mt-1 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                active
                  ? "border-yellow bg-yellow"
                  : s.live
                    ? "border-yellow bg-surface"
                    : "border-grey-300 bg-surface"
              }`}
            >
              {active && <span className="h-2 w-2 rounded-full bg-on-yellow" />}
            </span>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={active ? "true" : undefined}
              className={`min-w-0 flex-1 rounded-(--radius-control) px-3 py-2 text-left transition-colors ${
                active ? "bg-yellow-tint" : "hover:bg-grey-50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[15px] font-semibold text-ink">{s.title}</p>
                {s.live && (
                  <Chip
                    size="small"
                    label="Live"
                    className="shrink-0"
                    sx={{ backgroundColor: "var(--color-amber-500)", color: "#fff" }}
                  />
                )}
              </div>
              <p className="mt-0.5 truncate text-[13px] text-grey-600">
                {s.time} · {s.location}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
