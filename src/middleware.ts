import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that authenticated users can ALWAYS reach, regardless of
 * onboarding status. Public routes and auth routes live here.
 */
const ALWAYS_ALLOWED = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/onboarding/major",
  "/auth/callback",
  "/auth/signout",
  "/terms",
  "/privacy",
  "/company/register",
  "/jobs",
];

/** Paths that skip auth check entirely (public / static / API) */
const PUBLIC_PREFIXES = [
  "/_next",
  "/api",
  "/favicon",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware entirely for static + API + auth-internal paths
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip for unauthenticated public pages
  if (pathname === "/" || ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Build a Supabase client that can mutate cookies on the response
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Unauthenticated users trying to hit protected pages → login
    return NextResponse.next();
  }

  // Authenticated — enforce major selection for students
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, major")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null; major: string | null }>();

  // No profile row yet (race with auto-create trigger): allow onboarding
  if (!profile) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding/major";
    return NextResponse.redirect(url);
  }

  // Non-students (company, admin, manager) skip major enforcement
  if (profile.role && profile.role !== "student") {
    return response;
  }

  // Students without a major → force onboarding
  if (!profile.major) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding/major";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, favicon.png, etc.
     * - Any file with an extension (e.g. .png, .svg, .js)
     */
    "/((?!_next/static|_next/image|favicon|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|js|css|txt|xml|woff|woff2|ttf)$).*)",
  ],
};
