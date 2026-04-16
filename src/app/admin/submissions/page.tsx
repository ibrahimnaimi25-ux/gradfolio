// ─── DB migration required before using review_status / score ─────────────────
// Run in your Supabase SQL editor:
//
//   ALTER TABLE submissions
//     ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending'
//       CHECK (review_status IN ('pending','approved','needs_revision','rejected')),
//     ADD COLUMN IF NOT EXISTS score integer CHECK (score BETWEEN 1 AND 5);
//
//   ALTER TABLE profiles
//     ADD COLUMN IF NOT EXISTS assigned_major text;
// ──────────────────────────────────────────────────────────────────────────────

// ─── Additional DB migrations ─────────────────────────────────────────────────
// ALTER TABLE submissions ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_majors text[];
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireStaff, getMajorFilter, getMajorLabel } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReviewedEmail } from "@/lib/email";
import SubmitButton from "@/components/submit-button";
import {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_CLASSES,
  REVIEW_STATUS_BORDER,
  SUBMISSION_TYPE_LABELS,
  TASK_STATUS_CLASSES,
} from "@/lib/constants";
import type { ReviewStatus } from "@/lib/constants";

export const metadata = { title: "Submission Review | GradFolio" };

// ─── Types ────────────────────────────────────────────────────────────────────

type SubmissionRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string | null;
  link_url: string | null;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  submitted_at: string | null;
  admin_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_status: string | null;
  score: number | null;
};

type TaskRow = {
  id: string;
  title: string;
  major: string | null;
  section_id: string | null;
  submission_type: string | null;
};

type SectionRow = { id: string; name: string };

type UserMap = Record<string, { full_name: string | null; major: string | null }>;

type SearchParams = Promise<{
  status?: string;
  q?: string;
  success?: string;
  error?: string;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(size: number | null) {
  if (!size || size <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) { value /= 1024; idx++; }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function isImageFile(fileType: string | null, fileUrl: string | null) {
  if (fileType?.startsWith("image/")) return true;
  const url = (fileUrl || "").toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((ext) => url.endsWith(ext));
}

function getUserName(userId: string, userMap: UserMap) {
  return userMap[userId]?.full_name?.trim() || `User ${userId.slice(0, 8)}`;
}

/** Determine the effective review status (handles legacy submissions without review_status). */
function getEffectiveStatus(s: SubmissionRow): ReviewStatus {
  if (s.review_status && ["approved", "needs_revision", "rejected"].includes(s.review_status)) {
    return s.review_status as ReviewStatus;
  }
  if (s.reviewed_at) return "approved"; // legacy: reviewed but no status set
  return "pending";
}

function decodeMessage(value: string | undefined) {
  if (!value) return null;
  try { return decodeURIComponent(value).replaceAll("-", " ").trim(); }
  catch { return value.replaceAll("-", " ").trim(); }
}

// ─── Server action: review a submission ───────────────────────────────────────

async function reviewSubmission(formData: FormData) {
  "use server";
  const { supabase, user, profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);

  const submissionId = String(formData.get("submission_id") || "").trim();
  const feedback = String(formData.get("admin_feedback") || "").trim();
  const reviewStatus = String(formData.get("review_status") || "approved").trim();
  const scoreRaw = formData.get("score");
  const score = scoreRaw ? parseInt(String(scoreRaw), 10) : null;

  if (!submissionId) redirect("/admin/submissions?error=missing-submission-id");

  // Managers: verify this submission belongs to a task in their major(s)
  if (majorFilter !== null) {
    const { data: sub } = await supabase
      .from("submissions")
      .select("task_id")
      .eq("id", submissionId)
      .maybeSingle<{ task_id: string }>();
    if (sub) {
      const { data: task } = await supabase
        .from("tasks")
        .select("major")
        .eq("id", sub.task_id)
        .maybeSingle<{ major: string | null }>();
      if (!task || !majorFilter.includes(task.major ?? "")) {
        redirect("/admin/submissions?error=access-denied");
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    admin_feedback: feedback || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
    review_status: reviewStatus,
  };
  if (score && score >= 1 && score <= 5) updatePayload.score = score;
  else updatePayload.score = null;

  // Fetch submission (user_id + task_id) before updating so we can email the student
  const { data: submissionForEmail } = await supabase
    .from("submissions")
    .select("user_id, task_id")
    .eq("id", submissionId)
    .maybeSingle<{ user_id: string; task_id: string }>();

  const { error } = await supabase
    .from("submissions")
    .update(updatePayload)
    .eq("id", submissionId);

  if (error) redirect(`/admin/submissions?error=${encodeURIComponent(error.message)}`);

  // Send "submission reviewed" email — best-effort, never blocks the review
  if (submissionForEmail) {
    try {
      const admin = createAdminClient();

      const [{ data: userData }, { data: taskData }, { data: profileData }] =
        await Promise.all([
          admin.auth.admin.getUserById(submissionForEmail.user_id),
          supabase
            .from("tasks")
            .select("title")
            .eq("id", submissionForEmail.task_id)
            .maybeSingle<{ title: string }>(),
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", submissionForEmail.user_id)
            .maybeSingle<{ full_name: string | null }>(),
        ]);

      const toEmail = userData?.user?.email;
      const taskTitle = taskData?.title ?? "your task";
      const studentName = profileData?.full_name ?? "there";

      if (toEmail) {
        await sendReviewedEmail({
          toEmail,
          studentName,
          taskTitle,
          taskId: submissionForEmail.task_id,
          reviewStatus,
          score: score && score >= 1 && score <= 5 ? score : null,
          feedback: feedback || null,
        });
      }
    } catch (emailErr) {
      console.error("[email] review notification failed:", emailErr);
    }
  }

  // Fire-and-forget audit log
  await logAudit({
    userId: user.id,
    action: "submission.reviewed",
    entityType: "submission",
    entityId: submissionId,
    metadata: { review_status: reviewStatus, score: score ?? undefined },
  });

  revalidatePath("/admin/submissions");
  revalidatePath("/admin/tasks");
  revalidatePath("/dashboard");
  redirect("/admin/submissions?success=review-saved");
}

// ─── Server action: bulk review ───────────────────────────────────────────────

async function bulkReview(formData: FormData) {
  "use server";
  const { supabase, user, profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const status = String(formData.get("bulk_status") || "approved").trim();

  if (!ids.length) redirect("/admin/submissions?error=no-submissions-selected");
  if (!["approved", "needs_revision", "rejected"].includes(status)) {
    redirect("/admin/submissions?error=invalid-status");
  }

  const updatePayload = {
    review_status: status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  };

  // If manager: filter IDs to only those belonging to their major(s)
  let allowedIds = ids;
  if (majorFilter !== null && majorFilter.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("id, task_id")
      .in("id", ids)
      .returns<{ id: string; task_id: string }[]>();
    if (subs && subs.length > 0) {
      const taskIds = subs.map((s) => s.task_id);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, major")
        .in("id", taskIds)
        .in("major", majorFilter)
        .returns<{ id: string; major: string | null }[]>();
      const allowedTaskIds = new Set((tasks ?? []).map((t) => t.id));
      allowedIds = subs.filter((s) => allowedTaskIds.has(s.task_id)).map((s) => s.id);
    } else {
      allowedIds = [];
    }
  }

  if (!allowedIds.length) redirect("/admin/submissions?error=no-allowed-submissions");

  const { error } = await supabase
    .from("submissions")
    .update(updatePayload)
    .in("id", allowedIds);

  if (error) redirect(`/admin/submissions?error=${encodeURIComponent(error.message)}`);

  // Fire-and-forget audit log
  await logAudit({
    userId: user.id,
    action: "submission.bulk_reviewed",
    entityType: "submission",
    metadata: { ids: allowedIds, review_status: status, count: allowedIds.length },
  });

  revalidatePath("/admin/submissions");
  revalidatePath("/dashboard");
  redirect(`/admin/submissions?success=${allowedIds.length}-submissions-updated`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "pending";
  const q = (params.q ?? "").toLowerCase().trim();
  const successMessage = decodeMessage(params.success);
  const errorMessage = decodeMessage(params.error);

  const { profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);
  const isManager = profile.role === "manager";
  const supabase = await createClient();

  // ── Fetch tasks (scoped by major for managers) ───────────────────────────────
  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, major, section_id, submission_type");
  if (majorFilter !== null && majorFilter.length > 0) tasksQuery = tasksQuery.in("major", majorFilter);
  const { data: tasksRaw } = await tasksQuery.returns<TaskRow[]>();

  const taskIds = (tasksRaw ?? []).map((t) => t.id);
  const taskMap = (tasksRaw ?? []).reduce<Record<string, TaskRow>>((acc, t) => {
    acc[t.id] = t;
    return acc;
  }, {});

  // ── Fetch submissions for those tasks ────────────────────────────────────────
  let submissionsRaw: SubmissionRow[] = [];
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("submissions")
      .select(
        "id, task_id, user_id, content, link_url, file_name, file_url, file_type, file_size, submitted_at, admin_feedback, reviewed_at, reviewed_by, review_status, score"
      )
      .in("task_id", taskIds)
      .order("submitted_at", { ascending: false })
      .returns<SubmissionRow[]>();
    submissionsRaw = data ?? [];
  } else if (majorFilter === null) {
    // Admin: get all submissions
    const { data } = await supabase
      .from("submissions")
      .select(
        "id, task_id, user_id, content, link_url, file_name, file_url, file_type, file_size, submitted_at, admin_feedback, reviewed_at, reviewed_by, review_status, score"
      )
      .order("submitted_at", { ascending: false })
      .returns<SubmissionRow[]>();
    submissionsRaw = data ?? [];
  }

  // ── Fetch sections for display ───────────────────────────────────────────────
  const sectionIds = Array.from(
    new Set((tasksRaw ?? []).map((t) => t.section_id).filter(Boolean) as string[])
  );
  const sectionMap: Record<string, SectionRow> = {};
  if (sectionIds.length > 0) {
    const { data: sections } = await supabase
      .from("sections")
      .select("id, name")
      .in("id", sectionIds)
      .returns<SectionRow[]>();
    (sections ?? []).forEach((s) => { sectionMap[s.id] = s; });
  }

  // ── Build user map ───────────────────────────────────────────────────────────
  const userIds = Array.from(
    new Set([
      ...submissionsRaw.map((s) => s.user_id),
      ...submissionsRaw.map((s) => s.reviewed_by).filter(Boolean) as string[],
    ])
  );
  let userMap: UserMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, major")
      .in("id", userIds)
      .returns<Array<{ id: string; full_name: string | null; major: string | null }>>();
    userMap = (profiles ?? []).reduce<UserMap>((acc, p) => {
      acc[p.id] = { full_name: p.full_name, major: p.major };
      return acc;
    }, {});
  }

  // ── Count by status ──────────────────────────────────────────────────────────
  const counts = submissionsRaw.reduce<Record<ReviewStatus, number>>(
    (acc, s) => { acc[getEffectiveStatus(s)]++; return acc; },
    { pending: 0, approved: 0, needs_revision: 0, rejected: 0 }
  );

  // ── Filter by status + search ────────────────────────────────────────────────
  const filtered = submissionsRaw
    .filter((s) => {
      const effective = getEffectiveStatus(s);
      const matchesStatus = statusFilter === "all" || effective === statusFilter;
      const task = taskMap[s.task_id];
      const studentName = getUserName(s.user_id, userMap).toLowerCase();
      const studentMajor = (userMap[s.user_id]?.major ?? "").toLowerCase();
      const matchesSearch =
        !q ||
        (task?.title ?? "").toLowerCase().includes(q) ||
        studentName.includes(q) ||
        studentMajor.includes(q) ||
        (s.content ?? "").toLowerCase().includes(q) ||
        (s.file_name ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      // Pending first, then newest
      const aPending = getEffectiveStatus(a) === "pending" ? 1 : 0;
      const bPending = getEffectiveStatus(b) === "pending" ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return (
        new Date(b.submitted_at ?? 0).getTime() -
        new Date(a.submitted_at ?? 0).getTime()
      );
    });

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-6">

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                {isManager ? `Manager — ${getMajorLabel(profile)}` : "Super Admin"}
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                Submission Review
              </h1>
              <p className="mt-3 text-base text-slate-500">
                {isManager
                  ? `Review student submissions for ${getMajorLabel(profile) || "your major"}.`
                  : "Review and provide feedback on all student submissions."}
              </p>
            </div>
            <Link
              href="/admin/tasks"
              className="shrink-0 self-start inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              ← Back to Tasks
            </Link>
          </div>

          {/* Status tab strip */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            {(
              [
                ["pending", "Pending"],
                ["approved", "Approved"],
                ["needs_revision", "Needs Revision"],
                ["rejected", "Rejected"],
                ["all", "All"],
              ] as [string, string][]
            ).map(([value, label]) => {
              const count = value === "all" ? submissionsRaw.length : counts[value as ReviewStatus];
              const isActive = statusFilter === value;
              return (
                <Link
                  key={value}
                  href={`/admin/submissions?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
        </section>

        {/* Alerts */}
        {(successMessage || errorMessage) && (
          <section className="mt-4 space-y-3">
            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                ✓ {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                ✗ {errorMessage}
              </div>
            )}
          </section>
        )}

        {/* Search bar */}
        <section className="mt-4">
          <form method="GET" className="flex gap-3">
            <input type="hidden" name="status" value={statusFilter} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by task, student, major, file…"
              className={`${inputClass} flex-1`}
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Search
            </button>
            {q && (
              <Link
                href={`/admin/submissions?status=${statusFilter}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        {/* Bulk actions + CSV export */}
        {filtered.length > 0 && (
          <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-700">
                Bulk Actions
                <span className="ml-2 text-xs text-slate-400">({filtered.length} shown)</span>
              </p>
              <Link
                href="/api/export/submissions"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                ↓ Export CSV
              </Link>
            </div>
            <form action={bulkReview} className="mt-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select
                  name="bulk_status"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="approved">✓ Approve selected</option>
                  <option value="needs_revision">↺ Needs Revision</option>
                  <option value="rejected">✗ Reject selected</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Apply to Selected
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
                {filtered.map((s) => {
                  const t = taskMap[s.task_id];
                  const student = getUserName(s.user_id, userMap);
                  return (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white transition">
                      <input type="checkbox" name="ids" value={s.id} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                      <span className="text-sm text-slate-700 truncate">
                        <span className="font-medium">{t?.title ?? "Unknown task"}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-slate-500">{student}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </form>
          </section>
        )}

        {/* Submission cards */}
        <section className="mt-6 space-y-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-center">
              <div className="mb-4 text-4xl">📭</div>
              <h3 className="text-base font-semibold text-slate-800">
                {q ? `No submissions match "${q}"` : `No ${statusFilter === "all" ? "" : statusFilter} submissions`}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {statusFilter === "pending" ? "All caught up!" : "Try a different filter."}
              </p>
            </div>
          ) : (
            filtered.map((submission) => {
              const task = taskMap[submission.task_id];
              const section = task?.section_id ? sectionMap[task.section_id] : null;
              const studentName = getUserName(submission.user_id, userMap);
              const studentMajor = userMap[submission.user_id]?.major;
              const reviewerName = submission.reviewed_by
                ? getUserName(submission.reviewed_by, userMap)
                : null;
              const effectiveStatus = getEffectiveStatus(submission);
              const borderClass = REVIEW_STATUS_BORDER[effectiveStatus];
              const statusClass = REVIEW_STATUS_CLASSES[effectiveStatus];
              const statusLabel = REVIEW_STATUS_LABELS[effectiveStatus];

              return (
                <div
                  key={submission.id}
                  className={`rounded-3xl border p-6 ${borderClass}`}
                >
                  {/* Card header */}
                  <div className="flex flex-wrap items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
                          {statusLabel}
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
                        {task?.submission_type && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {SUBMISSION_TYPE_LABELS[task.submission_type] ?? task.submission_type}
                          </span>
                        )}
                        {submission.score && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-yellow-200">
                            {"★".repeat(submission.score)} {submission.score}/5
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-slate-900">
                        {task?.title ?? "Unknown task"}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        <span className="font-medium text-slate-700">{studentName}</span>
                        {studentMajor && ` — ${studentMajor}`}
                        <span className="mx-2 text-slate-300">·</span>
                        Submitted {formatDate(submission.submitted_at)}
                      </p>
                    </div>

                    <Link
                      href={`/tasks/${submission.task_id}`}
                      target="_blank"
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      View task ↗
                    </Link>
                  </div>

                  {/* Submission content */}
                  <div className="space-y-4 mb-5">
                    {/* Text */}
                    {submission.content && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                          Text
                        </p>
                        <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 max-h-48 overflow-y-auto">
                          {submission.content}
                        </div>
                      </div>
                    )}

                    {/* Link */}
                    {submission.link_url && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                          Link
                        </p>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                          <a
                            href={submission.link_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:underline break-all"
                          >
                            {submission.link_url}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* File */}
                    {submission.file_url && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                          File
                        </p>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <a
                              href={submission.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                            >
                              Open / Download
                            </a>
                            <span className="text-xs text-slate-400">
                              {submission.file_name || "Uploaded file"}
                              {submission.file_size ? ` · ${formatFileSize(submission.file_size)}` : ""}
                            </span>
                          </div>
                          {isImageFile(submission.file_type, submission.file_url) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={submission.file_url}
                              alt={submission.file_name || "Submitted image"}
                              className="max-h-72 rounded-xl border border-slate-200 object-contain"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Nothing submitted */}
                    {!submission.content && !submission.link_url && !submission.file_url && (
                      <p className="text-sm text-slate-400 italic">No content submitted.</p>
                    )}
                  </div>

                  {/* Review form */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="mb-4 text-sm font-semibold text-slate-800">Review</p>
                    <form action={reviewSubmission} className="space-y-4">
                      <input type="hidden" name="submission_id" value={submission.id} />

                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Status selector */}
                        <div>
                          <label className="mb-2 block text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Decision
                          </label>
                          <select
                            name="review_status"
                            defaultValue={effectiveStatus === "pending" ? "approved" : effectiveStatus}
                            className={inputClass}
                          >
                            <option value="approved">✓ Approve</option>
                            <option value="needs_revision">↺ Needs Revision</option>
                            <option value="rejected">✗ Reject</option>
                          </select>
                        </div>

                        {/* Score */}
                        <div>
                          <label className="mb-2 block text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Score (optional)
                          </label>
                          <select
                            name="score"
                            defaultValue={submission.score?.toString() ?? ""}
                            className={inputClass}
                          >
                            <option value="">No score</option>
                            <option value="1">★ 1 / 5 — Poor</option>
                            <option value="2">★★ 2 / 5 — Below average</option>
                            <option value="3">★★★ 3 / 5 — Average</option>
                            <option value="4">★★★★ 4 / 5 — Good</option>
                            <option value="5">★★★★★ 5 / 5 — Excellent</option>
                          </select>
                        </div>
                      </div>

                      {/* Feedback */}
                      <div>
                        <label className="mb-2 block text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Feedback
                        </label>
                        <textarea
                          name="admin_feedback"
                          rows={4}
                          defaultValue={submission.admin_feedback ?? ""}
                          placeholder="Write feedback for the student…"
                          className={inputClass}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {effectiveStatus !== "pending" && (
                          <p className="text-xs text-slate-400">
                            Last reviewed: {formatDate(submission.reviewed_at)}
                            {reviewerName ? ` · by ${reviewerName}` : ""}
                          </p>
                        )}
                        <div className={effectiveStatus !== "pending" ? "" : "w-full sm:w-auto"}>
                          <SubmitButton
                            label="Save Review"
                            loadingLabel="Saving…"
                            className="w-full sm:w-auto"
                          />
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </section>

      </div>
    </main>
  );
}
