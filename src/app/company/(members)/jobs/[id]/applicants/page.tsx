import { requireCompany } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Pagination from "@/components/pagination";
import {
  JOB_APP_STATUSES,
  JOB_APP_STATUS_LABELS,
  JOB_APP_STATUS_CLASSES,
  EMPLOYMENT_TYPE_LABELS,
  type JobAppStatus,
  type EmploymentType,
} from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Applicants | GradFolio" };

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  page?: string;
  status?: string;
  success?: string;
  error?: string;
}>;

type JobPostRow = {
  id: string;
  org_id: string | null;
  title: string;
  employment_type: string;
  location: string | null;
  required_task_id: string | null;
  min_score: number | null;
  status: string;
};

type ApplicationRow = {
  id: string;
  user_id: string;
  qualifying_submission_id: string | null;
  cover_note: string | null;
  status: string;
  applied_at: string;
  updated_at: string;
};

type SubmissionRow = {
  id: string;
  content: string | null;
  link_url: string | null;
  file_name: string | null;
  file_url: string | null;
  score: number | null;
  review_status: string | null;
  submitted_at: string | null;
  admin_feedback: string | null;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  major: string | null;
  headline: string | null;
  avatar_url: string | null;
  resume_url: string | null;
};

function decodeMessage(v: string | undefined) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

// ─── Server action ────────────────────────────────────────────────────────────

async function updateApplicationStatus(formData: FormData) {
  "use server";
  const { supabase, org } = await requireCompany();

  const applicationId = String(formData.get("application_id") || "").trim();
  const newStatus = String(formData.get("status") || "").trim();
  const jobId = String(formData.get("job_id") || "").trim();

  if (!applicationId || !newStatus) {
    redirect(`/company/jobs/${jobId}/applicants?error=Missing+fields`);
  }

  if (!JOB_APP_STATUSES.includes(newStatus as JobAppStatus)) {
    redirect(`/company/jobs/${jobId}/applicants?error=Invalid+status`);
  }

  // Verify the application belongs to a job owned by this company
  const { data: appRow } = await supabase
    .from("job_applications")
    .select("id, job_id, job_posts!inner(org_id)")
    .eq("id", applicationId)
    .maybeSingle<{ id: string; job_id: string; job_posts: { org_id: string | null } }>();

  if (!appRow || appRow.job_posts.org_id !== org.id) {
    redirect(`/company/jobs/${jobId}/applicants?error=Access+denied`);
  }

  // Look up the applicant + job title so we can notify them
  const { data: appDetails } = await supabase
    .from("job_applications")
    .select("user_id, job_id, job_posts!inner(title)")
    .eq("id", applicationId)
    .maybeSingle<{ user_id: string; job_id: string; job_posts: { title: string } }>();

  const { error } = await supabase
    .from("job_applications")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (error) {
    redirect(`/company/jobs/${jobId}/applicants?error=${encodeURIComponent(error.message)}`);
  }

  // Notify the student — only for status transitions they care about
  if (appDetails && ["viewed", "shortlisted", "rejected", "hired"].includes(newStatus)) {
    const { createNotification } = await import("@/lib/notifications");
    const statusText =
      newStatus === "viewed"
        ? "Your application was viewed"
        : newStatus === "shortlisted"
        ? "You've been shortlisted 🎉"
        : newStatus === "hired"
        ? "You've been hired! 🎉"
        : "Your application wasn't successful this time";
    await createNotification(supabase, {
      userId: appDetails.user_id,
      type: "application_status",
      title: statusText,
      body: `For the role: ${appDetails.job_posts.title}`,
      link: `/jobs/${appDetails.job_id}`,
    });
  }

  revalidatePath(`/company/jobs/${jobId}/applicants`);
  redirect(`/company/jobs/${jobId}/applicants?success=Status+updated`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id: jobId } = await params;
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const statusFilter = sp.status ?? "all";
  const success = decodeMessage(sp.success);
  const error = decodeMessage(sp.error);

  const { supabase, org } = await requireCompany();

  // Fetch job + verify ownership
  const { data: job } = await supabase
    .from("job_posts")
    .select("id, org_id, title, employment_type, location, required_task_id, min_score, status")
    .eq("id", jobId)
    .eq("org_id", org.id)
    .maybeSingle<JobPostRow>();

  if (!job) notFound();

  // Applications
  let appsQuery = supabase
    .from("job_applications")
    .select(
      "id, user_id, qualifying_submission_id, cover_note, status, applied_at, updated_at"
    )
    .eq("job_id", jobId)
    .order("applied_at", { ascending: false });
  if (statusFilter !== "all") appsQuery = appsQuery.eq("status", statusFilter);
  const { data: appsData } = await appsQuery.returns<ApplicationRow[]>();
  const applications = appsData ?? [];

  // Bulk fetch students + qualifying submissions
  const userIds = Array.from(new Set(applications.map((a) => a.user_id)));
  const submissionIds = applications
    .map((a) => a.qualifying_submission_id)
    .filter((x): x is string => !!x);

  const [studentsRes, submissionsRes] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, major, headline, avatar_url, resume_url")
          .in("id", userIds)
          .returns<StudentRow[]>()
      : Promise.resolve({ data: [] as StudentRow[] }),
    submissionIds.length > 0
      ? supabase
          .from("submissions")
          .select(
            "id, content, link_url, file_name, file_url, score, review_status, submitted_at, admin_feedback"
          )
          .in("id", submissionIds)
          .returns<SubmissionRow[]>()
      : Promise.resolve({ data: [] as SubmissionRow[] }),
  ]);

  const studentMap: Record<string, StudentRow> = {};
  for (const s of studentsRes.data ?? []) studentMap[s.id] = s;
  const submissionMap: Record<string, SubmissionRow> = {};
  for (const s of submissionsRes.data ?? []) submissionMap[s.id] = s;

  // Status counts (unfiltered)
  const { data: allApps } = await supabase
    .from("job_applications")
    .select("status")
    .eq("job_id", jobId)
    .returns<{ status: string }[]>();
  const statusCounts: Record<string, number> = {};
  for (const a of allApps ?? []) {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  }
  const totalAll = (allApps ?? []).length;

  // Pagination
  const totalItems = applications.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = applications.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function buildPageHref(page: number) {
    const p = new URLSearchParams();
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/company/jobs/${jobId}/applicants${s ? `?${s}` : ""}`;
  }

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-6 space-y-6">
        <Link
          href="/company/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          ← All jobs
        </Link>

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Applicants
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
              {EMPLOYMENT_TYPE_LABELS[job.employment_type as EmploymentType] ?? job.employment_type}
            </span>
            {job.location && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                📍 {job.location}
              </span>
            )}
            {job.required_task_id && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                🔒 Gated{job.min_score ? ` · ${job.min_score}+/5` : ""}
              </span>
            )}
          </div>

          {/* Status tabs */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            {(
              [
                ["all", "All"],
                ["submitted", "New"],
                ["viewed", "Viewed"],
                ["shortlisted", "Shortlisted"],
                ["rejected", "Rejected"],
                ["hired", "Hired"],
              ] as const
            ).map(([value, label]) => {
              const count = value === "all" ? totalAll : statusCounts[value] ?? 0;
              const active = statusFilter === value;
              return (
                <Link
                  key={value}
                  href={`/company/jobs/${jobId}/applicants${value === "all" ? "" : `?status=${value}`}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {(success || error) && (
          <div className="space-y-3">
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                ✓ {success}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                ✗ {error}
              </div>
            )}
          </div>
        )}

        {/* List */}
        {paged.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-4xl">📭</p>
            <p className="mt-3 text-base font-semibold text-slate-800">No applicants yet</p>
            <p className="mt-1 text-sm text-slate-500">
              {statusFilter === "all"
                ? "Students who qualify and apply will show up here."
                : "No applicants in this status."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paged.map((app) => {
              const student = studentMap[app.user_id];
              const submission = app.qualifying_submission_id
                ? submissionMap[app.qualifying_submission_id]
                : null;
              const statusCls =
                JOB_APP_STATUS_CLASSES[app.status as JobAppStatus] ??
                "bg-slate-100 text-slate-600";
              const statusLabel =
                JOB_APP_STATUS_LABELS[app.status as JobAppStatus] ?? app.status;

              return (
                <div
                  key={app.id}
                  className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Student info */}
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      {student?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={student.avatar_url}
                          alt={student.full_name ?? "Student"}
                          className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-bold text-indigo-700">
                          {(student?.full_name ?? "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {student?.full_name ?? "Unknown student"}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        {student?.headline && (
                          <p className="mt-0.5 text-xs text-slate-500">{student.headline}</p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          {student?.major && (
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
                              {student.major}
                            </span>
                          )}
                          <span>
                            Applied{" "}
                            {new Date(app.applied_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Score badge */}
                    {submission && submission.score != null && (
                      <div className="rounded-xl bg-amber-50 px-3 py-2 text-center ring-1 ring-amber-200">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                          Score
                        </p>
                        <p className="text-lg font-bold text-amber-800">
                          {"★".repeat(submission.score)}
                          {"☆".repeat(5 - submission.score)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Cover note */}
                  {app.cover_note && (
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Cover note
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {app.cover_note}
                      </p>
                    </div>
                  )}

                  {/* Qualifying submission */}
                  {submission && submission.id !== "__no_gate__" && (
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                        Qualifying submission
                      </p>
                      {submission.content && (
                        <p className="mt-1.5 text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">
                          {submission.content}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {submission.link_url && (
                          <a
                            href={submission.link_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                          >
                            🔗 Link
                          </a>
                        )}
                        {submission.file_url && (
                          <a
                            href={submission.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                          >
                            📎 {submission.file_name ?? "File"}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <Link
                      href={`/students/${app.user_id}`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      View portfolio
                    </Link>
                    {student?.resume_url && (
                      <a
                        href={student.resume_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        📄 Resume
                      </a>
                    )}

                    <div className="ml-auto flex flex-wrap gap-1.5">
                      {(["viewed", "shortlisted", "rejected", "hired"] as const).map((s) => (
                        <form key={s} action={updateApplicationStatus}>
                          <input type="hidden" name="application_id" value={app.id} />
                          <input type="hidden" name="job_id" value={jobId} />
                          <input type="hidden" name="status" value={s} />
                          <button
                            type="submit"
                            disabled={app.status === s}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              s === "hired"
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : s === "rejected"
                                  ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : s === "shortlisted"
                                    ? "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {JOB_APP_STATUS_LABELS[s]}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              buildHref={buildPageHref}
              itemLabel={totalItems === 1 ? "applicant" : "applicants"}
            />
          </div>
        )}
      </div>
    </main>
  );
}
