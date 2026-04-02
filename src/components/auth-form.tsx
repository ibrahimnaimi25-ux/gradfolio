"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type AuthFormProps = {
  mode: "login" | "register";
};

const MAJORS = ["Cybersecurity", "Marketing", "Business"];

export default function AuthForm({ mode }: AuthFormProps) {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("Cybersecurity");
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

        setMessage("Registration successful. You can now log in.");
        setLoading(false);
        router.push("/login");
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
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">
        {mode === "login" ? "Login" : "Create account"}
      </h1>

      <p className="mt-2 text-sm text-gray-600">
        {mode === "login"
          ? "Login to continue to your dashboard."
          : "Create your GradFolio account."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Major
              </label>
              <select
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
              >
                {MAJORS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>

      {message && (
        <p className="mt-4 text-center text-sm text-red-600">{message}</p>
      )}

      <div className="mt-6 text-center text-sm text-gray-600">
        {mode === "login" ? (
          <p>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-blue-600">
              Register
            </Link>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600">
              Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}