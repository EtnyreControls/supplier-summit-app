"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { mintSessionForUser } from "@/lib/supabase/mint-session";

export async function loginWithPin(uniqueId: string, pin: string) {
  const admin = createAdminClient();

  // verify_pin runs SECURITY DEFINER server-side — RLS never lets a client
  // read the pin column directly, so this is the only place PINs get checked.
  const { data: userId, error: verifyError } = await admin.rpc("verify_pin", {
    p_unique_id: uniqueId.trim(),
    p_pin: pin,
  });

  if (verifyError || !userId) {
    return { error: "Invalid ID or PIN" };
  }

  return mintSessionForUser(userId);
}
