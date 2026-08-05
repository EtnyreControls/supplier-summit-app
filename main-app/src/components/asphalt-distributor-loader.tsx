"use client";
import * as React from "react";

/**
 * Full-screen loading animation for the Etnyre asphalt distributor.
 * Unlike ChipspreaderMarquee's crossing-the-screen truck, this one stays
 * parked center-screen: most loads here resolve in well under the ~7s a
 * full crossing needs, so a driving version was mostly off-screen or mid-
 * flight whenever it actually mattered. Parked, it can start "working"
 * immediately — idle bob, exhaust puffs, and asphalt dripping from the
 * spray bar all loop from frame one, so there's something readable no
 * matter how short the wait is.
 *
 * Drawn as inline SVG (stroke="currentColor") rather than an image asset
 * like chipspreader.png, so it follows --color-ink automatically in dark
 * mode — no dark:invert hack needed.
 */

const PUFFS = [
  { delayMs: 0, bottom: 2, right: -6, scale: 1 },
  { delayMs: 450, bottom: 16, right: -18, scale: 0.75 },
  { delayMs: 900, bottom: 6, right: -30, scale: 0.55 },
];

// Left offsets (px) sit under the spray bar, which spans roughly the left
// 12-53px of the rendered truck art (viewBox x=16-70 of 320, scaled) — see
// AsphaltTruckArt below. Staggered delays keep drips falling continuously
// rather than as one synchronized pulse.
const DRIPS = [
  { left: 14, delayMs: 0 },
  { left: 26, delayMs: 260 },
  { left: 38, delayMs: 520 },
  { left: 48, delayMs: 780 },
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

/* Side-view line art, tank truck with a rear-mounted spray bar. Drawn so
   the spray bar leads on the left and the cab trails on the right — the
   same leading/trailing split chipspreader.png uses for its chute/cab —
   so PUFFS (anchored near the right edge) land at the cab's exhaust
   stack and DRIPS (anchored near the left edge) land under the spray
   bar. viewBox bounds are tight around the art (wheels bottom out at
   y=124 of 130), so no translate-y correction is needed the way
   chipspreader's image asset needs one for its canvas margins. */
function AsphaltTruckArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 130" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="14" y1="108" x2="300" y2="108" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

      {/* spray bar + nozzles, the working end */}
      <line x1="16" y1="96" x2="70" y2="96" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="24" y1="96" x2="24" y2="106" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="96" x2="38" y2="106" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="96" x2="52" y2="106" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="96" x2="62" y2="104" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      {/* tank */}
      <rect x="60" y="38" width="168" height="58" rx="27" fill="var(--color-surface)" stroke="currentColor" strokeWidth="3" />
      <line x1="96" y1="38" x2="96" y2="96" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="192" y1="38" x2="192" y2="96" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />

      {/* chassis wheels under the tank */}
      <circle cx="108" cy="110" r="14" fill="var(--color-surface)" stroke="currentColor" strokeWidth="3" />
      <circle cx="108" cy="110" r="4" fill="currentColor" />
      <circle cx="150" cy="110" r="14" fill="var(--color-surface)" stroke="currentColor" strokeWidth="3" />
      <circle cx="150" cy="110" r="4" fill="currentColor" />

      {/* cab, the trailing end */}
      <path
        d="M228 96 L228 54 L252 54 L272 74 L272 96 Z"
        fill="var(--color-surface)"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="252" y1="54" x2="252" y2="74" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <line x1="234" y1="54" x2="234" y2="30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

      <circle cx="256" cy="110" r="14" fill="var(--color-surface)" stroke="currentColor" strokeWidth="3" />
      <circle cx="256" cy="110" r="4" fill="currentColor" />
    </svg>
  );
}

export function AsphaltDistributorLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-grey-500">E.D. Etnyre &amp; Co.</span>
        <span className="text-base font-semibold text-ink">
          {label}
          <span className="animate-summit-loading-dot inline-block">.</span>
          <span className="animate-summit-loading-dot inline-block" style={{ animationDelay: "0.2s" }}>
            .
          </span>
          <span className="animate-summit-loading-dot inline-block" style={{ animationDelay: "0.4s" }}>
            .
          </span>
        </span>
      </div>

      <div className="animate-summit-asphalt-idle relative" aria-hidden="true">
        <AsphaltTruckArt className="block h-auto w-[200px] text-ink sm:w-[240px]" />

        {/* asphalt dripping from the spray bar onto the road below it */}
        {DRIPS.map(({ left, delayMs }) => (
          <span
            key={left}
            className="animate-summit-asphalt-drip absolute bottom-2.5 h-1.5 w-1.5 rounded-full bg-grey-800 dark:bg-grey-600"
            style={{ left, animationDelay: `${delayMs}ms` }}
          />
        ))}

        {PUFFS.map(({ delayMs, bottom, right, scale }) => (
          <span key={delayMs} className="absolute" style={{ bottom, right, transform: `scale(${scale})` }}>
            <span className="animate-summit-dust block opacity-0 blur-[1px]" style={{ animationDelay: `${delayMs}ms` }}>
              <DustCloud />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
