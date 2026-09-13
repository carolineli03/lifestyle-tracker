import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Magic-link landing point.
 *
 * Supabase sends one of two shapes depending on how the project is
 * configured, so handle both rather than guessing:
 *   ?code=...                  PKCE flow
 *   ?token_hash=...&type=...   older email-link flow
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next");
  const destination = next && next.startsWith("/") ? next : "/today";

  const supabase = await supabaseServer();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, origin));
    return NextResponse.redirect(
      new URL(`/auth/error?reason=${encodeURIComponent(error.message)}`, origin),
    );
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash && (type === "magiclink" || type === "email" || type === "signup")) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destination, origin));
    return NextResponse.redirect(
      new URL(`/auth/error?reason=${encodeURIComponent(error.message)}`, origin),
    );
  }

  return NextResponse.redirect(new URL("/auth/error?reason=missing-code", origin));
}
