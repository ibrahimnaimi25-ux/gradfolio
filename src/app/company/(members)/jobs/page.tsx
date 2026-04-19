import Link from "next/link";
import { requireCompany } from "@/lib/auth";
import Pagination from "@/components/pagination";
import {
  closeJobPost,
  deleteJobPost,
  reopenJobPost,
} from "@/actions/company-jobs";
import {
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

function decodeMessage(v: string | undefined) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

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

  const { supabase, org } = await requireCompany();

  let jobsQuery = supabase
    .from("job_posts")
    .select(
      "id, title, description, location, employment_type, required_task_id, min_score, salary_text, majors, status, deadline, created_at, closed_at"
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });
  if (statusFilter !== "all") jobsQuery = jobsQuery.eq("status", statusFilter);
  const { data: jobs } = await jobsQuery.returns<JobPostRow[]>();
  const allJobs = jobs ?? [];

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

  // Aggregate counts ignoring the current filter
  const { data: allMineRaw } = await supabase
    .from("job_posts")
    .select("id, status")
    .eq("org_id", org.id)
    .returns<{ id: string; status: string }[]>();
  const allMine = allMineRaw ?? [];
  const totalOpen = allMine.filter((j) => j.status === "open").length;
  const totalClosed = allMine.filter((j) => j.status === "closed").length;
  const totalApplicants = Object.values(applicantCounts).reduce((a, b) => a + b, 0);

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
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                Company Workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Job Postings
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Post internships or full-time roles. Optionally gate on completed tasks.
              </p>
            </div>
            <Link
              href="/company/jobs/new"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              + New Job
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Open</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{totalOpen}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Closed</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{totalClosed}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Applicants</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{totalApplicants}</p>
            </div>
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

        {/* Filters */}
        <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <label htmlFor="status" className="text-xs font-medium text-slate-500">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Apply
            </button>
            {statusFilter !== "all" && (
              <Link
                href="/company/jobs"
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        {/* List */}
        <section>
          {paged.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <div className="mb-3 text-4xl">💼</div>
              <h3 className="text-base font-semibold text-slate-700">
                {totalItems === 0 ? "No jobs yet" : "No jobs match this filter"}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {totalItems === 0
                  ? "Post your first job to start receiving applications."
                  : "Try clearing the filter or posting a new job."}
              </p>
              {totalItems === 0 && (
                <Link
                  href="/company/jobs/new"
                  className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  + Post your first job
                </Link>
              )}
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
                    className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {job.title}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls}`}
                          >
                            {job.status}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                            {EMPLOYMENT_TYPE_LABELS[
                              job.employment_type as EmploymentType
                            ] ?? job.employment_type}
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
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
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

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
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
