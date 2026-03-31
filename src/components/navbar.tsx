import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Navbar() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold text-gray-900">
          GradFolio
        </Link>

        <nav className="flex items-center gap-4 text-sm font-medium text-gray-700">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <Link href="/tasks" className="hover:text-blue-600">
            Tasks
          </Link>

          {user ? (
            <Link href="/dashboard" className="hover:text-blue-600">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-blue-600">
                Login
              </Link>
              <Link href="/register" className="hover:text-blue-600">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}