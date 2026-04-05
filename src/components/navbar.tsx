import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
      <Container className="flex h-18 items-center justify-between">
        <Link href="/" className="text-2xl font-bold tracking-tight text-slate-900">
          GradFolio
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Home
          </Link>

          {user && (
            <>
              <Link
                href="/tasks"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Tasks
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Dashboard
              </Link>
            </>
          )}

          {user ? (
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Logout
              </button>
            </form>
          ) : (
            <Button href="/login" variant="secondary">
              Login
            </Button>
          )}
        </nav>

        {/* Mobile */}
        <div className="md:hidden">
          {user ? (
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Logout
              </button>
            </form>
          ) : (
            <Button href="/login" variant="secondary" className="px-3 py-2 text-sm">
              Login
            </Button>
          )}
        </div>
      </Container>
    </header>
  );
}