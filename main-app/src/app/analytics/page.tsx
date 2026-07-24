import Link from "next/link";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components";
import { AnalyticsPageClient } from "./analytics-page-client";

/**
 * Route: /analytics ("Analytics" in TopNav — only shown there for
 * role="analytics" users, see top-nav.tsx). Server Component: the actual
 * access control lives here, not in the nav — hiding the link doesn't stop
 * someone hitting the URL directly, so this checks the real DB role
 * (replacing the old demo PIN gate) before rendering anything.
 */
export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile } = authUser
    ? await supabase.from("user").select("role").eq("user_id", authUser.id).single()
    : { data: null };

  if (profile?.role !== "analytics") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <EmptyState
          icon={<LockRoundedIcon sx={{ fontSize: 32 }} />}
          title="Analytics access only"
          body="This area is restricted to the analytics role."
          action={
            <Link href="/" className="text-sm font-semibold text-ink underline underline-offset-2">
              Back home
            </Link>
          }
        />
      </div>
    );
  }

  return <AnalyticsPageClient />;
}
