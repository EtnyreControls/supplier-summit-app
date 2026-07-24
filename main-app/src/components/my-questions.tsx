"use client";
import * as React from "react";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";

export interface SubmittedQuestion {
  id: string;
  text: string;
  status: string;
  answerText: string | null;
}

function statusChip(status: string, answered: boolean) {
  if (answered) return <Chip size="small" color="success" label="Answered" />;
  if (status === "pending") return <Chip size="small" label="Pending" />;
  return <Chip size="small" label={status} />;
}

/** An attendee's own submitted questions, most recent first. */
export function MyQuestionsList({ questions }: { questions: SubmittedQuestion[] }) {
  return (
    <div className="flex flex-col gap-2">
      {questions.map((q) => {
        const answered = q.status === "answered" && !!q.answerText;
        return (
          <Card key={q.id} className="flex flex-col gap-2 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[14px] text-ink">{q.text}</p>
              {statusChip(q.status, answered)}
            </div>
            {answered && (
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
