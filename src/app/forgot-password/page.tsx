"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setMessage(error.message);
      setIsError(true);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm">
              G
            </div>
            <span className="text-base font-bold text-slate-900">GradFolio</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Reset your password
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-slate-900">Check your email</h2>
              <p className="mt-2 text-sm text-slate-500">
                We sent a password reset link to <span className="font-medium text-slate-700">{email}</span>.
                Check your inbox and follow the link to set a new password.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900">Forgot password</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                We&apos;ll email you a secure link to reset it.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              {message && (
                <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                  isError
                    ? "border-rose-100 bg-rose-50 text-rose-700"
                    : "border-emerald-100 bg-emerald-50 text-emerald-700"
                }`}>
                  {message}
                </div>
              )}

              <div className="mt-6 text-center text-sm text-slate-500">
                <Link
                  href="/login"
                  className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  ← Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
