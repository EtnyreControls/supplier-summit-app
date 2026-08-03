"use client";
import * as React from "react";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { CONTAINER } from "../layout";

/**
 * About Us — follows Historic Roadmap in the About Us scroll.
 *
 * Etnyre's "Road Ahead" model: five steps as a rotating dial of numbered
 * pins around a center "Improving Lives" hub, with a single active-step
 * content card below — same layout at every screen size (previously
 * desktop had its own static-ring variant with all five cards visible at
 * once; that's gone in favor of one consistent dial everywhere), just
 * scaled up past 860px — this component's existing desktop/mobile split
 * point — since the extra room on wider screens read as empty otherwise.
 */

type Step = { number: number; label: string; title: string; description: string };

const STEPS: Step[] = [
  { number: 1, label: "Design & Build", title: "Design & Build", description: "Superior products & components." },
  { number: 2, label: "Attract", title: "Attract", description: "Customers & distribution partners." },
  { number: 3, label: "Provide", title: "Provide", description: "Strong customer support & build brand loyalty." },
  { number: 4, label: "Optimize", title: "Optimize", description: "Profit." },
  { number: 5, label: "Invest", title: "Invest", description: "In our growth." },
];

const RADIUS_MOBILE = 108;
const RADIUS_DESKTOP = 170;
const STEP_ANGLE = 360 / STEPS.length;

/** Angle (deg) of step i's pin on the ring, 0deg = top, clockwise. */
function angleFor(i: number) {
  return i * STEP_ANGLE - 90;
}

export function RoadAheadDial({ steps = STEPS }: { steps?: Step[] }) {
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 860px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const radius = isDesktop ? RADIUS_DESKTOP : RADIUS_MOBILE;
  const active = steps[activeIndex];
  const goPrev = () => setActiveIndex((i) => (i - 1 + steps.length) % steps.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % steps.length);

  return (
    <section className={`${CONTAINER} py-12 lg:py-16`}>
      <div className="mx-auto flex flex-col items-center">
        <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wide text-grey-400">
          <span className="hidden sm:inline">Click a step on the dial for details</span>
          <span className="sm:hidden">Tap a step on the dial for details</span>
        </p>
        <div className="relative" style={{ width: radius * 2 + 56, height: radius * 2 + 56 }}>
          <svg
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            width={radius * 2}
            height={radius * 2}
            aria-hidden="true"
          >
            <circle
              cx={radius}
              cy={radius}
              r={radius - 1}
              fill="none"
              stroke="var(--color-grey-200)"
              strokeWidth={1.5}
            />
          </svg>
          <Hub large={isDesktop} />
          <div
            className="absolute inset-0"
            style={{
              transform: `rotate(${-activeIndex * STEP_ANGLE}deg)`,
              transition: reducedMotion ? "none" : "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            {steps.map((step, i) => {
              const angle = angleFor(i);
              const isActive = i === activeIndex;
              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  aria-label={`${step.label}: show details`}
                  aria-pressed={isActive}
                  className={`absolute left-1/2 top-1/2 flex items-center justify-center rounded-full border-2 font-bold ${
                    isDesktop ? "h-12 w-12 text-[16px]" : "h-9 w-9 text-[13px]"
                  } ${reducedMotion ? "" : "transition-colors duration-300"} ${
                    isActive ? "border-yellow bg-yellow text-on-yellow" : "border-grey-300 bg-surface text-grey-600"
                  }`}
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px) rotate(${-angle + activeIndex * STEP_ANGLE}deg)`,
                    transition: reducedMotion ? "none" : "transform 0.5s cubic-bezier(0.22,1,0.36,1), background-color 0.3s, border-color 0.3s, color 0.3s",
                  }}
                >
                  {step.number}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex w-full items-center justify-center gap-2">
          <IconButton
            aria-label="Previous step"
            onClick={goPrev}
            size="small"
            sx={{ color: "var(--color-ink)", border: "1px solid var(--color-grey-300)", flexShrink: 0 }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          <div
            className={`rounded-(--radius-card) border border-grey-200 bg-surface text-center shadow-sm ${
              isDesktop ? "max-w-[420px] p-6" : "max-w-[320px] p-4"
            }`}
          >
            <p className={`font-bold text-grey-500 ${isDesktop ? "text-[14px]" : "text-[13px]"}`}>
              {String(active.number).padStart(2, "0")}
            </p>
            <p className={`mt-0.5 font-semibold text-ink ${isDesktop ? "text-[18px]" : "text-[15px]"}`}>
              {active.title}
            </p>
            <p className={`mt-1 leading-relaxed text-grey-600 ${isDesktop ? "text-[15px]" : "text-[13px]"}`}>
              {active.description}
            </p>
          </div>

          <IconButton
            aria-label="Next step"
            onClick={goNext}
            size="small"
            sx={{ color: "var(--color-ink)", border: "1px solid var(--color-grey-300)", flexShrink: 0 }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
    </section>
  );
}

function Hub({ large }: { large?: boolean }) {
  return (
    <div
      className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-yellow-tint text-center font-bold text-ink shadow-sm ${
        large ? "h-28 w-28 text-[16px]" : "h-20 w-20 text-[13px]"
      }`}
    >
      Improving
      <br />
      Lives
    </div>
  );
}
