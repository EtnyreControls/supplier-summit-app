"use client";
import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Pages where the dialog would be pointless or actively in the way: signed
// out (/login, /qr), the change-pin page itself (its own button navigates
// there), and /welcome — the one-time post-login WelcomeReveal animation,
// which should finish playing and hand off to "/" before this ever
// interrupts it.
const EXEMPT_PATHS = ["/login", "/qr", "/change-pin", "/welcome"];

/**
 * Rendered in the root layout on every page. Fetches must_change_pin itself
 * on the client, re-checking on every pathname change, rather than being
 * fed a value computed once by the server layout — a server-fetched prop
 * only re-runs on a full page load, not on the client-side transitions
 * router.push() does between pages sharing this layout. That mismatch is
 * what caused the endless reset-PIN loop: after /change-pin's post-submit
 * router.push("/"), the layout (and the stale `mustChangePin: true` it had
 * fetched before the PIN was changed) was reused from Next's router cache
 * instead of re-rendered, so the dialog just popped right back up.
 *
 * Replaces the old proxy.ts behavior of redirecting a must-change-pin
 * account away from whatever page it asked for — that redirect, chained
 * with the change-pin form's own post-submit navigation, is what caused the
 * multi-minute "Saving…" hangs various sessions kept running into. Now the
 * user reaches their page normally and this dialog sits on top of it,
 * non-dismissable, until they follow it to /change-pin and back.
 */
export function MustChangePinGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [mustChangePin, setMustChangePin] = React.useState(false);

  const exempt = EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  React.useEffect(() => {
    if (exempt) {
      setMustChangePin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user").select("must_change_pin").eq("user_id", user.id).maybeSingle();
      if (!cancelled) setMustChangePin(Boolean(data?.must_change_pin));
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, exempt]);

  if (!mustChangePin || exempt) return null;

  return (
    // onClose is a no-op regardless of reason ("escapeKeyDown" or
    // "backdropClick" — this MUI version dropped disableEscapeKeyDown, so
    // ignoring both here is what makes the dialog non-dismissable now.
    <Dialog open onClose={() => {}} aria-labelledby="must-change-pin-title">
      <DialogTitle id="must-change-pin-title">Set a new PIN</DialogTitle>
      <DialogContent>
        <DialogContentText>For your security, choose a new PIN before continuing.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => router.push("/change-pin")}>
          Change PIN
        </Button>
      </DialogActions>
    </Dialog>
  );
}
