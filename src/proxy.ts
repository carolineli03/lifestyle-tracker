import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/*
 * Next 16 renamed the `middleware` file convention to `proxy`; this is the
 * same edge-runtime hook under its current name.
 */

/** Routes reachable without a session. Everything else redirects to /login. */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/error"];

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!userId && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so the magic link lands there.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (userId && pathname === "/login") {
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
     * Everything except static assets, the PWA shell files, and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
