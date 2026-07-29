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
 * Public: /login (PIN entry) and /qr (badge scans must work signed-out —
 * that's how people log in; its server action decides login vs. contact
 * per-device). API routes get a 401 instead of a redirect so client
 * fetch() calls fail loudly instead of "succeeding" with login-page HTML.
 */
const PUBLIC_PATHS = ["/login", "/qr"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  };

  try {
    const { response, user } = await updateSession(request);
    if (user || isPublic) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    return toLogin();
  } catch {
    if (isPublic) return NextResponse.next({ request });
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Auth check failed" }, { status: 401 });
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
