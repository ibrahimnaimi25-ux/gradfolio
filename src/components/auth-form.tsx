"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MAJOR_NAMES } from "@/lib/majors";
import GoogleSignInButton from "@/components/google-signin-button";

type AuthFormProps = {
  mode: "login" | "register";
  /** Major names fetched from DB by the server page. Falls back to static list. */
  majors?: string[];
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400";

export default function AuthForm({ mode, majors }: AuthFormProps) {
  const supabase = createClient();
  const router = useRouter();

  const availableMajors = majors && majors.length > 0 ? majors : MAJOR_NAMES;

  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState(availableMajors[0] ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: "student",
              major,
            },
          },
        });

        if (error) {
          setMessage(error.message);
          setLoading(false);
          return;
        }

        // Redirect to email verification page instead of login
        setLoading(false);
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      // Check if this user still needs major selection (students only)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, major")
          .eq("id", user.id)
          .maybeSingle();
        setLoading(false);
        if (profile?.role === "company") {
          router.push("/company/setup");
        } else if (profile?.role === "manager") {
          router.push("/manager/dashboard");
        } else if (profile?.role === "admin") {
          router.push("/dashboard");
        } else if (!profile?.major) {
          router.push("/onboarding/major");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
        return;
      }
      setLoading(false);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setMessage("Network error: could not reach Supabase.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        {mode === "login"
          ? "Enter your credentials to continue."
          : "Fill in the details below to get started."}
      </p>

      {/* Google signin — quick path */}
      <div className="mt-6">
        <GoogleSignInButton label={mode === "login" ? "Sign in with Google" : "Sign up with Google"} />
      </div>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs font-medium text-slate-400">or with email</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Your full name"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Major
              </label>
              <select
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className={inputClass}
              >
                {availableMajors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>

      {message && (
        <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      )}

      <div className="mt-6 text-center text-sm text-slate-500">
        {mode === "login" ? (
          <p>
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Get started
            </Link>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
