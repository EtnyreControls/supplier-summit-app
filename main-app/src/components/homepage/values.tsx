"use client";
import * as React from "react";
import { CONTAINER } from "../layout";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";

/**
 * About Us — Comp 2. Follows EtnBanner in the scroll.
 *
 * Desktop (sm+): one horizontal row, all five values visible at once.
 * Resting state is icon + name only; hovering a value scales it up,
 * pulses the icon, blooms the description in below, and dims the other
 * four — so the row stays quiet until someone engages with it.
 *
 * Mobile: no hover, so it's tap-to-expand instead — same interaction,
 * just triggered by touch, in a 2-column grid rather than one row (five
 * across is too tight below sm).
 *
 * Under prefers-reduced-motion: the pulse keyframe is skipped; the
 * expand/collapse itself is unaffected since it's a max-height/opacity
 * transition, not a transform-based animation.
 */

const VALUES = [
  { name: "Care", desc: "We add value to people when we value them.", Icon: FavoriteRoundedIcon },
  { name: "Humility", desc: "We believe more ideas are better than one.", Icon: GroupsRoundedIcon },
  { name: "Integrity", desc: "Our actions must match our words.", Icon: VerifiedUserRoundedIcon },
  { name: "Respect", desc: "Everyone's contributions are important.", Icon: HandshakeRoundedIcon },
  { name: "Trust", desc: "Open dialogue strengthens our bonds.", Icon: VpnKeyRoundedIcon },
] as const;

export function OurValues() {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <section className={`${CONTAINER} py-12 lg:py-16`}>
      <h2 className="text-center text-[26px] font-medium tracking-tight text-ink sm:text-[32px]">
        Our values
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-grey-600">
        Five core values guide our behaviors in pursuit of our vision and mission.
      </p>
      <p className="mt-1 text-center text-[11px] font-medium uppercase tracking-wide text-grey-400">
        <span className="hidden sm:inline">Hover a value to learn more</span>
        <span className="sm:hidden">Tap a value to learn more</span>
      </p>

      {/* Desktop: single horizontal row, hover to reveal */}
      <div className="mt-10 hidden items-start justify-between gap-4 sm:flex">
        {VALUES.map((v, i) => {
          const isActive = activeIndex === i;
          const isDimmed = activeIndex !== null && !isActive;

          return (
            <div
              key={v.name}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              className="flex flex-1 cursor-default flex-col items-center text-center transition-[transform,opacity] duration-300"
              style={{
                transform: isActive ? "scale(1.06)" : "scale(1)",
                opacity: isDimmed ? 0.5 : 1,
              }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-tint text-ink transition-transform duration-300"
                style={{ transform: isActive ? "scale(1.1)" : "scale(1)" }}
              >
                <v.Icon
                  sx={{ fontSize: 20 }}
                  className={isActive && !reducedMotion ? "animate-summit-pulse" : ""}
                />
              </span>
              <p className="mt-1.5 text-[13px] font-semibold text-ink">{v.name}</p>
              <div
                className="overflow-hidden transition-[max-height,opacity] duration-300"
                style={{ maxHeight: isActive ? 80 : 0, opacity: isActive ? 1 : 0 }}
              >
                <p className="mt-1 max-w-[150px] text-[11px] leading-snug text-grey-600">{v.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: tap-to-expand cards */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:hidden">
        {VALUES.map((v, i) => {
          const isActive = activeIndex === i;
          const isDimmed = activeIndex !== null && !isActive;

          return (
            <button
              key={v.name}
              type="button"
              onClick={() => setActiveIndex(isActive ? null : i)}
              aria-expanded={isActive}
              className="rounded-(--radius-card) border border-grey-200 bg-surface px-3 py-5 text-center transition-[transform,opacity,background-color] duration-300"
              style={{
                transform: isActive ? "scale(1.04)" : "scale(1)",
                opacity: isDimmed ? 0.5 : 1,
                backgroundColor: isActive ? "var(--summit-yellow-tint)" : "var(--summit-surface)",
              }}
            >
              <span
                className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-yellow-tint text-ink transition-transform duration-300"
                style={{ transform: isActive ? "scale(1.1)" : "scale(1)" }}
              >
                <v.Icon
                  sx={{ fontSize: 20 }}
                  className={isActive && !reducedMotion ? "animate-summit-pulse" : ""}
                />
              </span>
              <p className="text-[13px] font-semibold text-ink">{v.name}</p>
              <div
                className="overflow-hidden transition-[max-height,opacity] duration-300"
                style={{ maxHeight: isActive ? 80 : 0, opacity: isActive ? 1 : 0 }}
              >
                <p className="mt-2 text-[11px] leading-snug text-grey-600">{v.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}