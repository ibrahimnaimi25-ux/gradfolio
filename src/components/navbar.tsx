import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if user is admin
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <Container className="flex h-20 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-sm">
              G
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                GradFolio
              </span>
              <span className="text-xs font-medium text-slate-500">
                Real tasks. Real proof.
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <Link
              href="/"
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Home
            </Link>

            {user && (
              <>
                <Link
                  href="/tasks"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Tasks
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Dashboard
                </Link>

                {isAdmin && (
                  <>
                    <Link
                      href="/admin/tasks"
                      className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Admin Tasks
                    </Link>
                    <Link
                      href="/admin/sections"
                      className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Admin Sections
                    </Link>
                  </>
                )}
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 md:block">
                Signed in
              </div>
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:inline-flex"
              >
                Login
              </Link>
              <Button href="/register" className="px-5 py-2.5 text-sm">
                Get Started
              </Button>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}