import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * App-wide auth gate (this Next version's `proxy.ts` — the renamed
 * middleware convention; this file replaces the old root middleware.ts).
 * Every request refreshes the Supabase session, then anything without a
 * signed-in user is bounced to /login — including when the auth check
 * itself throws (bad cookies, Supabase unreachable), so "any problem"
 * lands on the manual login screen rather than a broken
 * half-authenticated page.
 *
 * Signed-in accounts with user.must_change_pin still set (forced by the
 * bulk PIN reset in 20260821180000_force_pin_change.sql, or true by default
 * for any new account) are no longer redirected away from whatever page
 * they asked for — that redirect, chained with the change-pin form's own
 * post-submit navigation, is what caused the multi-minute "Saving…" hangs
 * various sessions kept hitting. Instead they reach their page normally and
 * a non-dismissable dialog (MustChangePinGate, in the root layout) sits on
 * top of it until they follow it to /change-pin and back.
 *
 * Public: /login (PIN entry) and /qr (badge scans must work signed-out —
 * that's how people log in; its server action decides login vs. contact
 * per-device). API routes get a 401 instead of a redirect so client
 * fetch() calls fail loudly instead of "succeeding" with login-page HTML —
 * same reasoning applies to skipping the must-change-pin redirect for them.
 */
const PUBLIC_PATHS = ["/login", "/qr"];

// Every response this proxy returns gets this header — without it, a
// browser's back/forward cache (bfcache) can restore a page exactly as it
// looked *before* a redirect fired here, entirely client-side, with no
// network request and so no re-run of this gate. Concretely: signing out
// and hitting Back could otherwise hand back an already-rendered
// signed-in page straight from bfcache with no re-check. `no-store` tells
// the browser not to bfcache the page at all, so Back forces a real
// navigation through this proxy again instead.
function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api/");

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return withNoStore(NextResponse.redirect(url));
  };

  try {
    const { response, user } = await updateSession(request);

    if (!user) {
      if (isPublic) return withNoStore(response);
      if (isApi) {
        return withNoStore(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
      }
      return toLogin();
    }

    return withNoStore(response);
  } catch {
    if (isPublic) return withNoStore(NextResponse.next({ request }));
    if (isApi) {
      return withNoStore(NextResponse.json({ error: "Auth check failed" }, { status: 401 }));
    }
    return toLogin();
  }
}

export const config = {
  // Everything except Next's static/image internals and plain asset files
  // (the chipspreader art, icons, fonts) — those must load on /login too.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
