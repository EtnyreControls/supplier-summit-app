"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { NavLogo, ModeToggle, useToast, AsphaltDistributorLoader } from "@/components";
import { loginWithPin } from "./actions";

/**
 * Route: /login
 * Looks the badge ID up in "user", checks the PIN via the verify_pin RPC
 * (SECURITY DEFINER — RLS never lets a client read the pin hash directly),
 * then mints a real Supabase Auth session so auth.uid() lines up with
 * user.user_id for every RLS policy downstream.
 */

export default function LoginPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [uniqueId, setUniqueId] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await loginWithPin(uniqueId, pin);
    if (error) {
      // Only reset on failure — on success `submitting` stays true so the
      // full-screen loader covers the gap up to the /welcome redirect
      // instead of flashing back to the plain form for a moment.
      setSubmitting(false);
      showToast(error, "error");
    } else {
      router.push("/welcome");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex justify-end p-4">
        <ModeToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20">
        <NavLogo />

        <form onSubmit={handleSubmit} className="mt-10 w-full max-w-sm">
          <h1 className="text-center text-xl font-bold text-ink">Supplier check-in</h1>
          <p className="mt-1.5 text-center text-sm text-grey-600">
            Enter your badge ID and PIN to continue
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <TextField
              label="Unique ID"
              placeholder="e.g. SUMMIT-ATT-001"
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value)}
              autoComplete="off"
              required
            />
            <TextField
              label="PIN"
              type="password"
              inputMode="numeric"
              placeholder="4-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
              required
            />
            <Button type="submit" variant="contained" color="primary" fullWidth disabled={submitting}>
              {submitting ? "Checking…" : "Log in"}
            </Button>
          </div>
        </form>
      </div>
      {submitting && <AsphaltDistributorLoader label="Signing in" />}
      {toast}
    </div>
  );
}
