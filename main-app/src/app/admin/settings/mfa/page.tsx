"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { NavLogo, useToast } from "@/components";
import { createClient } from "@/lib/supabase/client";

/**
 * One-time TOTP enrollment for an admin who hasn't set up MFA yet.
 * requireAdmin() skips its aal2 check for this route specifically so an
 * unenrolled (but role=admin) account can reach it after logging in.
 */
export default function EnrollMfaPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.enroll({ factorType: "totp" }).then(({ data, error }) => {
      if (error) {
        showToast(error.message, "error");
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setSubmitting(true);
    const supabase = createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setSubmitting(false);
      showToast(challengeError.message, "error");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
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
      <div className="mt-10 w-full max-w-sm">
        <h1 className="text-center text-xl font-bold text-ink">Set up your authenticator</h1>
        <p className="mt-1.5 text-center text-sm text-grey-600">
          Admin accounts require an authenticator app (Google Authenticator, Authy, etc.)
        </p>

        {qrCode && (
          <div className="mt-6 flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Scan with your authenticator app" className="h-48 w-48" />
            {secret && (
              <p className="break-all text-center text-xs text-grey-500">
                Can&apos;t scan? Enter this key manually: {secret}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
          <TextField
            label="6-digit code from your app"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
            disabled={!factorId}
          />
          <Button type="submit" variant="contained" color="primary" fullWidth disabled={submitting || !factorId}>
            {submitting ? "Confirming…" : "Confirm and continue"}
          </Button>
        </form>
      </div>
      {toast}
    </div>
  );
}
