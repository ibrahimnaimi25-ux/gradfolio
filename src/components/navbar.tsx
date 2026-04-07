import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/navbar-links";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  const studentLinks = [
    { href: "/", label: "Home" },
    { href: "/tasks", label: "Tasks" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  const adminLinks = [
    ...studentLinks,
    { href: "/admin/tasks", label: "Admin Tasks" },
    { href: "/admin/sections", label: "Admin Sections" },
  ];

  const guestLinks = [{ href: "/", label: "Home" }];

  const links = !user ? guestLinks : isAdmin ? adminLinks : studentLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl shadow-sm">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm">
              G
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight text-slate-900">
                GradFolio
              </span>
              <span className="text-xs font-medium text-slate-400">
                Real tasks. Real proof.
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLinks links={links} />
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 md:inline-block">
                {isAdmin ? "Admin" : "Student"}
              </span>
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900"
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
              <Button href="/register" className="px-4 py-2 text-sm">
                Get Started
              </Button>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
