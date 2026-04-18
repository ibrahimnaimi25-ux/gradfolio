import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  const url = new URL(request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url.origin;
}

/**
 * OAuth / magic-link callback.
 * Exchanges the ?code=... param for a session cookie, then routes:
 *   - no profile major yet  → /onboarding/major
 *   - company role          → /company/setup
 *   - manager role          → /manager/dashboard
 *   - otherwise             → /dashboard (or ?next= param)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const origin = getOrigin(request);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Decide where to go based on profile state
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_session`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, major")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null; major: string | null }>();

  // If explicit next= was passed (e.g. from password reset link), use it
  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Company users don't need a major
  if (profile?.role === "company") {
    return NextResponse.redirect(`${origin}/company/setup`);
  }

  // Managers / admins
  if (profile?.role === "manager") {
    return NextResponse.redirect(`${origin}/manager/dashboard`);
  }
  if (profile?.role === "admin") {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // Students / unknown: must have major selected
  if (!profile?.major) {
    return NextResponse.redirect(`${origin}/onboarding/major`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
