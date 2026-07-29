"use client";
import * as React from "react";
import { CONTAINER } from "../layout";

/**
 * About Us — Comp 2. Follows EtnBanner in the About Us scroll.
 *
 * Source: slide 14 of the Etnyre deck ("The Etnyre Journey"). Uses the
 * illustrated road artwork at /public/RoadVis.png rather than a drawn SVG
 * path — pin coordinates below were sampled directly off that image's
 * road-surface pixels (not eyeballed), so they sit exactly on the pavement
 * regardless of how the image is scaled.
 *
 * The image is a fixed-aspect (5040x3209, ~1.57:1) landscape illustration
 * with baked-in perspective shading, so it can't be rotated per-breakpoint
 * without the light/shadow direction looking wrong — it renders at the same
 * orientation on mobile and desktop, just narrower. On phones this makes
 * for a short, wide band rather than a tall one; flag if you'd rather swap
 * in a portrait-oriented road graphic for small screens.
 *
 * One accent per view: yellow marks progress (completed pins); everything
 * else is ink/grey, matching the "one accent moment" rule from
 * WelcomeReveal / TopNav's QR button.
 *
 * Pins reveal on scroll via IntersectionObserver, reusing the existing
 * animate-summit-rise easing (globals.css) rather than introducing new
 * motion. Respects prefers-reduced-motion — reveals everything immediately.
 */

const IMAGE_ASPECT = 5040 / 3209;

type Milestone = { year: string; title: string; copy: string };

/** x/y as a percentage of the image box — sampled from RoadVis.png's road pixels. */
const WAYPOINTS = [
  { x: 6.7, y: 95 },
  { x: 38.8, y: 50 },
  { x: 71.0, y: 23 },
  { x: 92.9, y: 2 },
];

const DEFAULT_MILESTONES: Milestone[] = [
  { year: "1898", title: "The road begins", copy: "E.D. Etnyre & Co. founded in Oregon, Illinois." },
  { year: "2015", title: "First merge", copy: "Etnyre International acquires BearCat Mfg." },
  {
    year: "2020",
    title: "Widening the lane",
    copy: "Etnyre International acquires SMF and the Rayner Equipment Systems product portfolio.",
  },
  { year: "2024", title: "New territory", copy: "Etnyre International acquires Hendrick." },
];

export function JourneyRoadmap({ milestones = DEFAULT_MILESTONES }: { milestones?: Milestone[] }) {
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  React.useEffect(() => {
    if (reducedMotion) {
      setVisibleCount(milestones.length);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          milestones.forEach((_, i) => {
            setTimeout(() => setVisibleCount((c) => Math.max(c, i + 1)), i * 200);
          });
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [milestones, reducedMotion]);

  return (
    <section ref={sectionRef} className={`${CONTAINER} py-6`}>
      <div className="relative mx-auto w-full max-w-[900px]" style={{ aspectRatio: IMAGE_ASPECT }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/RoadVis.png"
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {WAYPOINTS.map((pos, i) => {
          const m = milestones[i];
          if (!m) return null;
          const active = i < visibleCount;
          const leftSide = pos.x > 50;
          return (
            <div
              key={m.year}
              className="absolute flex items-center gap-2"
              style={{
                top: `${pos.y}%`,
                left: `${pos.x}%`,
                transform: leftSide ? "translate(-100%, -50%)" : "translate(0%, -50%)",
                flexDirection: leftSide ? "row-reverse" : "row",
                opacity: active ? 1 : 0,
                transition: reducedMotion ? undefined : "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
              }}
            >
              <HexPin number={i + 1} active={active} />
              <div className="hidden w-[168px] rounded-(--radius-card) border border-grey-200 bg-surface px-3 py-2.5 shadow-sm sm:block">
                <p className="text-[13px] font-bold leading-none text-ink">{m.year}</p>
                <p className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">{m.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-grey-600">{m.copy}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* On mobile the on-image cards are too cramped for body text (see
          the sm:block card above), so milestones are listed here instead —
          a superscript number attached to the year (matching the pin's
          number on the road image above), not a hexagon badge. */}
      <div className="mt-4 flex flex-col gap-3 sm:hidden">
        {milestones.map((m, i) => (
          <div key={m.year}>
            <p className="text-[12px] font-bold text-ink">
              {m.year}
              <sup className="ml-0.5 text-[9px] font-semibold text-grey-500">{i + 1}</sup>
            </p>
            <p className="text-[12px] leading-relaxed text-grey-600">{m.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HexPin({ number, active }: { number: number; active: boolean }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center border-2 text-[12px] font-bold sm:h-9 sm:w-9 sm:text-[13px]"
      style={{
        clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
        backgroundColor: active ? "var(--color-yellow)" : "var(--color-surface)",
        borderColor: "var(--color-yellow)",
        color: active ? "var(--color-on-yellow)" : "var(--color-grey-400)",
      }}
    >
      {number}
    </div>
  );
}