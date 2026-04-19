import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { findQualifyingSubmissionsForJobs, type JobPostRow } from "@/lib/jobs";
import Pagination from "@/components/pagination";
import {
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
} from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Browse Jobs | GradFolio" };

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  page?: string;
  filter?: string;
  type?: string;
}>;

type CompanyRow = {
  id: string;
  name: string | null;
  industry: string | null;
};

type TaskRow = {
  id: string;
  title: string;
};

type ApplicationRow = {
  job_id: string;
  status: string;
};

export default async function JobsBrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const filter = params.filter ?? "all"; // all | qualified
  const typeFilter = params.type ?? "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get viewer's profile (may be guest)
  let viewerMajor: string | null = null;
  let viewerRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, major")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null; major: string | null }>();
    viewerMajor = profile?.major ?? null;
    viewerRole = profile?.role ?? null;
  }

  // Fetch all open jobs
  let query = supabase
    .from("job_posts")
    .select(
      "id, org_id, title, description, location, employment_type, required_task_id, min_score, salary_text, majors, status, deadline, created_at, closed_at"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (typeFilter !== "all") query = query.eq("employment_type", typeFilter);
  const { data: jobsData } = await query.returns<JobPostRow[]>();
  let jobs = jobsData ?? [];

  // Filter by student's major client-side (empty majors[] = all majors welcome)
  if (viewerRole === "student" && viewerMajor) {
    jobs = jobs.filter(
      (j) => !j.majors || j.majors.length === 0 || j.majors.includes(viewerMajor!)
    );
  }

  // Fetch companies for these jobs
  const orgIds = Array.from(
    new Set(jobs.map((j) => j.org_id).filter((v): v is string => !!v))
  );
  const companiesById: Record<string, CompanyRow> = {};
  if (orgIds.length > 0) {
    const { data: companies } = await supabase
      .from("organizations")
      .select("id, name, industry")
      .in("id", orgIds)
      .returns<CompanyRow[]>();
    for (const c of companies ?? []) companiesById[c.id] = c;
  }

  // Fetch task titles for gated jobs
  const taskIds = Array.from(
    new Set(jobs.map((j) => j.required_task_id).filter((v): v is string => !!v))
  );
  const tasksById: Record<string, TaskRow> = {};
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title")
      .in("id", taskIds)
      .returns<TaskRow[]>();
    for (const t of tasks ?? []) tasksById[t.id] = t;
  }

  // Qualification check + existing applications (only for logged-in students)
  const qualificationByJob: Record<string, { id: string } | null> = {};
  const applicationsByJob: Record<string, string> = {};
  if (user && viewerRole === "student") {
    const q = await findQualifyingSubmissionsForJobs(supabase, user.id, jobs);
    for (const [k, v] of Object.entries(q)) qualificationByJob[k] = v;

    if (jobs.length > 0) {
      const { data: apps } = await supabase
        .from("job_applications")
        .select("job_id, status")
        .eq("user_id", user.id)
        .in(
          "job_id",
          jobs.map((j) => j.id)
        )
        .returns<ApplicationRow[]>();
      for (const a of apps ?? []) applicationsByJob[a.job_id] = a.status;
    }
  }

  // Optional filter: only show qualified jobs
  if (filter === "qualified" && user && viewerRole === "student") {
    jobs = jobs.filter((j) => qualificationByJob[j.id]);
  }

  // Pagination
  const totalItems = jobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = jobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function buildPageHref(page: number) {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/jobs${s ? `?${s}` : ""}`;
  }

  const isStudent = !!user && viewerRole === "student";

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-6 space-y-6">
        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            Opportunities
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Browse Jobs & Internships
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Real roles from real companies, matched to the skills you&apos;ve proven through
            GradFolio tasks. Some roles unlock only after you submit approved work — that&apos;s the
            point.
          </p>

          {!user && (
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Sign in to apply
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Create an account
              </Link>
            </div>
          )}
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            {isStudent && (
              <div>
                <label htmlFor="filter" className="mb-1.5 block text-xs font-medium text-slate-500">
                  Show
                </label>
                <select
                  id="filter"
                  name="filter"
                  defaultValue={filter}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">All jobs</option>
                  <option value="qualified">Only jobs I qualify for</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor="type" className="mb-1.5 block text-xs font-medium text-slate-500">
                Type
              </label>
              <select
                id="type"
                name="type"
                defaultValue={typeFilter}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All types</option>
                <option value="internship">Internship</option>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Apply filters
            </button>
          </form>
        </section>

        {/* Results */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-end justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {totalItems} {totalItems === 1 ? "role" : "roles"}
              </h2>
              {isStudent && viewerMajor && (
                <p className="mt-1 text-xs text-slate-500">
                  Filtered for your major: <span className="font-medium">{viewerMajor}</span>
                </p>
              )}
            </div>
          </div>

          {paged.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No jobs match your filters</p>
              <p className="mt-1 text-xs text-slate-400">
                Check back soon — companies are adding new roles every week.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paged.map((job) => {
                const company = job.org_id ? companiesById[job.org_id] : undefined;
                const requiredTask = job.required_task_id
                  ? tasksById[job.required_task_id]
                  : null;
                const qualifies = isStudent ? !!qualificationByJob[job.id] : null;
                const appliedStatus = applicationsByJob[job.id];
                const daysLeft = job.deadline
                  ? Math.ceil(
                      (new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    )
                  : null;

                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="block rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                            {EMPLOYMENT_TYPE_LABELS[job.employment_type as EmploymentType] ??
                              job.employment_type}
                          </span>
                          {job.location && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              📍 {job.location}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-600">
                          {company?.name ?? "Company"}
                          {company?.industry ? ` · ${company.industry}` : ""}
                        </p>
                        {job.description && (
                          <p className="mt-3 text-sm text-slate-600 line-clamp-2">
                            {job.description}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {job.salary_text && <span>💵 {job.salary_text}</span>}
                          {daysLeft !== null && daysLeft >= 0 && (
                            <span>
                              ⏱ {daysLeft === 0 ? "Closes today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                            </span>
                          )}
                          {job.majors && job.majors.length > 0 && (
                            <span>🎓 {job.majors.slice(0, 3).join(", ")}{job.majors.length > 3 ? "…" : ""}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {appliedStatus ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            ✓ Applied
                          </span>
                        ) : isStudent ? (
                          qualifies ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              ✓ Qualified
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                              🔒 Locked
                            </span>
                          )
                        ) : null}
                        {requiredTask && (
                          <span className="max-w-[200px] truncate text-right text-xs text-slate-500">
                            Requires: {requiredTask.title}
                            {job.min_score ? ` (${job.min_score}+/5)` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}

              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                buildHref={buildPageHref}
                itemLabel={totalItems === 1 ? "role" : "roles"}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
