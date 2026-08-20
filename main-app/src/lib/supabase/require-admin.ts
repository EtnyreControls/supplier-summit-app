import "server-only";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Gate for every /admin page and server action. Requires both the
 * `admin` role AND a TOTP-verified session (AAL2) — a stolen password
 * alone is not enough to reach admin data. Pass `skipMfaCheck` only for
 * the enrollment page itself, since an unenrolled admin can't reach aal2.
 */
export async function requireAdmin(options?: { skipMfaCheck?: boolean }) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/admin/login");
  }

  const { data: row } = await supabase
    .from("user")
    .select("role")
    .eq("user_id", authUser.id)
    .single();

  if (row?.role !== "admin") {
    redirect("/admin/login");
  }

  if (!options?.skipMfaCheck) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal?.currentLevel !== "aal2") {
      if (aal?.nextLevel === "aal2") {
        redirect("/admin/login/verify-mfa");
      }
      redirect("/admin/settings/mfa");
    }
  }

  return { userId: authUser.id };
}
