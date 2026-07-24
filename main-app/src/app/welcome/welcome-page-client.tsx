"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { WelcomeReveal } from "@/components/homepage/welcome-reveal";

export function WelcomePageClient({
  name,
  company,
  tableNumber,
}: {
  name: string;
  company: string;
  tableNumber: string | number;
}) {
  const router = useRouter();
  return <WelcomeReveal name={name} company={company} tableNumber={tableNumber} onComplete={() => router.replace("/")} />;
}
