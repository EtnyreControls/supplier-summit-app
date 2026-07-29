"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintSessionForUser } from "@/lib/supabase/mint-session";
import { generateQrToken } from "@/lib/supabase/qr-token";

/**
 * Returns the signed-in user's badge QR token, generating one on first use
 * (lazy — there's no separate badge-printing step in this app, the token
 * is minted the first time "My badge QR" is opened).
 */
export async function getMyBadgeQrToken() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in", token: null, name: null, company: null };

  const { data, error } = await supabase
    .from("user")
    .select("qr_token, first_name, last_name, company")
    .eq("user_id", user.id)
    .single();
  if (error) return { error: "Could not load your badge", token: null, name: null, company: null };

  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Attendee";
  const company = data.company as string | null;

  if (data.qr_token) return { error: null, token: data.qr_token as string, name, company };

  const token = generateQrToken();
  const { error: updateError } = await supabase
    .from("user")
    .update({ qr_token: token })
    .eq("user_id", user.id);
  if (updateError) return { error: "Could not create your badge", token: null, name, company };

  return { error: null, token, name, company };
}

type ScanResult =
  | { mode: "login"; error: string | null }
  | { mode: "redirect_login" }
  | { mode: "self" }
  | { mode: "contact"; contact: { name: string; company: string | null } }
  | { mode: "error"; error: string };

/**
 * The single entry point every badge scan goes through — /qr route.
 *
 * One token, two behaviors, chosen by the SCANNING DEVICE's session state
 * (never by which QR it is, since there's only one per user):
 *   - No active session, and the badge owner has no active session
 *     elsewhere either -> this is a self-login (kiosk / fresh device
 *     scanning your own badge for the first time).
 *   - No active session, but the badge owner already has one running
 *     somewhere -> don't trust it. A photo of a badge QR would otherwise
 *     be a standing, reusable credential; bounce to /login so a second
 *     party replaying a captured QR needs the owner's actual PIN.
 *   - Active session, different user -> don't touch the session. Save the
 *     badge owner's opted-in contact fields into the scanner's contacts.
 *   - Active session, same user -> no-op (you scanned your own badge while
 *     already logged in).
 */
export async function handleQrScan(token: string): Promise<ScanResult> {
  const trimmed = token.trim();
  if (!trimmed) return { mode: "error", error: "Missing badge code" };

  const admin = createAdminClient();

  // verify_qr_token runs SECURITY DEFINER — resolves a token to its owning
  // user_id without requiring the scanner to already have a session.
  const { data: scannedUserId, error: verifyError } = await admin.rpc("verify_qr_token", {
    p_token: trimmed,
  });
  if (verifyError || !scannedUserId) {
    return { mode: "error", error: "Invalid or expired badge code" };
  }

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    const { data: ownerHasSession, error: sessionCheckError } = await admin.rpc("has_active_session", {
      p_user_id: scannedUserId,
    });
    if (sessionCheckError) {
      return { mode: "error", error: "Could not verify badge" };
    }
    if (ownerHasSession) {
      return { mode: "redirect_login" };
    }

    const { error } = await mintSessionForUser(scannedUserId);
    return { mode: "login", error };
  }

  if (currentUser.id === scannedUserId) {
    return { mode: "self" };
  }

  // Different signed-in user scanning someone else's badge — contact-only,
  // never a session switch. Service role to read the target's row since
  // RLS's "view own user row" wouldn't otherwise let the scanner see it.
  const { data: target, error: targetError } = await admin
    .from("user")
    .select("first_name, last_name, company, email, phone, share_email, share_phone, share_company")
    .eq("user_id", scannedUserId)
    .single();
  if (targetError || !target) {
    return { mode: "error", error: "Could not load that badge's contact info" };
  }

  const name = [target.first_name, target.last_name].filter(Boolean).join(" ") || "Attendee";
  const { error: saveError } = await supabase.from("contacts").upsert(
    {
      owner_id: currentUser.id,
      contact_user_id: scannedUserId,
      first_name: target.first_name,
      last_name: target.last_name,
      company: target.share_company ? target.company : null,
      email: target.share_email ? target.email : null,
      phone: target.share_phone ? target.phone : null,
      saved_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,contact_user_id" },
  );
  if (saveError) {
    return { mode: "error", error: "Could not save that contact" };
  }

  return { mode: "contact", contact: { name, company: target.share_company ? target.company : null } };
}
