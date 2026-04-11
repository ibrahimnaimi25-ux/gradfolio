import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_CLASSES,
  REVIEW_STATUS_BORDER,
} from "@/lib/constants";
import type { ReviewStatus } from "@/lib/constants";

export const metadata = { title: "My Submissions | GradFolio" };

type SubmissionRow = {
  id: string;
  task_id: string;
  content: string | null;
  link_url: string | null;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  submitted_at: string | null;
  admin_feedback: string | null;
  reviewed_at: string | null;
  review_status: string | null;
  score: number | null;
};

type TaskRow = {
  id: string;
  title: string;
  major: string | null;
  section_id: string | null;
};

type SectionRow = { id: string; name: string };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value)
  );
}

function formatFileSize(size: number | null) {
  if (!size || size <= 0) return "";
  const units = ["B", "KB", "MB"];
  let v = size;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function getEffectiveStatus(s: SubmissionRow): ReviewStatus {
  if (
    s.review_status &&
    ["approved", "needs_revision", "rejected"].includes(s.review_status)
  ) {
    return s.review_status as ReviewStatus;
  }
  if (s.reviewed_at) return "approved";
  return "pending";
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, major")
    .eq("id", user.id)
    .maybeSingle<{ role: string; full_name: string | null; major: string | null }>();

  // Only students have a submission history page
  if (profile?.role && profile.role !== "student") redirect("/dashboard");

  // ── Fetch all submissions for this student ────────────────────────────────
  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select(
      "id, task_id, content, link_url, file_name, file_url, file_size, submitted_at, admin_feedback, reviewed_at, review_status, score"
    )
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .returns<SubmissionRow[]>();

  const submissions = submissionsRaw ?? [];

  // ── Fetch tasks for those submissions ────────────────────────────────────
  const taskIds = Array.from(new Set(submissions.map((s) => s.task_id)));
  let taskMap: Record<string, TaskRow> = {};
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, major, section_id")
      .in("id", taskIds)
      .returns<TaskRow[]>();
    taskMap = (tasks ?? []).reduce<Record<string, TaskRow>>((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});
  }

  // ── Fetch sections for display ────────────────────────────────────────────
  const sectionIds = Array.from(
    new Set(
      Object.values(taskMap)
        .map((t) => t.section_id)
        .filter(Boolean) as string[]
    )
  );
  let sectionMap: Record<string, SectionRow> = {};
  if (sectionIds.length > 0) {
    const { data: sections } = await supabase
      .from("sections")
      .select("id, name")
      .in("id", sectionIds)
      .returns<SectionRow[]>();
    sectionMap = (sections ?? []).reduce<Record<string, SectionRow>>((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {});
  }

  // ── Counts per status ─────────────────────────────────────────────────────
  const counts = submissions.reduce<Record<ReviewStatus, number>>(
    (acc, s) => { acc[getEffectiveStatus(s)]++; return acc; },
    { pending: 0, approved: 0, needs_revision: 0, rejected: 0 }
  );

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered =
    statusFilter === "all"
      ? submissions
      : submissions.filter((s) => getEffectiveStatus(s) === statusFilter);

  const tabs: [string, string][] = [
    ["all", "All"],
    ["pending", "Pending"],
    ["approved", "Approved"],
    ["needs_revision", "Needs Revision"],
    ["rejected", "Rejected"],
  ];

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto max-w-4xl px-4 md:px-6">

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
                My Work
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Submission History
              </h1>
              <p className="mt-2 text-slate-500">
                {submissions.length === 0
                  ? "You haven't submitted any work yet."
                  : `${submissions.length} submission${submissions.length === 1 ? "" : "s"} across ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}.`}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="self-start inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
          </div>

          {/* Summary stats */}
          {submissions.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
              {(
                [
                  ["approved", "✓ Approved", "text-emerald-700", "bg-emerald-50"],
                  ["pending", "⏳ Pending", "text-amber-700", "bg-amber-50"],
                  ["needs_revision", "↺ Revision", "text-sky-700", "bg-sky-50"],
                  ["rejected", "✗ Rejected", "text-rose-700", "bg-rose-50"],
                ] as [ReviewStatus, string, string, string][]
              ).map(([status, label, textCls, bgCls]) => (
                <Link
                  key={status}
                  href={`/submissions?status=${status}`}
                  className={`rounded-2xl ${bgCls} px-4 py-3 text-center transition hover:opacity-80`}
                >
                  <p className={`text-2xl font-bold ${textCls}`}>{counts[status]}</p>
                  <p className={`mt-0.5 text-xs font-medium ${textCls} opacity-80`}>{label}</p>
                </Link>
              ))}
            </div>
          )}

          {/* Status filter tabs */}
          {submissions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {tabs.map(([value, label]) => {
                const count =
                  value === "all" ? submissions.length : counts[value as ReviewStatus];
                const isActive = statusFilter === value;
                return (
                  <Link
                    key={value}
                    href={`/submissions?status=${value}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-white text-slate-700"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Submission list */}
        <section className="mt-5 space-y-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-center">
              <div className="mb-4 text-4xl">
                {submissions.length === 0 ? "📝" : "📭"}
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                {submissions.length === 0
                  ? "No submissions yet"
                  : `No ${statusFilter === "all" ? "" : statusFilter.replace("_", " ")} submissions`}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {submissions.length === 0
                  ? "Head to your tasks and start submitting work."
                  : "Try a different filter above."}
              </p>
              {submissions.length === 0 && (
                <Link
                  href="/tasks"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Browse Tasks
                </Link>
              )}
            </div>
          ) : (
            filtered.map((submission) => {
              const task = taskMap[submission.task_id];
              const section = task?.section_id ? sectionMap[task.section_id] : null;
              const effectiveStatus = getEffectiveStatus(submission);
              const borderCls = REVIEW_STATUS_BORDER[effectiveStatus];
              const badgeCls = REVIEW_STATUS_CLASSES[effectiveStatus];
              const badgeLabel = REVIEW_STATUS_LABELS[effectiveStatus];

              return (
                <div
                  key={submission.id}
                  className={`rounded-3xl border p-6 ${borderCls}`}
                >
                  {/* Card header */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeCls}`}
                        >
                          {badgeLabel}
                        </span>
                        {task?.major && (
                          <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                            {task.major}
                          </span>
                        )}
                        {section && (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                            📂 {section.name}
                          </span>
                        )}
                        {submission.score && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-yellow-200">
                            {"★".repeat(submission.score)} {submission.score}/5
                          </span>
                        )}
                      </div>

                      <h2 className="text-base font-semibold text-slate-900">
                        {task?.title ?? "Unknown task"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Submitted {formatDate(submission.submitted_at)}
                        {submission.reviewed_at && (
                          <> · Reviewed {formatDate(submission.reviewed_at)}</>
                        )}
                      </p>
                    </div>

                    <Link
                      href={`/tasks/${submission.task_id}`}
                      className="shrink-0 self-start inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      View task ↗
                    </Link>
                  </div>

                  {/* Submitted content preview */}
                  <div className="mt-4 space-y-3">
                    {submission.content && (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                          Text
                        </p>
                        <p className="line-clamp-3 text-sm leading-6 text-slate-600 whitespace-pre-wrap">
                          {submission.content}
                        </p>
                      </div>
                    )}

                    {submission.link_url && (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                          Link
                        </p>
                        <a
                          href={submission.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline break-all"
                        >
                          {submission.link_url}
                        </a>
                      </div>
                    )}

                    {submission.file_url && (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {submission.file_name ?? "Uploaded file"}
                          </p>
                          {submission.file_size ? (
                            <p className="text-xs text-slate-400">{formatFileSize(submission.file_size)}</p>
                          ) : null}
                        </div>
                        <a
                          href={submission.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Open ↗
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Feedback block — only shown if reviewed */}
                  {submission.admin_feedback && (
                    <div
                      className={`mt-4 rounded-2xl border p-4 ${
                        effectiveStatus === "approved"
                          ? "border-emerald-200 bg-emerald-50"
                          : effectiveStatus === "needs_revision"
                          ? "border-sky-200 bg-sky-50"
                          : effectiveStatus === "rejected"
                          ? "border-rose-200 bg-rose-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p
                        className={`mb-2 text-xs font-semibold uppercase tracking-widest ${
                          effectiveStatus === "approved"
                            ? "text-emerald-700"
                            : effectiveStatus === "needs_revision"
                            ? "text-sky-700"
                            : effectiveStatus === "rejected"
                            ? "text-rose-700"
                            : "text-slate-500"
                        }`}
                      >
                        Admin Feedback
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {submission.admin_feedback}
                      </p>
                    </div>
                  )}

                  {/* Pending — no feedback yet */}
                  {effectiveStatus === "pending" && (
                    <p className="mt-4 text-xs text-slate-400 italic">
                      Awaiting review — you'll see feedback here once an admin reviews your work.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </section>

      </div>
    </main>
  );
}
