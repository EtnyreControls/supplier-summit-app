"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { NavLogo, useToast } from "@/components";
import { createClient } from "@/lib/supabase/client";

/**
 * Second step of admin login: enters the TOTP code from an authenticator
 * app to raise the session from AAL1 to AAL2. requireAdmin() sends any
 * admin without an aal2 session here (or to /settings/mfa if unenrolled).
 */
export default function VerifyMfaPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.[0];
    if (factorsError || !totpFactor) {
      setSubmitting(false);
      showToast("No authenticator is enrolled on this account", "error");
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeError) {
      setSubmitting(false);
      showToast(challengeError.message, "error");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setSubmitting(false);
      showToast("Incorrect code — try again", "error");
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5">
      <NavLogo />
      <form onSubmit={handleSubmit} className="mt-10 w-full max-w-sm">
        <h1 className="text-center text-xl font-bold text-ink">Enter your authenticator code</h1>
        <p className="mt-1.5 text-center text-sm text-grey-600">
          Open your authenticator app and enter the 6-digit code
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <TextField
            label="6-digit code"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
          />
          <Button type="submit" variant="contained" color="primary" fullWidth disabled={submitting}>
            {submitting ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </form>
      {toast}
    </div>
  );
}
