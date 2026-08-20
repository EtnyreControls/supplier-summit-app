import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";

/**
 * Gate for the actual admin console (status, live control, CRUD screens).
 * Isolated from the attendee app on purpose — its own nav, no shared
 * top-nav.tsx/navigation.tsx component, nothing links here from attendee
 * pages. Admins reach it by URL only.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between gap-6 border-b border-grey-200 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold text-ink">Admin</span>
          <nav className="flex flex-wrap gap-4 text-sm text-grey-600">
            <Link href="/admin" className="hover:text-ink">
              Status
            </Link>
            <Link href="/admin/live" className="hover:text-ink">
              Live control
            </Link>
            <Link href="/admin/manage" className="hover:text-ink">
              Manage
            </Link>
            <Link href="/admin/links" className="hover:text-ink">
              Links
            </Link>
          </nav>
        </div>
        {/* The only way back out — the admin area otherwise has no shared
            nav with the attendee app, so this is the deliberate exit
            rather than an oversight. */}
        <Link href="/welcome" className="text-sm text-grey-600 hover:text-ink">
          Exit to app →
        </Link>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
