"use client";
import * as React from "react";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";

/**
 * One-question-per-step survey shell for anonymous feedback. Renders your
 * question content via `children(stepIndex)`; owns navigation and progress.
 * `canAdvance` gates the next button (e.g., require an answer).
 */
export function FeedbackStepper({
  steps,
  children,
  canAdvance = () => true,
  onComplete,
  completeLabel = "Submit feedback",
  badge = "Anonymous",
}: {
  steps: string[];
  children: (stepIndex: number) => React.ReactNode;
  canAdvance?: (stepIndex: number) => boolean;
  onComplete: () => void;
  completeLabel?: string;
  badge?: string | null;
}) {
  const [step, setStep] = React.useState(0);
  const last = step === steps.length - 1;
  const pct = ((step + 1) / steps.length) * 100;

  return (
    <div className="rounded-(--radius-card) border border-grey-200 bg-surface p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-grey-600">
          {step + 1} of {steps.length}
        </p>
        {badge && <p className="text-xs text-grey-500">{badge}</p>}
      </div>
      <LinearProgress variant="determinate" value={pct} aria-label="Survey progress" />
      <h3 className="mt-4 text-[16px] font-semibold text-ink">{steps[step]}</h3>
      <div className="mt-3">{children(step)}</div>
      <div className="mt-5 flex justify-between">
        <Button
          variant="text"
          color="secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={!canAdvance(step)}
          onClick={() => (last ? onComplete() : setStep((s) => s + 1))}
        >
          {last ? completeLabel : "Next"}
        </Button>
      </div>
    </div>
  );
}
