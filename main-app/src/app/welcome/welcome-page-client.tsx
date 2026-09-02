"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { WelcomeReveal } from "@/components/homepage/welcome-reveal";

export function WelcomePageClient({
  name,
  company,
  tableNumber,
  tableLabel,
}: {
  name: string;
  company: string;
  tableNumber: string | number | null;
  // Real table name (e.g. once tables are named after something), null
  // while still unnamed ('TBD') — see page.tsx.
  tableLabel: string | null;
}) {
  const router = useRouter();
  return (
    <WelcomeReveal
      name={name}
      company={company}
      tableNumber={tableNumber}
      tableLabel={tableLabel}
      onComplete={() => router.replace("/")}
    />
  );
}
