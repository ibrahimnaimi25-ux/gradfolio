import { requireCompany } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logAudit } from "@/lib/audit";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Submission Review | GradFolio" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ success?: string; error?: string }>;

const REVIEW_STATUSES = [
  { value: "reviewing", label: "Reviewing", cls: "bg-sky-50 text-sky-700" },
  { value: "shortlisted", label: "Shortlisted ⭐", cls: "bg-amber-50 text-amber-700" },
  { value: "hired", label: "Hired 🎉", cls: "bg-emerald-50 text-emerald-700" },
  { value: "rejected", label: "Rejected", cls: "bg-slate-100 text-slate-500" },
] as const;

type CompanyReview = {
  id: string;
  submission_id: string;
  status: string | null;
  feedback: string | null;
  score: number | null;
  reviewed_at: string;
};

type SubmissionRow = {
  id: string;
  user_id: string;
  content: string | null;
  link_url: string | null;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  submitted_at: string | null;
  version: number | null;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  major: string | null;
  avatar_url: string | null;
  open_to_opportunities: boolean | null;
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Server action ────────────────────────────────────────────────────────────

async function saveCompanyReview(formData: FormData) {
  "use server";
  const { supabase, user, org } = await requireCompany();

  const submissionId = String(formData.get("submission_id") || "").trim();
  const taskId = String(formData.get("task_id") || "").trim();
  const status = String(formData.get("status") || "reviewing").trim();
  const feedback = String(formData.get("feedback") || "").trim() || null;
  const scoreRaw = formData.get("score");
  const score = scoreRaw ? parseInt(String(scoreRaw), 10) : null;

  if (!submissionId || !taskId) redirect(`/company/tasks/${taskId}/submissions?error=Missing+data`);

  // Verify company owns this task before writing review
  const { data: task } = await supabase
    .from("tasks")
    .select("id, org_id")
    .eq("id", taskId)
    .eq("org_id", org.id)
    .maybeSingle<{ id: string; org_id: string | null }>();

  if (!task) redirect(`/company/tasks/${taskId}/submissions?error=Access+denied`);

  const { error } = await supabase
    .from("company_submission_reviews")
    .upsert(
      {
        submission_id: submissionId,
        company_user_id: user.id,
        status,
        feedback,
        score: score && score >= 1 && score <= 5 ? score : null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "submission_id,company_user_id" }
    );

  if (error) redirect(`/company/tasks/${taskId}/submissions?error=${encodeURIComponent(error.message)}`);

  await logAudit({
    userId: user.id,
    action: "company_submission.reviewed",
    entityType: "submission",
    entityId: submissionId,
    metadata: { status, score, taskId },
  });

  revalidatePath(`/company/tasks/${taskId}/submissions`);
  redirect(`/company/tasks/${taskId}/submissions?success=Review+saved`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanySubmissionsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id: taskId } = await params;
  const { success, error } = await searchParams;
  const { supabase, user, profile, org } = await requireCompany();

  // Fetch task and verify ownership
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, major, submission_type, status, archived_at")
    .eq("id", taskId)
    .eq("org_id", org.id)
    .eq("task_source", "company")
    .maybeSingle<{
      id: string;
      title: string;
      description: string | null;
      major: string | null;
      submission_type: string | null;
      status: string | null;
      archived_at: string | null;
    }>();

  if (!task) redirect("/company/tasks?error=Task+not+found");

  // Fetch submissions for this task
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, user_id, content, link_url, file_name, file_url, file_type, submitted_at, version")
    .eq("task_id", taskId)
    .order("submitted_at", { ascending: false })
    .returns<SubmissionRow[]>();

  const submissionList = submissions ?? [];
  const studentIds = [...new Set(submissionList.map((s) => s.user_id))];

  // Fetch student profiles
  let studentMap: Record<string, StudentProfile> = {};
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, major, avatar_url, open_to_opportunities")
      .in("id", studentIds)
      .returns<StudentProfile[]>();
    studentMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  // Fetch existing company reviews for these submissions
  let reviewMap: Record<string, CompanyReview> = {};
  if (submissionList.length > 0) {
    const submissionIds = submissionList.map((s) => s.id);
    const { data: reviews } = await supabase
      .from("company_submission_reviews")
      .select("id, submission_id, status, feedback, score, reviewed_at")
      .eq("company_user_id", user.id)
      .in("submission_id", submissionIds)
      .returns<CompanyReview[]>();
    reviewMap = Object.fromEntries((reviews ?? []).map((r) => [r.submission_id, r]));
  }

  const reviewedCount = Object.keys(reviewMap).length;
  const shortlistedCount = Object.values(reviewMap).filter((r) => r.status === "shortlisted" || r.status === "hired").length;

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 space-y-6">

        {/* Back */}
        <Link
          href="/company/tasks"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Back to My Tasks
        </Link>

        {/* Header */}
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Submission Review</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">{task.title}</h1>
              {task.major && (
                <p className="mt-1 text-sm text-slate-500">{task.major}</p>
              )}
            </div>
            <Link
              href={`/company/tasks/${taskId}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Edit Task
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-5">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Submissions</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{submissionList.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Reviewed</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{reviewedCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Shortlisted</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{shortlistedCount}</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ {decodeURIComponent(success)}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            ✗ {decodeURIComponent(error)}
          </div>
        )}

        {/* Submissions list */}
        {submissionList.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <h3 className="text-base font-semibold text-slate-700">No submissions yet</h3>
            <p className="mt-1 text-sm text-slate-400">
              Students in {task.major ? `the ${task.major} major` : "the matching major"} haven&apos;t submitted yet.
              Make sure the task status is &ldquo;Open&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissionList.map((sub) => {
              const student = studentMap[sub.user_id];
              const existingReview = reviewMap[sub.id];
              const statusInfo = REVIEW_STATUSES.find((s) => s.value === existingReview?.status);

              return (
                <div
                  key={sub.id}
                  className={`rounded-3xl border bg-white shadow-sm overflow-hidden ${
                    existingReview?.status === "shortlisted"
                      ? "border-amber-200"
                      : existingReview?.status === "hired"
                      ? "border-emerald-200"
                      : "border-black/5"
                  }`}
                >
                  {/* Student header */}
                  <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
                    {student?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={student.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                        {getInitials(student?.full_name ?? null)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {student?.full_name ?? "Student"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {student?.major ?? ""}
                        {sub.version && sub.version > 1 ? ` · v${sub.version}` : ""}
                        {" · "}
                        {relativeTime(sub.submitted_at)}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      {existingReview && statusInfo && (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      )}
                      {student?.open_to_opportunities && (
                        <Link
                          href={`/students/${sub.user_id}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          View Profile →
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Submission content */}
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Submission</p>
                    {sub.content && (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6">
                        {sub.content}
                      </p>
                    )}
                    {sub.link_url && (
                      <a
                        href={sub.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 break-all transition-colors"
                      >
                        {sub.link_url}
                      </a>
                    )}
                    {sub.file_url && sub.file_name && (
                      <a
                        href={sub.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        📎 {sub.file_name}
                      </a>
                    )}
                    {!sub.content && !sub.link_url && !sub.file_url && (
                      <p className="text-sm text-slate-400 italic">No content provided</p>
                    )}
                  </div>

                  {/* Company review form */}
                  <div className="px-6 py-4 bg-slate-50/50">
                    <p className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Your Review</p>
                    <form action={saveCompanyReview} className="space-y-3">
                      <input type="hidden" name="submission_id" value={sub.id} />
                      <input type="hidden" name="task_id" value={taskId} />

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                          <select
                            name="status"
                            defaultValue={existingReview?.status ?? "reviewing"}
                            className={inputClass}
                          >
                            {REVIEW_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Score <span className="text-slate-400 font-normal">(1–5, optional)</span>
                          </label>
                          <select
                            name="score"
                            defaultValue={existingReview?.score?.toString() ?? ""}
                            className={inputClass}
                          >
                            <option value="">No score</option>
                            <option value="1">1 ★</option>
                            <option value="2">2 ★★</option>
                            <option value="3">3 ★★★</option>
                            <option value="4">4 ★★★★</option>
                            <option value="5">5 ★★★★★</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Internal Notes <span className="text-slate-400 font-normal">(not shown to student)</span>
                        </label>
                        <textarea
                          name="feedback"
                          rows={2}
                          defaultValue={existingReview?.feedback ?? ""}
                          placeholder="Your notes about this candidate…"
                          className={`${inputClass} resize-none`}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          {existingReview ? "Update Review" : "Save Review"}
                        </button>
                        {existingReview && (
                          <p className="text-xs text-slate-400">
                            Last updated {relativeTime(existingReview.reviewed_at)}
                          </p>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
