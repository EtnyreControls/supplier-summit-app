"use client";
import * as React from "react";

/**
 * Decorative strip: the Etnyre chip spreader sketch drives across the
 * bottom of the page on a loop, puffing a little dust cloud behind it
 * and dropping a trail of chips from its chute.
 * chipspreader.png is a black-outline/white-fill line drawing on a truly
 * transparent background, so no blend-mode trickery is needed; dark:invert
 * flips it to white lines / dark fill so it still reads on dark surfaces.
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
 * not separate position tracking. The clipper crops the group at the
 * screen edges, so the truck appears to drive in/out rather than the
 * off-screen part deforming. The sketch's chute end (left side) leads
 * as it drives right to left, so the cab end (right side) trails behind —
 * that's where the clouds are anchored. Each cloud is 3 overlapping
 * circles (a static-size, static-position outer wrapper for variety in
 * placement/scale, wrapping an inner element that actually animates the
 * puff-and-fade) so it reads as a little cloud rather than a single dot.
 *
 * Chips are the opposite of the dust: they must stay where they landed
 * while the truck drives on, so they can't ride inside the moving group.
 * A small interval samples the truck's on-screen position and stamps chip
 * elements into the clipper (world space) at the chute's current x. CSS
 * (.animate-summit-chip) holds each chip for 3s then fades it over 2s;
 * React drops it from state after that. The truck itself stays pure CSS,
 * so it still freezes under prefers-reduced-motion without JS — the chip
 * spawner separately checks the same media query and stays off (a parked
 * truck laying a chip pile would look wrong).
 */
const PUFFS = [
  { delayMs: 0, bottom: 0, right: -8, scale: 1 },
  { delayMs: 500, bottom: 14, right: -20, scale: 0.75 },
  { delayMs: 1000, bottom: 4, right: -32, scale: 0.55 },
];

const CHIP_SPAWN_MS = 140; // sample/stamp cadence while the truck crosses
const CHIP_LIFE_MS = 5200; // 3s hold + 2s fade (see .animate-summit-chip) + slack

type Chip = {
  id: number;
  x: number; // px from clipper's left edge
  bottom: number;
  size: number;
  bornAt: number;
};

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
  const clipperRef = React.useRef<HTMLDivElement>(null);
  const truckRef = React.useRef<HTMLDivElement>(null);
  const nextChipId = React.useRef(0);
  const [chips, setChips] = React.useState<Chip[]>([]);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      const clipper = clipperRef.current;
      const truck = truckRef.current;
      const now = Date.now();
      let spawned: Chip[] = [];
      if (clipper && truck) {
        const clipperRect = clipper.getBoundingClientRect();
        const truckRect = truck.getBoundingClientRect();
        // Chute is at the truck's leading (left) edge, a touch inboard.
        const chuteX = truckRect.left - clipperRect.left + truckRect.width * 0.06;
        if (chuteX > 4 && chuteX < clipperRect.width - 4) {
          spawned = Array.from({ length: 2 }, () => ({
            id: nextChipId.current++,
            x: chuteX + (Math.random() - 0.5) * 10,
            bottom: Math.random() * 3,
            size: 2 + Math.random() * 2,
            bornAt: now,
          }));
        }
      }
      setChips((prev) => [
        ...prev.filter((chip) => now - chip.bornAt < CHIP_LIFE_MS),
        ...spawned,
      ]);
    }, CHIP_SPAWN_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      ref={clipperRef}
      className="relative left-1/2 h-14 w-screen -translate-x-1/2 overflow-hidden sm:h-20"
      aria-hidden="true"
    >
      {/* World-space chip trail: stamped at the chute's position and left
          behind as the truck moves on. Rendered before (under) the truck
          group so the truck passes over freshly laid chips. */}
      {chips.map(({ id, x, bottom, size }) => (
        <span
          key={id}
          className="animate-summit-chip absolute rounded-[1px] bg-grey-500 dark:bg-grey-500"
          style={{ left: x, bottom, width: size, height: size }}
        />
      ))}
      <div
        ref={truckRef}
        className="animate-summit-drive bottom-0 flex h-14 items-end sm:h-20"
      >
        {/* Sized by WIDTH (230/329px — the widths the old 3.3:1 sketch got
            from h-full), not height: chipspreader.png is a squarer 1.5:1
            canvas whose truck only fills the middle band (opaque pixels
            y 256-728 of 1024), so h-full would render a half-width truck.
            items-end bottom-aligns the taller image against the strip and
            translate-y-[28.9%] pushes the canvas's transparent bottom
            margin (296/1024px) below the strip, so the wheels land on the
            strip bottom; the clipper crops the overhang. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/chipspreader.png"
          alt=""
          className="block h-auto w-[230px] translate-y-[28.9%] sm:w-[329px] dark:invert"
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
