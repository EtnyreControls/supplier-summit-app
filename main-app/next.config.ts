import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pins the workspace root to this folder so standalone output has a fixed,
  // predictable structure (.next/standalone/server.js) regardless of what
  // lockfiles happen to exist above it — without this, Next infers the root
  // from the nearest ancestor lockfile, which differs between local
  // machines, CI runners, and Azure, breaking any hardcoded deploy path.
  turbopack: {
    root: path.join(__dirname),
  },
  // Lets dev-mode HMR/client bundles load when the app is reached through a
  // LAN IP (phone testing) or a public tunnel (e.g. localtunnel), both of
  // which Next otherwise blocks by default as a DNS-rebinding protection.
  allowedDevOrigins: ["10.0.0.216", "10.1.10.171", "*.loca.lt"],
  experimental: {
    serverActions: {
      // Default 1MB is too small for submitGrowthMachineBoard — a 5-page
      // tldraw document (real freehand drawings) easily exceeds it.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
