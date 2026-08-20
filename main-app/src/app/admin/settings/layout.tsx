import { requireAdmin } from "@/lib/supabase/require-admin";

/**
 * Covers /admin/settings/mfa — checks role only, not aal2, so an admin who
 * hasn't enrolled TOTP yet (and therefore can never reach aal2) can still
 * get here to enroll. Every other /admin/* route lives under
 * (protected)/layout.tsx, which requires the full aal2 check.
 */
export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin({ skipMfaCheck: true });
  return <>{children}</>;
}
