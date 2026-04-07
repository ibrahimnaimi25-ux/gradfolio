import AuthForm from "@/components/auth-form";
import Link from "next/link";

export const metadata = { title: "Login | GradFolio" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm">
              G
            </div>
            <span className="text-base font-bold text-slate-900">GradFolio</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to access your tasks and portfolio.
          </p>
        </div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
