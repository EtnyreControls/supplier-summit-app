"use client";
import * as React from "react";

/**
 * About Us — closing banner. Full-bleed summit 2026 promo graphic
 * (/summit-2026-banner.png), replacing the previous "Etnyre International /
 * Family Owned Since 1898" text-and-hexagons band. The image already
 * carries its own branding, copy, and dark background, so this is just a
 * full-width frame around it — no overlaid text or PageContainer
 * indentation like the old version had.
 *
 * The source PNG is ~2.73:1 (2073x758). aspect-[33/10] (3.3:1) crops it to a
 * flatter band via object-cover — confirmed by rendering the actual crop
 * first: at a 20%-of-height total crop (10% off top, 10% off bottom) both
 * "Etnyre" at the top and the icon row labels at the bottom stay fully
 * clear, so this is a safe amount to take off blank margin, not content.
 *
 * Fixing the *ratio* (not a plain height) is what keeps that same 20% crop
 * fraction — never more — at any viewport width, unlike a flat h-NN, which
 * would crop progressively more on a wider screen since the image only
 * gets taller through height, never wider through width. max-h caps the
 * absolute thickness only on genuinely ultra-wide monitors: it's set to
 * where the 3.3-ratio height would land at ~1980px of viewport width
 * (1980/3.3 ≈ 600), comfortably past a 1920px desktop, so ordinary desktop
 * widths never hit the clamp and lose their safe 20% — confirmed by
 * checking the rendered crop ratio at 1280px and 1920px before landing on
 * this number; an earlier, lower cap (380px) was clamping as early as
 * 1280px and cropping well past the safe amount at 1920px.
 */
export function EtnBanner() {
  return (
    <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/summit-2026-banner.png"
        alt="Etnyre International Supplier Summit 2026 — Partners in Growth. Built for the Future."
        className="aspect-[33/10] max-h-[600px] w-full object-cover"
      />
    </section>
  );
}
