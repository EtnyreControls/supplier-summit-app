import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Lets dev-mode HMR/client bundles load when the app is reached through a
  // LAN IP (phone testing) or a public tunnel (e.g. localtunnel), both of
  // which Next otherwise blocks by default as a DNS-rebinding protection.
  allowedDevOrigins: ["10.0.0.216", "10.1.10.171", "*.loca.lt"],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
