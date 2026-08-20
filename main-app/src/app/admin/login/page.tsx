"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { NavLogo, ModeToggle, useToast, AsphaltDistributorLoader } from "@/components";
import { loginAdminWithPin } from "./actions";

/**
 * Route: /admin/login — deliberately separate from the attendee /login page
 * (no shared nav, not linked from any attendee screen). Success routes to
 * MFA enrollment (first time) or MFA verification, never straight to /admin.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [uniqueId, setUniqueId] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await loginAdminWithPin(uniqueId, pin);
    if (result.error) {
      setSubmitting(false);
      showToast(result.error, "error");
      return;
    }
    router.push(result.needsEnrollment ? "/admin/settings/mfa" : "/admin/login/verify-mfa");
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex justify-end p-4">
        <ModeToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20">
        <NavLogo />

        <form onSubmit={handleSubmit} className="mt-10 w-full max-w-sm">
          <h1 className="text-center text-xl font-bold text-ink">Admin sign-in</h1>
          <p className="mt-1.5 text-center text-sm text-grey-600">
            IT/admin access only — this is a separate, MFA-protected login
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <TextField
              label="Unique ID"
              placeholder="e.g. SUMMIT-ADM-001"
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
              {submitting ? "Checking…" : "Continue"}
            </Button>
          </div>
        </form>
      </div>
      {submitting && <AsphaltDistributorLoader label="Signing in" />}
      {toast}
    </div>
  );
}
