import Link from "next/link";
import { requireCompany } from "@/lib/auth";
import { getMajorNames } from "@/lib/majors-db";
import { createJobPost } from "@/actions/company-jobs";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Job | GradFolio" };

type SearchParams = Promise<{ error?: string }>;

type TaskOption = {
  id: string;
  title: string;
  major: string | null;
  task_source: string | null;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export default async function CompanyJobNewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, org } = await requireCompany();
  const { error } = await searchParams;

  const [majorNames, myTasksResp, platformTasksResp] = await Promise.all([
    getMajorNames(supabase),
    supabase
      .from("tasks")
      .select("id, title, major, task_source")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<TaskOption[]>(),
    supabase
      .from("tasks")
      .select("id, title, major, task_source")
      .is("org_id", null)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<TaskOption[]>(),
  ]);

  const companyTasks = myTasksResp.data ?? [];
  const platformTasks = platformTasksResp.data ?? [];

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
        <Link
          href="/company/jobs"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Back to Jobs
        </Link>

        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Company Workspace
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Post a new job
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Post internships or full-time roles. Optionally gate applications on a
              completed task — only students whose submission was approved (and meets
              your minimum score) can apply.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              ✗ {decodeURIComponent(error)}
            </div>
          )}

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
                <input id="deadline" name="deadline" type="date" className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="salary_text" className={labelClass}>
                Compensation{" "}
                <span className="font-normal text-slate-400">(optional)</span>
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
                Target majors{" "}
                <span className="font-normal text-slate-400">
                  (optional — leave empty for all)
                </span>
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

            <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
              <div>
                <p className="text-sm font-semibold text-indigo-900">
                  Gate on a task (optional)
                </p>
                <p className="mt-1 text-xs text-indigo-700">
                  Require applicants to have an approved submission for a specific task.
                  Pairs with a minimum score — if set, the submission must meet or exceed
                  it.
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
                    {companyTasks.length > 0 && (
                      <optgroup label="My company tasks">
                        {companyTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                            {t.major ? ` — ${t.major}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {platformTasks.length > 0 && (
                      <optgroup label="Platform tasks">
                        {platformTasks.map((t) => (
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
                    Minimum score{" "}
                    <span className="font-normal text-slate-400">(1–5, optional)</span>
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

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <Link
                href="/company/jobs"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Publish job
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
