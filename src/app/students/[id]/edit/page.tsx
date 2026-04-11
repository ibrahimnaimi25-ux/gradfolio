import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MAJOR_NAMES } from "@/lib/majors";
import {
  saveProfile,
  uploadAvatar,
  removeAvatar,
} from "@/app/students/[id]/actions";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/students/${id}/edit`);
  if (user.id !== id) redirect(`/students/${id}`);

  // Fetch all profile fields
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, headline, bio, major, skills, linkedin_url, github_url, behance_url, website_url, resume_link, resume_url, resume_name, avatar_url"
    )
    .eq("id", id)
    .maybeSingle<{
      full_name: string | null;
      headline: string | null;
      bio: string | null;
      major: string | null;
      skills: string | null;
      linkedin_url: string | null;
      github_url: string | null;
      behance_url: string | null;
      website_url: string | null;
      resume_link: string | null;
      resume_url: string | null;
      resume_name: string | null;
      avatar_url: string | null;
    }>();

  const p = profile ?? {
    full_name: null,
    headline: null,
    bio: null,
    major: null,
    skills: null,
    linkedin_url: null,
    github_url: null,
    behance_url: null,
    website_url: null,
    resume_link: null,
    resume_url: null,
    resume_name: null,
    avatar_url: null,
  };

  function getInitials(name: string | null) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Edit Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your portfolio is visible to managers and admins.
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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Preview */}
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatar_url}
                alt="Profile photo"
                className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow">
                {getInitials(p.full_name)}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {/* Upload new photo */}
              <form action={uploadAvatar} className="flex items-center gap-2">
                <label
                  htmlFor="avatar-input"
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
                >
                  Choose photo
                  <input
                    id="avatar-input"
                    name="avatar"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const form = e.currentTarget.closest("form");
                      if (form && e.currentTarget.files?.length) form.requestSubmit();
                    }}
                  />
                </label>
                <span className="text-xs text-slate-400">JPG, PNG or WebP · max 2 MB</span>
              </form>

              {/* Remove photo */}
              {p.avatar_url && (
                <form action={removeAvatar}>
                  <input type="hidden" name="avatar_url" value={p.avatar_url} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-500 transition hover:text-red-700"
                  >
                    Remove photo
                  </button>
                </form>
              )}
            </div>
          </div>
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
                  {MAJOR_NAMES.map((m) => (
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
                <label
                  htmlFor="skills"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Skills
                  <span className="ml-1.5 text-xs text-slate-400">
                    (comma-separated)
                  </span>
                </label>
                <input
                  id="skills"
                  name="skills"
                  type="text"
                  defaultValue={p.skills ?? ""}
                  placeholder="Python, Threat Analysis, SIEM, Report Writing"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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

          {/* Save + Cancel buttons */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Save Profile
            </button>
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
