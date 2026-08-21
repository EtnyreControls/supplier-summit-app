"use server";

import { createClient } from "@/lib/supabase/server";
import { pinError } from "@/lib/pin-requirements";

/**
 * Lets a signed-in attendee set their own PIN, clearing must_change_pin so
 * proxy.ts stops redirecting them to /change-pin. Runs as the caller (not
 * the service role) — the "update own user row" RLS policy already allows
 * a user to write their own row, and hash_pin_trigger bcrypt-hashes the
 * plaintext pin on write, same as the original PIN-setup path.
 */
export async function changeOwnPin(newPin: string): Promise<{ error: string | null }> {
  const trimmed = newPin.trim();
  const validationError = pinError(trimmed);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You're not signed in." };
  }

  const { error } = await supabase
    .from("user")
    .update({ pin: trimmed, must_change_pin: false })
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not update your PIN. Please try again." };
  }
  return { error: null };
}
