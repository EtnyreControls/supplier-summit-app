"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";

export interface SubmittedQuestion {
  id: string;
  text: string;
  status: string;
  answerText: string | null;
}

/* Tonal pills, not MUI's default filled/outlined chips — mirrors the
   Alert severity treatment (fixed dark "success" chip w/ yellow icon,
   amber-100/900/700 tint for "warning") so status reads consistently
   with the rest of the design system in both color schemes. */
function statusChip(status: string) {
  if (status === "answered") {
    return (
      <Chip
        size="small"
        color="success"
        icon={<CheckRoundedIcon sx={{ fontSize: 15 }} />}
        label="Answered"
        sx={{ "& .MuiChip-icon": { color: "var(--summit-yellow)" } }}
      />
    );
  }
  if (status === "pending") {
    return (
      <Chip
        size="small"
        icon={<ScheduleRoundedIcon sx={{ fontSize: 15 }} />}
        label="Pending"
        sx={{
          bgcolor: "var(--summit-amber-100)",
          color: "var(--summit-amber-900)",
          "& .MuiChip-icon": { color: "var(--summit-amber-700)" },
        }}
      />
    );
  }
  return <Chip size="small" label={status} />;
}

/** An attendee's own submitted questions. Answered ones float to the top
 * (most useful first); order is otherwise preserved (most recent first,
 * per the server query), via a stable sort. */
export function MyQuestionsList({ questions }: { questions: SubmittedQuestion[] }) {
  const sorted = [...questions].sort((a, b) => Number(b.status === "answered") - Number(a.status === "answered"));

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((q) => {
        const answered = q.status === "answered";
        return (
          <Card key={q.id} className="flex flex-col gap-2 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[14px] text-ink">{q.text}</p>
              {statusChip(q.status)}
            </div>
            {answered && q.answerText && (
              <p className="rounded-(--radius-control) bg-grey-50 px-3 py-2 text-[13px] text-grey-700">
                {q.answerText}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
