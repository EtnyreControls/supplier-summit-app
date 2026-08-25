import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import ThemeRegistry from "@/theme/ThemeRegistry";
import { GlobalQuestionFab, GeneralCountdownBanner, MustChangePinGate } from "@/components";
import "./globals.css";

export const metadata: Metadata = {
  title: "Summit UI — Etnyre Supplier Summit style guide",
  description: "Component and style library for the Etnyre supplier summit app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the color-scheme class is applied to <html>
    // before hydration by InitColorSchemeScript (prevents light/dark flash)
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <InitColorSchemeScript attribute="class" defaultMode="system" />
        <ThemeRegistry>
          <GeneralCountdownBanner />
          {children}
          <GlobalQuestionFab />
          <MustChangePinGate />
        </ThemeRegistry>
      </body>
    </html>
  );
}
