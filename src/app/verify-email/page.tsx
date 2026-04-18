"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleResend() {
    if (!email) {
      setMessage({ type: "error", text: "No email address found. Please go back and sign up again." });
      return;
    }
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setLoading(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Verification email sent. Check your inbox." });
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">G</div>
          <span className="text-sm font-bold text-slate-900">GradFolio</span>
        </div>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
          📧
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Check your email
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          We sent a verification link to{" "}
          {email ? (
            <strong className="text-slate-900">{email}</strong>
          ) : (
            "your email address"
          )}
          . Click the link to activate your account.
        </p>

        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            What happens next
          </p>
          <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
            <li>Open the email we just sent</li>
            <li>Click the verification link</li>
            <li>Return here and sign in</li>
          </ol>
        </div>

        {message && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm ${
              message.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending…" : "Resend verification email"}
          </button>
          <Link
            href="/login"
            className="block w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Go to sign in
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Didn&apos;t receive it? Check your spam folder, or use &ldquo;Resend&rdquo; above.
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
