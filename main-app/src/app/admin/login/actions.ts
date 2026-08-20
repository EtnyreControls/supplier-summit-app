"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { mintSessionForUser } from "@/lib/supabase/mint-session";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin login — same PIN → magic-link session flow as attendee /login
 * (verify_pin is SECURITY DEFINER; RLS never exposes the pin hash), but
 * additionally rejects non-admin accounts here so a non-admin never even
 * reaches the MFA step at /admin/login/verify-mfa.
 */
export async function loginAdminWithPin(uniqueId: string, pin: string) {
  const admin = createAdminClient();

  const { data: userId, error: verifyError } = await admin.rpc("verify_pin", {
    p_unique_id: uniqueId.trim(),
    p_pin: pin,
  });

  if (verifyError || !userId) {
    return { error: "Invalid ID or PIN", needsEnrollment: false };
  }

  const { data: userRow } = await admin.from("user").select("role").eq("user_id", userId).single();
  if (userRow?.role !== "admin") {
    return { error: "This account doesn't have admin access", needsEnrollment: false };
  }

  const sessionResult = await mintSessionForUser(userId);
  if (sessionResult.error) return { ...sessionResult, needsEnrollment: false };

  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsEnrollment = aal?.nextLevel !== "aal2" && aal?.currentLevel !== "aal2";

  return { error: null, needsEnrollment };
}
