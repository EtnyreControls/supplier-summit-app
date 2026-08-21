"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { NavLogo, ModeToggle, useToast, AsphaltDistributorLoader } from "@/components";
import { changeOwnPin } from "@/lib/supabase/change-pin";
import { PIN_REQUIREMENTS } from "@/lib/pin-requirements";

/**
 * Route: /change-pin
 * Forced by proxy.ts for any signed-in account with user.must_change_pin
 * still true (the bulk PIN reset in 20260821180000_force_pin_change.sql,
 * or any new account going forward) — no other page is reachable until a
 * new PIN is set here.
 */
export default function ChangePinPage() {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [showPin, setShowPin] = React.useState(false);
  const [showConfirmPin, setShowConfirmPin] = React.useState(false);

  const allMet = PIN_REQUIREMENTS.every((r) => r.test(pin));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) {
      showToast("PIN doesn't meet all the requirements yet", "error");
      return;
    }
    if (pin !== confirmPin) {
      showToast("PINs don't match", "error");
      return;
    }
    setSubmitting(true);
    const { error } = await changeOwnPin(pin);
    if (error) {
      setSubmitting(false);
      showToast(error, "error");
      return;
    }
    router.push("/welcome");
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
          <h1 className="text-center text-xl font-bold text-ink">Set a new PIN</h1>
          <p className="mt-1.5 text-center text-sm text-grey-600">
            For your security, choose a new PIN before continuing.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <TextField
              label="New PIN"
              type={showPin ? "text" : "password"}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="new-password"
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPin ? "Hide PIN" : "Show PIN"}
                        onClick={() => setShowPin((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showPin ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Same grammar as MyQuestionsList's statusChip: brand yellow
                reads "done", amber reads "needs attention" — this brand has
                no red/green, so unmet requirements stay amber rather than
                red, and met ones switch to yellow rather than green. */}
            <ul className="flex flex-col gap-1">
              {PIN_REQUIREMENTS.map((r) => {
                const met = r.test(pin);
                return (
                  <li
                    key={r.key}
                    className={`flex items-center gap-1.5 text-xs ${met ? "text-ink" : "text-amber-700"}`}
                  >
                    {met ? (
                      <CheckCircleRoundedIcon sx={{ fontSize: 14, color: "var(--color-yellow)" }} />
                    ) : (
                      <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 14 }} className="text-amber-700" />
                    )}
                    {r.label}
                  </li>
                );
              })}
            </ul>

            <TextField
              label="Confirm new PIN"
              type={showConfirmPin ? "text" : "password"}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              autoComplete="new-password"
              required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showConfirmPin ? "Hide PIN" : "Show PIN"}
                        onClick={() => setShowConfirmPin((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showConfirmPin ? (
                          <VisibilityOffRoundedIcon fontSize="small" />
                        ) : (
                          <VisibilityRoundedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button type="submit" variant="contained" color="primary" fullWidth disabled={submitting || !allMet}>
              {submitting ? "Saving…" : "Save PIN"}
            </Button>
          </div>
        </form>
      </div>
      {submitting && <AsphaltDistributorLoader label="Saving" />}
      {toast}
    </div>
  );
}
