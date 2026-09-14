import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/*
 * Next 16 renamed the `middleware` file convention to `proxy`; this is the
 * same edge-runtime hook under its current name.
 */

/**
 * Routes reachable without a session. Everything else goes to /start, which
 * quietly creates a guest account — there is no sign-in step.
 */
const PUBLIC_PATHS = ["/start", "/login", "/auth/callback", "/auth/error"];

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!userId && pathname.startsWith("/api/")) {
    // A fetch() can't follow a redirect to a login page into anything useful;
    // tell it plainly. Each route re-checks the session itself as well.
    return Response.json(
      { error: { code: "unauthenticated", message: "You're signed out. Sign in again and retry." } },
      { status: 401 },
    );
  }

  if (!userId && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/start";
    // Remember where they were headed so they land there once the guest
    // account exists.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (userId && (pathname === "/login" || pathname === "/start")) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except framework internals, the PWA shell files, and images.
     *
     * `_next` is excluded WHOLESALE, not just `_next/static` and
     * `_next/image`. The dev server's HMR websocket lives at `_next/hmr`, and
     * running an auth redirect on that upgrade request breaks the handshake —
     * which in Turbopack stalls hydration, so the whole app renders but never
     * becomes interactive. Production is unaffected, which makes it a nasty
     * one to notice. It also spares a Supabase round trip per asset request.
     */
    "/((?!_next/|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
