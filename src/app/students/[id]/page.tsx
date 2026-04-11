import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

type Profile = {
  id: string;
  full_name: string | null;
  major: string | null;
  role: string;
  bio: string | null;
  linkedin_url: string | null;
  github_url: string | null;
};

type SubmissionWithTask = {
  id: string;
  task_id: string;
  score: number | null;
  review_status: string | null;
  admin_feedback: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  tasks: {
    id: string;
    title: string;
    major: string | null;
    section_id: string | null;
  } | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, major")
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();
  if (!data) return { title: "Portfolio | GradFolio" };
  return {
    title: `${data.full_name ?? "Student"} — Portfolio | GradFolio`,
    description: `View ${data.full_name ?? "this student"}'s completed tasks and proof of work on GradFolio.`,
  };
}

function StarRating({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-3.5 w-3.5 ${i < score ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value)
  );
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

const MAJOR_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Cybersecurity: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
  Marketing: { bg: "bg-pink-50", text: "text-pink-700", dot: "bg-pink-500" },
  Business: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
};

function MajorBadge({ major }: { major: string | null }) {
  if (!major) return null;
  const style = MAJOR_COLORS[major] ?? {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {major}
    </span>
  );
}

export default async function StudentPortfolioPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch student profile — only show students, not admins/managers
  // bio, linkedin_url, github_url are optional columns — added later via migration
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, major, role")
    .eq("id", id)
    .maybeSingle<Omit<Profile, "bio" | "linkedin_url" | "github_url">>();

  if (!profile || (profile.role !== "student" && profile.role !== "admin" && profile.role !== "manager")) notFound();

  // Try to fetch optional profile fields — won't crash if columns don't exist yet
  let bio: string | null = null;
  let linkedin_url: string | null = null;
  let github_url: string | null = null;
  let resume_url: string | null = null;
  let resume_name: string | null = null;
  try {
    const { data: extras } = await supabase
      .from("profiles")
      .select("bio, linkedin_url, github_url, resume_url, resume_name")
      .eq("id", id)
      .maybeSingle<{
        bio: string | null;
        linkedin_url: string | null;
        github_url: string | null;
        resume_url: string | null;
        resume_name: string | null;
      }>();
    bio = extras?.bio ?? null;
    linkedin_url = extras?.linkedin_url ?? null;
    github_url = extras?.github_url ?? null;
    resume_url = extras?.resume_url ?? null;
    resume_name = extras?.resume_name ?? null;
  } catch {
    // columns don't exist yet — silently skip
  }

  const fullProfile: Profile = { ...profile, bio, linkedin_url, github_url };
  // resume stored separately
  const hasResume = !!resume_url;

  // Fetch reviewed submissions with task data
  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select(
      "id, task_id, score, review_status, admin_feedback, reviewed_at, submitted_at, tasks(id, title, major, section_id)"
    )
    .eq("user_id", id)
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .returns<SubmissionWithTask[]>();

  const submissions = (submissionsRaw ?? []).filter(
    (s) =>
      s.tasks &&
      (s.review_status === "approved" ||
        s.review_status === null || // legacy reviewed
        !s.review_status)
  );

  // Fetch section names for submissions
  const sectionIds = Array.from(
    new Set(
      submissions.map((s) => s.tasks?.section_id).filter(Boolean) as string[]
    )
  );
  const sectionMap: Record<string, string> = {};
  if (sectionIds.length > 0) {
    const { data: sections } = await supabase
      .from("sections")
      .select("id, name")
      .in("id", sectionIds);
    (sections ?? []).forEach((s: { id: string; name: string }) => {
      sectionMap[s.id] = s.name;
    });
  }

  // Stats
  const totalCompleted = submissions.length;
  const scoredSubmissions = submissions.filter((s) => s.score);
  const avgScore =
    scoredSubmissions.length > 0
      ? scoredSubmissions.reduce((sum, s) => sum + (s.score ?? 0), 0) /
        scoredSubmissions.length
      : null;
  const uniqueMajors = Array.from(
    new Set(submissions.map((s) => s.tasks?.major).filter(Boolean))
  ) as string[];

  const { full_name, major, role } = fullProfile;
  const firstName = full_name?.split(" ")[0] ?? "Student";

  return (
    <main className="min-h-screen bg-slate-50 pb-24">

      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-700"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              G
            </div>
            GradFolio
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Join GradFolio
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 md:px-6">

        {/* Profile header */}
        <section className="mt-8 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">

            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-md">
              {getInitials(fullProfile.full_name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {fullProfile.full_name ?? "Student"}
                </h1>
                <MajorBadge major={fullProfile.major} />
              </div>

              {fullProfile.bio && (
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                  {fullProfile.bio}
                </p>
              )}

              {/* External links + Resume */}
              <div className="mt-4 flex flex-wrap gap-3">
                {fullProfile.linkedin_url && (
                  <a
                    href={fullProfile.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                    LinkedIn
                  </a>
                )}
                {fullProfile.github_url && (
                  <a
                    href={fullProfile.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                  </a>
                )}

                {/* Resume download — highlighted so employers notice it */}
                {hasResume && (
                  <a
                    href={resume_url!}
                    target="_blank"
                    rel="noreferrer"
                    download={resume_name ?? "resume.pdf"}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    Download Resume
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Tasks completed
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{totalCompleted}</p>
            </div>
            {avgScore !== null && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Avg score
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-3xl font-bold text-slate-900">
                    {avgScore.toFixed(1)}
                  </p>
                  <StarRating score={Math.round(avgScore)} />
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Fields covered
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uniqueMajors.length > 0 ? (
                  uniqueMajors.map((m) => <MajorBadge key={m} major={m} />)
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Completed work */}
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {firstName}&apos;s Completed Work
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
              {totalCompleted} {totalCompleted === 1 ? "task" : "tasks"}
            </span>
          </div>

          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-center">
              <div className="mb-4 text-5xl">📂</div>
              <h3 className="text-base font-semibold text-slate-700">
                No completed work yet
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {firstName} hasn&apos;t had any submissions reviewed yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => {
                const task = submission.tasks;
                if (!task) return null;
                const sectionName = task.section_id
                  ? sectionMap[task.section_id]
                  : null;

                return (
                  <div
                    key={submission.id}
                    className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <MajorBadge major={task.major} />
                          {sectionName && (
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                              📂 {sectionName}
                            </span>
                          )}
                          {submission.score && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                              <StarRating score={submission.score} />
                              <span>{submission.score}/5</span>
                            </span>
                          )}
                        </div>

                        {/* Task title */}
                        <h3 className="text-base font-semibold text-slate-900">
                          {task.title}
                        </h3>

                        {/* Reviewed date */}
                        {submission.reviewed_at && (
                          <p className="mt-1 text-xs text-slate-400">
                            Reviewed {formatDate(submission.reviewed_at)}
                          </p>
                        )}

                        {/* Feedback snippet */}
                        {submission.admin_feedback && (
                          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                              Reviewer Feedback
                            </p>
                            <p className="text-sm leading-6 text-emerald-900 line-clamp-3">
                              {submission.admin_feedback}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Approved badge */}
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Completed
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <section className="mt-10 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-8 text-center">
          <p className="text-sm font-semibold text-indigo-700">GradFolio</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">
            Build your own portfolio of real work
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Complete real tasks, get feedback, and create proof of skills that
            employers can actually see.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Get Started Free
          </Link>
        </section>

      </div>
    </main>
  );
}
