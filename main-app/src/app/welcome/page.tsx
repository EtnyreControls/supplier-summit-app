import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomePageClient } from "./welcome-page-client";

/**
 * Route: /welcome
 * Landed on immediately after QR badge login resolves. Server Component:
 * reads the signed-in user's own row plus their event_table_members
 * membership (if any) to feed the one-time WelcomeReveal, then hands off
 * to the client for the timer/animation and the redirect into Event Info.
 */

type MembershipRow = { event_tables: { table_name: string | null; table_label: string | null } | null };
// Placeholder value every table starts with (see
// 20260901140000_add_table_label.sql) — not a real name yet, so treated the
// same as no label.
const UNNAMED_TABLE_LABEL = "TBD";

export default async function WelcomePage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("user")
    .select("first_name, last_name, company")
    .eq("user_id", authUser.id)
    .single();

  const { data: membership } = await supabase
    .from("event_table_members")
    .select("event_tables(table_name, table_label)")
    .eq("user_id", authUser.id)
    .limit(1)
    .maybeSingle<MembershipRow>();

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Attendee";
  const company = profile?.company ?? "";
  const tableNumber = membership?.event_tables?.table_name ?? null;
  const rawLabel = membership?.event_tables?.table_label ?? null;
  const tableLabel = rawLabel && rawLabel !== UNNAMED_TABLE_LABEL ? rawLabel : null;

  return <WelcomePageClient name={name} company={company} tableNumber={tableNumber} tableLabel={tableLabel} />;
}
