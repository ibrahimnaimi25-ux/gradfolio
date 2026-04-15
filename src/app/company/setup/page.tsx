import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Company Dashboard | GradFolio" };

type SearchParams = Promise<{ registered?: string; saved?: string }>;

type ConnectionRow = {
  id: string;
  student_id: string;
  created_at: string;
  status: string;
  message: string | null;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  major: string | null;
  headline: string | null;
  avatar_url: string | null;
};

async function saveCompanyProfile(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();

  const str = (k: string) => formData.get(k)?.toString().trim() || null;

  const fields = {
    full_name:           str("company_name"),
    company_name:        str("company_name"),
    industry:            str("industry"),
    company_website:     str("company_website"),
    company_size:        str("company_size"),
    company_description: str("company_description"),
  };

  const { error: bulkErr } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id);

  if (bulkErr) {
    // fallback field-by-field
    for (const [col, val] of Object.entries(fields)) {
      await supabase.from("profiles").update({ [col]: val }).eq("id", user.id);
    }
  }

  revalidatePath("/company/setup");
  redirect("/company/setup?saved=1");
}

const INDUSTRIES = [
  "Technology", "Finance & Banking", "Marketing & Advertising",
  "Cybersecurity", "Healthcare", "E-Commerce", "Consulting",
  "Education", "Media & Entertainment", "Manufacturing", "Other",
];

const COMPANY_SIZES = [
  "1–10 employees", "11–50 employees", "51–200 employees",
  "201–1,000 employees", "1,000+ employees",
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function CompanySetupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, profile } = await requireCompany();
  const { registered, saved } = await searchParams;
  const supabase = await createClient();

  // Fetch connections (interests expressed by this company)
  const { data: connections } = await supabase
    .from("connections")
    .select("id, student_id, created_at, status, message")
    .eq("company_user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<ConnectionRow[]>();

  const connectionList = connections ?? [];
  const studentIds = connectionList.map((c) => c.student_id);

  let studentMap: Record<string, StudentProfile> = {};
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, major, headline, avatar_url")
      .in("id", studentIds)
      .returns<StudentProfile[]>();
    studentMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 space-y-8">

        {/* Header */}
        <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Company Account</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                {profile.company_name ?? "Your Company"}
              </h1>
              {profile.industry && (
                <p className="mt-1 text-sm text-slate-500">{profile.industry}</p>
              )}
            </div>
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              🔍 Discover Talent
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Interested In</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{connectionList.length}</p>
            </div>
            {profile.company_size && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Size</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{profile.company_size}</p>
              </div>
            )}
            {profile.company_website && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Website</p>
                <a
                  href={profile.company_website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {profile.company_website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        {registered === "1" && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            Welcome to GradFolio! Your company account is ready. Head to{" "}
            <Link href="/discover" className="font-semibold underline">Discover Talent</Link>{" "}
            to start finding students.
          </div>
        )}
        {saved === "1" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Profile updated successfully.
          </div>
        )}

        {/* Students I'm interested in */}
        {connectionList.length > 0 && (
          <section className="rounded-3xl border border-black/5 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Students You&apos;re Interested In
              </h2>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                {connectionList.length}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {connectionList.map((conn) => {
                const student = studentMap[conn.student_id];
                if (!student) return null;
                return (
                  <li key={conn.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition">
                    {student.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={student.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                        {getInitials(student.full_name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {student.full_name ?? "Student"}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {student.major ?? ""}{student.headline ? ` · ${student.headline}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3 text-xs text-slate-400">
                      <span>{relativeTime(conn.created_at)}</span>
                      <Link
                        href={`/students/${conn.student_id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        View →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {connectionList.length === 0 && (
          <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-semibold text-slate-700">No interests yet</h3>
            <p className="mt-1 text-sm text-slate-400">
              Browse students and click &ldquo;I&apos;m Interested&rdquo; to start building your pipeline.
            </p>
            <Link
              href="/discover"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Discover Talent →
            </Link>
          </section>
        )}

        {/* Company profile editor */}
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Company Profile
          </h2>
          <form action={saveCompanyProfile} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Company Name</label>
              <input name="company_name" type="text" defaultValue={profile.company_name ?? ""} placeholder="Acme Corp" className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Industry</label>
                <select name="industry" defaultValue={profile.industry ?? INDUSTRIES[0]} className={inputClass}>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Company Size</label>
                <select name="company_size" defaultValue={profile.company_size ?? COMPANY_SIZES[0]} className={inputClass}>
                  {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Website</label>
              <input name="company_website" type="url" defaultValue={profile.company_website ?? ""} placeholder="https://yourcompany.com" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">What are you looking for?</label>
              <textarea name="company_description" rows={3} defaultValue={profile.company_description ?? ""} placeholder="We're looking for cybersecurity students with…" className={`${inputClass} resize-none`} />
            </div>
            <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700">
              Save Profile
            </button>
          </form>
        </section>

      </div>
    </main>
  );
}
