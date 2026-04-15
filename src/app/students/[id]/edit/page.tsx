import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMajorNames } from "@/lib/majors-db";
import { saveProfile } from "@/app/students/[id]/actions";
import AvatarForm from "./avatar-form";
import SubmitButton from "@/components/submit-button";
import TagInput from "@/components/tag-input";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; photo?: string }>;
}

export const metadata: Metadata = {
  title: "Edit Profile | GradFolio",
};

export default async function EditProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, photo } = await searchParams;

  const supabase = await createClient();
  const majorNames = await getMajorNames(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/students/${id}/edit`);
  if (user.id !== id) redirect(`/students/${id}`);

  // Fetch guaranteed-existing columns first
  const { data: baseProfile } = await supabase
    .from("profiles")
    .select("full_name, major")
    .eq("id", id)
    .maybeSingle<{ full_name: string | null; major: string | null }>();

  // Fetch all optional columns — degrades gracefully before migration
  let bio: string | null = null;
  let headline: string | null = null;
  let skills: string | null = null;
  let linkedin_url: string | null = null;
  let github_url: string | null = null;
  let behance_url: string | null = null;
  let website_url: string | null = null;
  let resume_link: string | null = null;
  let resume_url: string | null = null;
  let resume_name: string | null = null;
  let avatar_url: string | null = null;
  let is_public = false;
  try {
    const { data: extras } = await supabase
      .from("profiles")
      .select("bio, headline, skills, linkedin_url, github_url, behance_url, website_url, resume_link, resume_url, resume_name, avatar_url, is_public")
      .eq("id", id)
      .maybeSingle<{
        bio: string | null; headline: string | null; skills: string | null;
        linkedin_url: string | null; github_url: string | null; behance_url: string | null;
        website_url: string | null; resume_link: string | null; resume_url: string | null;
        resume_name: string | null; avatar_url: string | null; is_public: boolean | null;
      }>();
    bio = extras?.bio ?? null;
    headline = extras?.headline ?? null;
    skills = extras?.skills ?? null;
    linkedin_url = extras?.linkedin_url ?? null;
    github_url = extras?.github_url ?? null;
    behance_url = extras?.behance_url ?? null;
    website_url = extras?.website_url ?? null;
    resume_link = extras?.resume_link ?? null;
    resume_url = extras?.resume_url ?? null;
    resume_name = extras?.resume_name ?? null;
    avatar_url = extras?.avatar_url ?? null;
    is_public = extras?.is_public ?? false;
  } catch {
    // columns not yet migrated — degrade gracefully
  }

  const p = {
    full_name: baseProfile?.full_name ?? null,
    major: baseProfile?.major ?? null,
    bio, headline, skills, linkedin_url, github_url, behance_url,
    website_url, resume_link, resume_url, resume_name, avatar_url, is_public,
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Edit Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {p.is_public
              ? "Your portfolio is public — anyone with the link can view it."
              : "Your portfolio is private — only managers and admins can view it."}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        {/* Photo saved banner */}
        {photo === "saved" && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Profile photo updated.
          </div>
        )}

        {/* ── Avatar section ───────────────────────────────────────────── */}
        <section className="mb-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Profile Photo
          </h2>

          <AvatarForm avatarUrl={p.avatar_url} fullName={p.full_name} />
        </section>

        {/* ── Main profile form ─────────────────────────────────────────── */}
        <form action={saveProfile}>
          <input type="hidden" name="profile_id" value={id} />

          {/* Basic info */}
          <section className="mb-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Basic Info
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="full_name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Full Name
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  defaultValue={p.full_name ?? ""}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label
                  htmlFor="headline"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Headline
                </label>
                <input
                  id="headline"
                  name="headline"
                  type="text"
                  defaultValue={p.headline ?? ""}
                  placeholder="Cybersecurity student · Aspiring SOC analyst"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label
                  htmlFor="major"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Major
                </label>
                <select
                  id="major"
                  name="major"
                  defaultValue={p.major ?? ""}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">— select major —</option>
                  {majorNames.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bio"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  About / Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={4}
                  defaultValue={p.bio ?? ""}
                  placeholder="A short summary about yourself and what you're working towards…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Skills
                </label>
                <TagInput
                  name="skills"
                  initialValue={p.skills}
                  placeholder="Type a skill and press Enter…"
                />
              </div>
            </div>
          </section>

          {/* Professional links */}
          <section className="mb-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Professional Links
            </h2>

            <div className="space-y-4">
              {[
                {
                  id: "linkedin_url",
                  label: "LinkedIn",
                  placeholder: "https://linkedin.com/in/yourname",
                  value: p.linkedin_url,
                },
                {
                  id: "github_url",
                  label: "GitHub",
                  placeholder: "https://github.com/yourname",
                  value: p.github_url,
                },
                {
                  id: "behance_url",
                  label: "Behance",
                  placeholder: "https://behance.net/yourname",
                  value: p.behance_url,
                },
                {
                  id: "website_url",
                  label: "Portfolio / Website",
                  placeholder: "https://yoursite.com",
                  value: p.website_url,
                },
                {
                  id: "resume_link",
                  label: "Resume Link",
                  placeholder: "https://drive.google.com/… or similar",
                  value: p.resume_link,
                },
              ].map(({ id: fieldId, label, placeholder, value }) => (
                <div key={fieldId}>
                  <label
                    htmlFor={fieldId}
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    {label}
                  </label>
                  <input
                    id={fieldId}
                    name={fieldId}
                    type="url"
                    defaultValue={value ?? ""}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Resume PDF — managed on dashboard */}
          {p.resume_url && (
            <section className="mb-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Uploaded Resume
              </h2>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="h-5 w-5 shrink-0 text-indigo-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-indigo-700 truncate max-w-xs">
                    {p.resume_name ?? "resume.pdf"}
                  </span>
                </div>
                <a
                  href="/dashboard"
                  className="shrink-0 text-xs font-medium text-indigo-600 transition hover:text-indigo-800"
                >
                  Manage on Dashboard →
                </a>
              </div>
            </section>
          )}

          {/* Portfolio visibility */}
          <section className="mb-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Portfolio Visibility
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              Public portfolios appear in the{" "}
              <a href="/talent" className="text-indigo-600 hover:underline">Talent Directory</a>{" "}
              and can be viewed by anyone with the link — including employers.
            </p>

            {/* Hidden input for unchecked state */}
            <input type="hidden" name="is_public" value="0" />

            <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:bg-white transition">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  name="is_public"
                  value="1"
                  defaultChecked={p.is_public}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-indigo-500" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Make my portfolio public
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Employers and visitors can discover and view your approved work.
                </p>
              </div>
            </label>
          </section>

          {/* Save + Cancel buttons */}
          <div className="flex items-center gap-3">
            <SubmitButton label="Save Profile" loadingLabel="Saving…" />
            <a
              href={`/students/${id}`}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:border-slate-300"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
