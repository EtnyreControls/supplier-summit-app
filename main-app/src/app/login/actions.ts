"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { mintSessionForUser } from "@/lib/supabase/mint-session";

export async function loginWithPin(uniqueId: string, pin: string) {
  const admin = createAdminClient();
  const trimmedId = uniqueId.trim();

  // verify_pin runs SECURITY DEFINER server-side — RLS never lets a client
  // read the pin column directly, so this is the only place PINs get
  // checked. It also tracks failed attempts and locks the account after 3
  // (admins exempt) — see 20260821190000_login_attempt_lockout.sql.
  const { data: userId, error: verifyError } = await admin.rpc("verify_pin", {
    p_unique_id: trimmedId,
    p_pin: pin,
  });

  if (verifyError || !userId) {
    const { data: locked } = await admin.rpc("is_login_locked", { p_unique_id: trimmedId });
    if (locked) {
      return {
        error: "Your account has been locked after too many failed attempts. Please see an Etnyre team member for help.",
      };
    }
    return { error: "Invalid ID or PIN" };
  }

  return mintSessionForUser(userId);
}
