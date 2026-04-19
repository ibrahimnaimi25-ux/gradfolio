import { requireCompany } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Company Profile | GradFolio" };

type SearchParams = Promise<{ saved?: string; error?: string }>;

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

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

async function saveCompanyProfile(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();

  const str = (k: string) => formData.get(k)?.toString().trim() || null;

  const fields = {
    full_name: str("company_name"),
    company_name: str("company_name"),
    industry: str("industry"),
    company_website: str("company_website"),
    company_size: str("company_size"),
    company_description: str("company_description"),
  };

  if (!fields.company_name) {
    redirect("/company/profile?error=Company+name+is+required");
  }

  const { error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id);

  if (error) {
    redirect(`/company/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/company/profile");
  revalidatePath("/company/dashboard");
  redirect("/company/profile?saved=1");
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireCompany();
  const { saved, error } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-sm">
              {getInitials(profile.company_name)}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                Company Profile
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                How students see you
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                A complete profile helps students recognise your brand and trust your roles.
              </p>
            </div>
          </div>
        </section>

        {saved === "1" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ Profile updated successfully.
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            ✗ {decodeURIComponent(error)}
          </div>
        )}

        {/* Editor */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <form action={saveCompanyProfile} className="space-y-5">
            <div>
              <label htmlFor="company_name" className={labelClass}>
                Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                defaultValue={profile.company_name ?? ""}
                placeholder="Acme Corp"
                className={inputClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="industry" className={labelClass}>
                  Industry
                </label>
                <select
                  id="industry"
                  name="industry"
                  defaultValue={profile.industry ?? INDUSTRIES[0]}
                  className={inputClass}
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="company_size" className={labelClass}>
                  Company Size
                </label>
                <select
                  id="company_size"
                  name="company_size"
                  defaultValue={profile.company_size ?? COMPANY_SIZES[0]}
                  className={inputClass}
                >
                  {COMPANY_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="company_website" className={labelClass}>
                Website
              </label>
              <input
                id="company_website"
                name="company_website"
                type="url"
                defaultValue={profile.company_website ?? ""}
                placeholder="https://yourcompany.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="company_description" className={labelClass}>
                What are you looking for?
              </label>
              <textarea
                id="company_description"
                name="company_description"
                rows={4}
                defaultValue={profile.company_description ?? ""}
                placeholder="We're hiring cybersecurity interns and looking for students with hands-on red-team experience…"
                className={`${inputClass} resize-none`}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Shown on Discover Talent and on your job posts.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <Link
                href="/company/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                ← Back to dashboard
              </Link>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Save profile
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
