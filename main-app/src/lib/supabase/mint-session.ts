import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Turns a verified user_id (PIN-checked or QR-token-checked — never taken
 * on trust from a client) into a real Supabase Auth session, so auth.uid()
 * lines up with user.user_id for every RLS policy downstream.
 *
 * No password is ever set for these accounts — mints a one-time magic-link
 * token server-side (service role) and immediately redeems it, since that's
 * the only Supabase Auth primitive that mints a session from a bare user_id.
 */
export async function mintSessionForUser(userId: string) {
  const admin = createAdminClient();

  const { data: authUser, error: lookupError } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (lookupError || !email) {
    return { error: "This account isn't set up for login yet" };
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return { error: "Could not start a session" };
  }

  const supabase = await createClient();
  const { error: verifyOtpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyOtpError) {
    return { error: "Could not start a session" };
  }

  return { error: null };
}
