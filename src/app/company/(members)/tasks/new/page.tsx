import Link from "next/link";
import { requireCompany } from "@/lib/auth";
import { getMajorNames } from "@/lib/majors-db";
import { createCompanyTask } from "@/actions/company-tasks";
import TaskFormFields from "@/components/company/TaskFormFields";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Task | GradFolio" };

type SearchParams = Promise<{ error?: string; major?: string }>;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export default async function CompanyTaskNewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requireCompany();
  const { error, major: majorParam } = await searchParams;

  const [majors, sectionsResp] = await Promise.all([
    getMajorNames(supabase),
    supabase
      .from("sections")
      .select("id, name, major")
      .order("major", { ascending: true })
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .returns<{ id: string; name: string; major: string }[]>(),
  ]);
  const sections = sectionsResp.data ?? [];

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
        <Link
          href="/company/tasks"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Back to My Tasks
        </Link>

        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Company Workspace
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Create a new task
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Write a brief, pick the major and section, and publish. Students in the
              matching major will see it on their Tasks page.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              ✗ {decodeURIComponent(error)}
            </div>
          )}

          <form action={createCompanyTask} className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>
                Task Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                placeholder="e.g. Penetration Testing Brief"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                Description / Brief
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                placeholder="Describe what students should do, what to submit, and what you&rsquo;re looking for."
                className={`${inputClass} resize-none`}
              />
            </div>

            <TaskFormFields
              majors={majors}
              sections={sections}
              defaultMajor={majorParam ?? null}
            />

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <Link
                href="/company/tasks"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Publish task
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
