"use client";
import * as React from "react";

/**
 * Full-viewport, timer-based welcome moment shown once per session right
 * after QR badge login. Auto-advances into Event Info — there is no tap
 * target, since on a crowded expo floor most people won't stop to dismiss
 * a screen. Name reveals letter by letter (a quiet rise, not a typewriter),
 * then a single yellow rule draws in — the one accent moment, matching the
 * "one accent per view" rule from TopNav's QR button.
 *
 * Mobile-first: min-h-dvh (not vh, to avoid mobile browser chrome jump),
 * safe-area padding, content sized to read at arm's length in expo lighting.
 * Respects prefers-reduced-motion: skips the stagger, shows everything
 * immediately, and shortens the hold before advancing.
 *
 * Usage (e.g. app/welcome/page.tsx after QR auth resolves):
 *   <WelcomeReveal
 *     name={user.name}
 *     company={user.company}
 *     tableNumber={user.tableNumber}
 *     onComplete={() => router.replace("/")}
 *   />
 */
export function WelcomeReveal({
  name,
  company,
  tableNumber,
  tableLabel,
  durationMs = 5000,
  onComplete,
}: {
  name: string;
  company: string;
  // null when the attendee has no table assignment — the Table block below
  // is skipped entirely rather than showing a placeholder like "TBD".
  tableNumber: string | number | null;
  // Real table name, once tables are named (null while still 'TBD' — see
  // welcome/page.tsx). Shown as the headline once set, with the plain
  // number underneath; falls back to just the number when null.
  tableLabel?: string | null;
  /** Total time on screen before onComplete fires. Ignored (shortened) under reduced motion. */
  durationMs?: number;
  onComplete: () => void;
}) {
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  React.useEffect(() => {
    const hold = reducedMotion ? 1100 : durationMs;
    const timer = setTimeout(onComplete, hold);
    return () => clearTimeout(timer);
  }, [reducedMotion, durationMs, onComplete]);

  React.useEffect(() => {
    const hold = reducedMotion ? 1100 : durationMs;
    const fadeMs = reducedMotion ? 200 : 500;
    const fadeTimer = setTimeout(() => setExiting(true), hold - fadeMs);
    return () => clearTimeout(fadeTimer);
  }, [reducedMotion, durationMs]);

  const letters = React.useMemo(() => Array.from(name), [name]);

  return (
    <div
      className={`flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center ${
        exiting ? "opacity-0 transition-opacity duration-500 ease-out" : ""
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="status"
      aria-label={
        tableNumber == null
          ? `Welcome, ${name}, from ${company}.`
          : tableLabel
            ? `Welcome, ${name}, from ${company}. Table ${tableNumber}, ${tableLabel}.`
            : `Welcome, ${name}, from ${company}. Table ${tableNumber}.`
      }
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.16em] text-grey-500 ${
          reducedMotion ? "" : "animate-summit-fade"
        }`}
        style={reducedMotion ? undefined : { animationDelay: "0.1s" }}
      >
        Supplier Summit 2026
      </p>

      <p
        className={`mt-5 text-[15px] text-grey-600 ${reducedMotion ? "" : "animate-summit-fade"}`}
        style={reducedMotion ? undefined : { animationDelay: "0.5s" }}
      >
        Welcome,
      </p>

      <h1 className="mt-1.5 text-[34px] font-medium leading-tight tracking-tight text-ink">
        {letters.map((ch, i) => (
          <span
            key={i}
            className={reducedMotion ? "" : "inline-block animate-summit-rise"}
            style={
              reducedMotion
                ? undefined
                : { animationDelay: `${1.0 + i * 0.08}s` }
            }
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        ))}
      </h1>

      <div
        className={`mt-5 h-1 bg-yellow ${reducedMotion ? "w-40" : "animate-summit-draw"}`}
      />

      <p
        className={`mt-4 text-sm text-grey-600 ${reducedMotion ? "" : "animate-summit-fade"}`}
        style={reducedMotion ? undefined : { animationDelay: "2.2s" }}
      >
        {company}
      </p>

      {tableNumber != null && (
        <div
          className={`mt-8 border-t border-grey-200 pt-5 ${reducedMotion ? "" : "animate-summit-fade"}`}
          style={reducedMotion ? undefined : { animationDelay: "2.8s" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-grey-500">
            Table
          </p>
          {tableLabel ? (
            <>
              <p className="mt-1 text-xl font-medium text-ink">{tableLabel}</p>
              <p className="mt-0.5 text-xs text-grey-500">Table {tableNumber}</p>
            </>
          ) : (
            <p className="mt-1 text-xl font-medium text-ink">{tableNumber}</p>
          )}
        </div>
      )}
    </div>
  );
}
