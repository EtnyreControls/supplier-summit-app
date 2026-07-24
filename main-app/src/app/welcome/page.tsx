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

type MembershipRow = { event_tables: { table_name: string | null } | null };

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
    .select("event_tables(table_name)")
    .eq("user_id", authUser.id)
    .limit(1)
    .maybeSingle<MembershipRow>();

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Attendee";
  const company = profile?.company ?? "";
  const tableNumber = membership?.event_tables?.table_name ?? "TBD";

  return <WelcomePageClient name={name} company={company} tableNumber={tableNumber} />;
}
