"use client";
import * as React from "react";

/**
 * Decorative strip: the Etnyre chip spreader sketch drives across the
 * bottom of the page on a loop, puffing a little dust cloud behind it.
 * chipspreader-sketch.png is a line drawing on an opaque white background —
 * mix-blend-multiply fakes transparency against the light-mode page
 * background (white -> invisible, lines stay); in dark mode the source is
 * inverted first (white bg -> black, lines -> white) then screen-blended
 * so the same trick works the other way.
 *
 * Full-bleed: PageContainer centers content in a padded, max-width column,
 * so a plain child would stop short of the actual viewport edges. The
 * left-1/2 + -translate-x-1/2 + w-screen combo breaks out of that column
 * regardless of the parent's padding, so the crossing spans the real screen.
 *
 * Structure: an outer clipper (full-bleed, overflow-hidden) contains one
 * inner group that actually drives (.animate-summit-drive — see globals.css)
 * holding both the truck image and the dust clouds, so the clouds ride
 * along with the truck and only need their own puff-and-fade animation,
 * not separate position tracking. The sketch's chute end (left side) leads
 * as it drives right to left, so the cab end (right side) trails behind —
 * that's where the clouds are anchored. Each cloud is 3 overlapping
 * circles (a static-size, static-position outer wrapper for variety in
 * placement/scale, wrapping an inner element that actually animates the
 * puff-and-fade) so it reads as a little cloud rather than a single dot.
 *
 * Pure CSS animation so it automatically freezes under
 * prefers-reduced-motion without any JS.
 */
const PUFFS = [
  { delayMs: 0, bottom: 0, right: -8, scale: 1 },
  { delayMs: 500, bottom: 14, right: -20, scale: 0.75 },
  { delayMs: 1000, bottom: 4, right: -32, scale: 0.55 },
];

function DustCloud() {
  return (
    <span className="relative block h-4 w-7">
      <span className="absolute bottom-0 left-0 h-3 w-3 rounded-full bg-grey-400 dark:bg-grey-600" />
      <span className="absolute bottom-0.5 left-2 h-4 w-4 rounded-full bg-grey-400 dark:bg-grey-600" />
      <span className="absolute bottom-0 left-4 h-3 w-3 rounded-full bg-grey-400 dark:bg-grey-600" />
    </span>
  );
}

export function ChipspreaderMarquee() {
  return (
    <div
      className="relative left-1/2 mt-8 h-14 w-screen -translate-x-1/2 overflow-hidden sm:h-20"
      aria-hidden="true"
    >
      <div className="animate-summit-drive bottom-0 h-14 sm:h-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/chipspreader-sketch.png"
          alt=""
          className="block h-full w-auto mix-blend-multiply dark:mix-blend-screen dark:invert"
        />
        {PUFFS.map(({ delayMs, bottom, right, scale }) => (
          <span
            key={delayMs}
            className="absolute"
            style={{ bottom, right, transform: `scale(${scale})` }}
          >
            <span
              className="animate-summit-dust block opacity-0 blur-[1px]"
              style={{ animationDelay: `${delayMs}ms` }}
            >
              <DustCloud />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
