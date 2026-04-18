import { requireCompany } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logAudit } from "@/lib/audit";
import { getMajorNames } from "@/lib/majors-db";
import Pagination from "@/components/pagination";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  JOB_POST_STATUS_CLASSES,
  type EmploymentType,
  type JobPostStatus,
} from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Jobs | GradFolio" };

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  success?: string;
  error?: string;
  page?: string;
  status?: string;
}>;

type JobPostRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string;
  required_task_id: string | null;
  min_score: number | null;
  salary_text: string | null;
  majors: string[] | null;
  status: string;
  deadline: string | null;
  created_at: string;
  closed_at: string | null;
};

type TaskOption = {
  id: string;
  title: string;
  major: string | null;
  task_source: string | null;
};

type ApplicantCount = { job_id: string; total: number };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

function decodeMessage(v: string | undefined) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

// ─── Server actions ───────────────────────────────────────────────────────────

async function createJobPost(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const location = String(formData.get("location") || "").trim() || null;
  const employmentType = String(formData.get("employment_type") || "internship").trim();
  const requiredTaskId = String(formData.get("required_task_id") || "").trim() || null;
  const minScoreRaw = String(formData.get("min_score") || "").trim();
  const minScore = minScoreRaw ? Math.max(1, Math.min(5, parseInt(minScoreRaw, 10))) : null;
  const salaryText = String(formData.get("salary_text") || "").trim() || null;
  const majorsRaw = formData.getAll("majors").map((v) => String(v)).filter(Boolean);
  const deadline = String(formData.get("deadline") || "").trim() || null;

  if (!title) redirect("/company/jobs?error=Title+is+required");
  if (!EMPLOYMENT_TYPES.includes(employmentType as EmploymentType)) {
    redirect("/company/jobs?error=Invalid+employment+type");
  }

  const { data: newJob, error } = await supabase
    .from("job_posts")
    .insert({
      company_id: user.id,
      title,
      description,
      location,
      employment_type: employmentType,
      required_task_id: requiredTaskId,
      min_score: minScore,
      salary_text: salaryText,
      majors: majorsRaw.length > 0 ? majorsRaw : [],
      status: "open",
      deadline,
    })
    .select("id")
    .maybeSingle();

  if (error) redirect(`/company/jobs?error=${encodeURIComponent(error.message)}`);

  await logAudit({
    userId: user.id,
    action: "job_post.created",
    entityType: "job_post",
    entityId: newJob?.id,
    metadata: { title },
  });

  revalidatePath("/company/jobs");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+created");
}

async function closeJobPost(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();
  const jobId = String(formData.get("job_id") || "").trim();
  if (!jobId) redirect("/company/jobs?error=Missing+job+id");

  const { error } = await supabase
    .from("job_posts")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("company_id", user.id);

  if (error) redirect(`/company/jobs?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/company/jobs");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+closed");
}

async function reopenJobPost(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();
  const jobId = String(formData.get("job_id") || "").trim();
  if (!jobId) redirect("/company/jobs?error=Missing+job+id");

  const { error } = await supabase
    .from("job_posts")
    .update({ status: "open", closed_at: null })
    .eq("id", jobId)
    .eq("company_id", user.id);

  if (error) redirect(`/company/jobs?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/company/jobs");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+reopened");
}

async function deleteJobPost(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();
  const jobId = String(formData.get("job_id") || "").trim();
  if (!jobId) redirect("/company/jobs?error=Missing+job+id");

  const { error } = await supabase
    .from("job_posts")
    .delete()
    .eq("id", jobId)
    .eq("company_id", user.id);

  if (error) redirect(`/company/jobs?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/company/jobs");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+deleted");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyJobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const statusFilter = params.status ?? "all";
  const success = decodeMessage(params.success);
  const error = decodeMessage(params.error);

  const { supabase, user, profile } = await requireCompany();

  // Fetch jobs owned by this company
  let jobsQuery = supabase
    .from("job_posts")
    .select(
      "id, title, description, location, employment_type, required_task_id, min_score, salary_text, majors, status, deadline, created_at, closed_at"
    )
    .eq("company_id", user.id)
    .order("created_at", { ascending: false });
  if (statusFilter !== "all") jobsQuery = jobsQuery.eq("status", statusFilter);
  const { data: jobs } = await jobsQuery.returns<JobPostRow[]>();
  const allJobs = jobs ?? [];

  // Applicant counts per job (one round-trip)
  const applicantCounts: Record<string, number> = {};
  if (allJobs.length > 0) {
    const { data } = await supabase
      .from("job_applications")
      .select("job_id")
      .in(
        "job_id",
        allJobs.map((j) => j.id)
      )
      .neq("status", "withdrawn")
      .returns<{ job_id: string }[]>();
    for (const row of data ?? []) {
      applicantCounts[row.job_id] = (applicantCounts[row.job_id] ?? 0) + 1;
    }
  }

  // Tasks this company can gate on: their own company tasks + platform tasks
  // (platform = company_id is null). Keep the list tight to avoid a huge dropdown.
  const { data: companyTasks } = await supabase
    .from("tasks")
    .select("id, title, major, task_source")
    .eq("company_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<TaskOption[]>();

  const { data: platformTasks } = await supabase
    .from("tasks")
    .select("id, title, major, task_source")
    .is("company_id", null)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<TaskOption[]>();

  const majorNames = await getMajorNames(supabase);

  // Pagination
  const totalItems = allJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = allJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function buildPageHref(page: number) {
    const p = new URLSearchParams();
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/company/jobs${s ? `?${s}` : ""}`;
  }

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-6 space-y-6">
        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                {profile.company_name ?? "Company"} — Jobs
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Job Postings
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Post internships or full-time roles and gate them on a task students must have
                completed. Only students who meet your score threshold can apply.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#create-job"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                + New Job
              </a>
              <Link
                href="/company/tasks"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                My Tasks
              </Link>
            </div>
          </div>
        </section>

        {/* Alerts */}
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

        {/* Create form */}
        <section
          id="create-job"
          className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm"
        >
          <div className="mb-6 border-b border-slate-100 pb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Create a job post</h2>
            <p className="mt-1 text-sm text-slate-500">
              Optionally gate applications on a completed task — only students whose submission was
              approved (and meets your minimum score) can apply.
            </p>
          </div>

          <form action={createJobPost} className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                placeholder="e.g. Summer Data Analyst Intern"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                placeholder="Role responsibilities, requirements, what the student will learn…"
                className={inputClass}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="employment_type" className={labelClass}>
                  Type
                </label>
                <select
                  id="employment_type"
                  name="employment_type"
                  defaultValue="internship"
                  className={inputClass}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EMPLOYMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="location" className={labelClass}>
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  placeholder="Remote, Dubai, Hybrid…"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="deadline" className={labelClass}>
                  Application deadline{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="deadline"
                  name="deadline"
                  type="date"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="salary_text" className={labelClass}>
                Compensation <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="salary_text"
                name="salary_text"
                type="text"
                placeholder="e.g. $25/hr or AED 5,000/month"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Target majors <span className="font-normal text-slate-400">(optional — leave empty for all)</span>
              </label>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 md:grid-cols-3">
                {majorNames.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-white"
                  >
                    <input type="checkbox" name="majors" value={m} className="rounded" />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-indigo-900">Gate on a task (optional)</p>
                <p className="mt-1 text-xs text-indigo-700">
                  Require applicants to have an approved submission for a specific task. Pairs with
                  a minimum score — if set, the submission must meet or exceed it.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="required_task_id" className={labelClass}>
                    Required task
                  </label>
                  <select
                    id="required_task_id"
                    name="required_task_id"
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="">No task required (any student can apply)</option>
                    {(companyTasks ?? []).length > 0 && (
                      <optgroup label="My company tasks">
                        {(companyTasks ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                            {t.major ? ` — ${t.major}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {(platformTasks ?? []).length > 0 && (
                      <optgroup label="Platform tasks">
                        {(platformTasks ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                            {t.major ? ` — ${t.major}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="min_score" className={labelClass}>
                    Minimum score <span className="font-normal text-slate-400">(1–5, optional)</span>
                  </label>
                  <select
                    id="min_score"
                    name="min_score"
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="">No minimum</option>
                    <option value="3">★★★☆☆ 3+</option>
                    <option value="4">★★★★☆ 4+</option>
                    <option value="5">★★★★★ 5</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Publish job
              </button>
            </div>
          </form>
        </section>

        {/* List */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Your jobs</h2>
              <p className="mt-1 text-sm text-slate-500">
                {totalItems} {totalItems === 1 ? "posting" : "postings"}
              </p>
            </div>
            <form method="GET" className="flex items-center gap-2">
              <label htmlFor="status" className="text-xs font-medium text-slate-500">
                Filter:
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusFilter}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Apply
              </button>
            </form>
          </div>

          {paged.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No jobs yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Create your first posting in the form above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paged.map((job) => {
                const applicants = applicantCounts[job.id] ?? 0;
                const statusCls =
                  JOB_POST_STATUS_CLASSES[job.status as JobPostStatus] ??
                  "bg-slate-100 text-slate-600";
                return (
                  <div
                    key={job.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls}`}
                          >
                            {job.status}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                            {EMPLOYMENT_TYPE_LABELS[job.employment_type as EmploymentType] ??
                              job.employment_type}
                          </span>
                          {job.location && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              📍 {job.location}
                            </span>
                          )}
                          {job.required_task_id && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                              🔒 Gated
                              {job.min_score ? ` · ${job.min_score}+ / 5` : ""}
                            </span>
                          )}
                        </div>
                        {job.description && (
                          <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                            {job.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>
                            Created{" "}
                            {new Date(job.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {job.deadline && (
                            <span>
                              Deadline{" "}
                              {new Date(job.deadline).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Link
                          href={`/company/jobs/${job.id}/applicants`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          {applicants} {applicants === 1 ? "applicant" : "applicants"} →
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                      <Link
                        href={`/company/jobs/${job.id}/edit`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      {job.status === "open" ? (
                        <form action={closeJobPost}>
                          <input type="hidden" name="job_id" value={job.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Close
                          </button>
                        </form>
                      ) : (
                        <form action={reopenJobPost}>
                          <input type="hidden" name="job_id" value={job.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            Reopen
                          </button>
                        </form>
                      )}
                      <form action={deleteJobPost}>
                        <input type="hidden" name="job_id" value={job.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </form>
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
                itemLabel={totalItems === 1 ? "job" : "jobs"}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
