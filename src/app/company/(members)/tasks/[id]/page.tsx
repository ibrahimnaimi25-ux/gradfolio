import Link from "next/link";
import { requireOwnedTask } from "@/lib/auth";
import { getMajorNames } from "@/lib/majors-db";
import {
  archiveCompanyTask,
  restoreCompanyTask,
  updateCompanyTask,
} from "@/actions/company-tasks";
import TaskFormFields from "@/components/company/TaskFormFields";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Task | GradFolio" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ success?: string; error?: string }>;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export default async function CompanyTaskEditPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { success, error } = await searchParams;

  const { supabase, task } = await requireOwnedTask(id);

  const [majors, sectionsResp, countResp] = await Promise.all([
    getMajorNames(supabase),
    supabase
      .from("sections")
      .select("id, name, major")
      .order("major", { ascending: true })
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .returns<{ id: string; name: string; major: string }[]>(),
    supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id),
  ]);
  const sections = sectionsResp.data ?? [];
  const subCount = countResp.count ?? 0;

  const isArchived = !!task.archived_at;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
        <Link
          href="/company/tasks"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Back to My Tasks
        </Link>

        {/* Header */}
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                Company Task
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">{task.title}</h1>
              <p className="mt-1 text-xs text-slate-400">
                Created{" "}
                {new Date(task.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {task.major ? ` · ${task.major}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isArchived ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  Archived
                </span>
              ) : (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    task.status === "open"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {task.status ?? "open"}
                </span>
              )}
              <Link
                href={`/company/tasks/${id}/submissions`}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                View Submissions ({subCount})
              </Link>
            </div>
          </div>
        </div>

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

        {/* Edit form */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Edit Task
          </h2>
          <form action={updateCompanyTask} className="space-y-5">
            <input type="hidden" name="task_id" value={task.id} />
            <div>
              <label htmlFor="title" className={labelClass}>
                Task Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={task.title}
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
                defaultValue={task.description ?? ""}
                className={`${inputClass} resize-none`}
              />
            </div>

            <TaskFormFields
              majors={majors}
              sections={sections}
              defaultMajor={task.major}
              defaultSectionId={task.section_id}
              defaultSubmissionType={task.submission_type}
              defaultStatus={task.status}
              defaultDueDate={task.due_date}
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
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </section>

        {/* Archive / Restore */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">
            {isArchived ? "Restore Task" : "Archive Task"}
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            {isArchived
              ? "Restoring this task will make it visible to students again."
              : "Archiving hides this task from students. Submissions are preserved. You cannot permanently delete tasks."}
          </p>
          {isArchived ? (
            <form action={restoreCompanyTask}>
              <input type="hidden" name="task_id" value={task.id} />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Restore Task
              </button>
            </form>
          ) : (
            <form action={archiveCompanyTask}>
              <input type="hidden" name="task_id" value={task.id} />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Archive Task
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
