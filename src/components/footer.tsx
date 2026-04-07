import Link from "next/link";
import { Container } from "@/components/ui/container";

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white mt-auto">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm">
                G
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-900">GradFolio</div>
                <div className="text-xs text-slate-500">Real tasks. Real proof.</div>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
              Helping students and fresh graduates build practical experience
              through real-world tasks and proof-based portfolios.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Platform
            </p>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/tasks" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                  Browse Tasks
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Account
            </p>
            <ul className="space-y-3">
              <li>
                <Link href="/login" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} GradFolio. All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            Built for students, by students.
          </p>
        </div>
      </Container>
    </footer>
  );
}
