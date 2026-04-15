"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400";

const INDUSTRIES = [
  "Technology",
  "Finance & Banking",
  "Marketing & Advertising",
  "Cybersecurity",
  "Healthcare",
  "E-Commerce",
  "Consulting",
  "Education",
  "Media & Entertainment",
  "Manufacturing",
  "Other",
];

const COMPANY_SIZES = [
  "1–10 employees",
  "11–50 employees",
  "51–200 employees",
  "201–1,000 employees",
  "1,000+ employees",
];

export default function CompanyRegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [size, setSize] = useState(COMPANY_SIZES[0]);
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setMessage("Company name is required.");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: companyName.trim(),
            role: "company",
            company_name: companyName.trim(),
            industry,
            company_size: size,
            company_website: website.trim() || null,
            company_description: description.trim() || null,
          },
        },
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      router.push("/company/setup?registered=1");
    } catch {
      setMessage("Network error — could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 py-16">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">

          {/* Left panel */}
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm md:p-10">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">G</div>
              <span className="text-sm font-bold text-slate-900">GradFolio</span>
            </Link>

            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">For Companies</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Find verified talent
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Every student on GradFolio has completed real tasks reviewed by industry managers —
              you see proof of work, not just a CV.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  icon: "🎯",
                  title: "Opt-in students only",
                  desc: "Browse students who actively want to be discovered. No cold contact.",
                },
                {
                  icon: "✅",
                  title: "Reviewed & scored work",
                  desc: "Every portfolio item is manager-approved with a quality score.",
                },
                {
                  icon: "🔒",
                  title: "Platform-controlled access",
                  desc: "Student data stays on GradFolio — no scrapers, no public CVs.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs leading-5 text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 text-sm text-slate-500">
              Already registered?{" "}
              <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          {/* Registration form */}
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create company account</h2>
            <p className="text-sm text-slate-500 mb-6">Fill in your company details to get started.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Company Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="Acme Corp"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Industry</label>
                <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass}>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Company Size</label>
                <select value={size} onChange={(e) => setSize(e.target.value)} className={inputClass}>
                  {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">What are you looking for?</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="We're hiring cybersecurity interns and looking for students with…"
                  className={`${inputClass} resize-none`}
                />
              </div>

              <hr className="border-slate-100" />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Work Email <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="hiring@yourcompany.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password <span className="text-rose-500">*</span></label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account…" : "Create Company Account"}
              </button>
            </form>

            {message && (
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
