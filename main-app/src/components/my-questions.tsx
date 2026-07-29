"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";

export interface SubmittedQuestion {
  id: string;
  text: string;
  status: string;
  answerText: string | null;
}

/* "Answered" is a hairline outlined pill whose solid yellow dot carries the
   accent — same visual grammar as the agenda's live chips (dot = state),
   but in brand yellow rather than amber so it reads "done", not "urgent".
   "Pending" keeps the amber-100/900 tonal tint, mirroring the Alert
   "warning" treatment, so the pair stays consistent in both color schemes. */
function statusChip(status: string) {
  if (status === "answered") {
    return (
      <Chip
        size="small"
        variant="outlined"
        icon={<span className="ml-1.5 block h-[7px] w-[7px] rounded-full bg-yellow" />}
        label="Answered"
        className="border-grey-200 text-ink"
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

type Filter = "all" | "answered" | "pending";

/* Answers that arrived since the attendee last looked get an amber ring +
   "New answer" pill (amber = attention, matching the agenda's live
   treatment). "Seen" is tracked per-device in localStorage: ids are added
   when the attendee expands the card. Read in an effect (not render) so
   server and first client render agree — everything starts un-fresh and
   the rings appear after hydration. */
const SEEN_KEY = "summit-seen-answers";

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const seen = readSeen();
    seen.add(id);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* storage unavailable (private mode etc.) — glow just reappears next visit */
  }
}

/** An attendee's own submitted questions. Answered ones float to the top
 * (most useful first); order is otherwise preserved (most recent first,
 * per the server query), via a stable sort. Answers collapse behind a tap
 * so a long list stays scannable; filter pills + a progress line give the
 * page a summary before the detail. */
export function MyQuestionsList({ questions }: { questions: SubmittedQuestion[] }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [openIds, setOpenIds] = React.useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const seen = readSeen();
    setFreshIds(
      new Set(
        questions
          .filter((q) => q.status === "answered" && q.answerText && !seen.has(q.id))
          .map((q) => q.id),
      ),
    );
  }, [questions]);

  const answeredCount = questions.filter((q) => q.status === "answered").length;
  const pendingCount = questions.length - answeredCount;

  const sorted = [...questions].sort(
    (a, b) => Number(b.status === "answered") - Number(a.status === "answered"),
  );
  const visible = sorted.filter(
    (q) =>
      filter === "all" ||
      (filter === "answered" ? q.status === "answered" : q.status !== "answered"),
  );

  const toggle = (q: SubmittedQuestion) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) {
        next.delete(q.id);
      } else {
        next.add(q.id);
        markSeen(q.id);
        setFreshIds((fresh) => {
          const f = new Set(fresh);
          f.delete(q.id);
          return f;
        });
      }
      return next;
    });
  };

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: questions.length },
    { key: "answered", label: "Answered", count: answeredCount },
    { key: "pending", label: "Pending", count: pendingCount },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-[12px] font-semibold tabular-nums text-grey-600">
          {answeredCount} of {questions.length} answered
        </p>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-grey-200">
          <div
            className="h-full rounded-full bg-yellow transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="mb-1 flex gap-1.5" role="group" aria-label="Filter questions">
        {filters.map((f) => {
          const selected = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={selected}
              className={`rounded-full border px-3.5 py-1 text-[12px] font-bold transition-colors ${
                selected
                  ? "border-yellow bg-yellow text-on-yellow"
                  : "border-grey-200 bg-surface text-grey-600 hover:border-grey-400"
              }`}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-70">{f.count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="py-4 text-center text-[13px] text-grey-600">
          No {filter} questions right now.
        </p>
      )}

      {visible.map((q) => {
        const answered = q.status === "answered";
        const expandable = answered && !!q.answerText;
        const open = openIds.has(q.id);
        const fresh = freshIds.has(q.id);

        const body = (
          <>
            {fresh && (
              <span className="self-start rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                New answer
              </span>
            )}
            <div className="flex items-start justify-between gap-3">
              <p className="text-[14px] text-ink">{q.text}</p>
              <span className="flex shrink-0 items-center">
                {statusChip(q.status)}
                {expandable && (
                  <ExpandMoreRoundedIcon
                    className={`text-grey-500 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                    sx={{ fontSize: 18 }}
                  />
                )}
              </span>
            </div>
            {expandable && (
              <Collapse in={open}>
                <p className="mt-2 rounded-(--radius-control) bg-grey-50 px-3 py-2 text-[13px] text-grey-700">
                  {q.answerText}
                </p>
              </Collapse>
            )}
          </>
        );

        if (!expandable) {
          return (
            <Card key={q.id} className="flex flex-col gap-2 p-3.5">
              {body}
            </Card>
          );
        }
        return (
          <Card
            key={q.id}
            component="button"
            type="button"
            onClick={() => toggle(q)}
            aria-expanded={open}
            className={`flex w-full cursor-pointer flex-col gap-2 p-3.5 text-left transition-colors hover:border-grey-400 ${
              fresh ? "ring-2 ring-amber-500" : ""
            }`}
          >
            {body}
          </Card>
        );
      })}
    </div>
  );
}
