import Link from "next/link";
import { requireCompany } from "@/lib/auth";
import { getMajorNames } from "@/lib/majors-db";
import { archiveCompanyTask } from "@/actions/company-tasks";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Tasks | GradFolio" };

type SearchParams = Promise<{
  success?: string;
  error?: string;
  major?: string;
  status?: string;
  q?: string;
}>;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  major: string | null;
  section_id: string | null;
  status: string | null;
  submission_type: string | null;
  due_date: string | null;
  archived_at: string | null;
  created_at: string;
};

type SectionRow = { id: string; name: string; major: string };

function getDueDateInfo(dueDateStr: string | null) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const formatted = due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (diffDays < 0)
    return { label: `Overdue · ${formatted}`, cls: "bg-rose-50 text-rose-700" };
  if (diffDays === 0) return { label: "Due today", cls: "bg-rose-50 text-rose-700" };
  if (diffDays <= 7)
    return { label: `Due in ${diffDays}d`, cls: "bg-amber-50 text-amber-700" };
  return { label: `Due ${formatted}`, cls: "bg-slate-100 text-slate-500" };
}

export default async function CompanyTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user } = await requireCompany();
  const params = await searchParams;
  const success = params.success ? decodeURIComponent(params.success) : null;
  const error = params.error ? decodeURIComponent(params.error) : null;
  const majorFilter = params.major ?? "all";
  const statusFilter = params.status ?? "active";
  const search = (params.q ?? "").trim();

  // Fetch this company's tasks
  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, major, section_id, status, submission_type, due_date, archived_at, created_at"
    )
    .eq("company_id", user.id)
    .eq("task_source", "company")
    .order("created_at", { ascending: false });

  if (majorFilter !== "all") query = query.eq("major", majorFilter);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data: allTasks } = await query.returns<TaskRow[]>();
  const raw = allTasks ?? [];

  // Apply status filter client-side (archived is a date column)
  const filtered = raw.filter((t) => {
    if (statusFilter === "active") return !t.archived_at;
    if (statusFilter === "archived") return !!t.archived_at;
    if (statusFilter === "open") return !t.archived_at && t.status === "open";
    if (statusFilter === "draft") return !t.archived_at && t.status === "draft";
    if (statusFilter === "closed") return t.status === "closed";
    return true;
  });

  // Submission counts
  const taskIds = filtered.map((t) => t.id);
  const submissionCounts: Record<string, number> = {};
  if (taskIds.length > 0) {
    const { data: counts } = await supabase
      .from("submissions")
      .select("task_id")
      .in("task_id", taskIds)
      .returns<{ task_id: string }[]>();
    for (const row of counts ?? []) {
      submissionCounts[row.task_id] = (submissionCounts[row.task_id] ?? 0) + 1;
    }
  }

  // Section name lookup
  const sectionIds = Array.from(
    new Set(filtered.map((t) => t.section_id).filter((x): x is string => !!x))
  );
  let sectionMap: Record<string, SectionRow> = {};
  if (sectionIds.length > 0) {
    const { data: secs } = await supabase
      .from("sections")
      .select("id, name, major")
      .in("id", sectionIds)
      .returns<SectionRow[]>();
    sectionMap = Object.fromEntries((secs ?? []).map((s) => [s.id, s]));
  }

  // Aggregate counts for the header (unfiltered by status/major)
  const { data: allMineRaw } = await supabase
    .from("tasks")
    .select("id, archived_at")
    .eq("company_id", user.id)
    .eq("task_source", "company")
    .returns<{ id: string; archived_at: string | null }[]>();
  const allMine = allMineRaw ?? [];
  const totalActive = allMine.filter((t) => !t.archived_at).length;
  const totalArchived = allMine.filter((t) => t.archived_at).length;
  const { data: allSubs } = await supabase
    .from("submissions")
    .select("id")
    .in("task_id", allMine.map((t) => t.id))
    .returns<{ id: string }[]>();
  const totalSubmissions = (allSubs ?? []).length;

  const majors = await getMajorNames(supabase);

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
                My Tasks
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Create challenges for students and review their work.
              </p>
            </div>
            <Link
              href="/company/tasks/new"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              + New Task
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Active</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{totalActive}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Submissions</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{totalSubmissions}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Archived</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{totalArchived}</p>
            </div>
          </div>
        </section>

        {/* Alerts */}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            ✗ {error}
          </div>
        )}

        {/* Filters */}
        <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-500">
                Search
              </label>
              <input
                id="q"
                name="q"
                type="text"
                defaultValue={search}
                placeholder="Task title…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="major" className="mb-1 block text-xs font-medium text-slate-500">
                Major
              </label>
              <select
                id="major"
                name="major"
                defaultValue={majorFilter}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All majors</option>
                {majors.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate-500">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusFilter}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="open">Open only</option>
                <option value="draft">Draft only</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Apply
            </button>
            {(majorFilter !== "all" || statusFilter !== "active" || search) && (
              <Link
                href="/company/tasks"
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Clear
              </Link>
            )}
          </form>
        </section>

        {/* Task list */}
        <section>
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <div className="mb-3 text-4xl">📋</div>
              <h3 className="text-base font-semibold text-slate-700">
                {raw.length === 0 ? "No tasks yet" : "No tasks match these filters"}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {raw.length === 0
                  ? "Create your first task to start receiving student submissions."
                  : "Try clearing filters or creating a new task."}
              </p>
              {raw.length === 0 && (
                <Link
                  href="/company/tasks/new"
                  className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  + Create your first task
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((task) => {
                const subCount = submissionCounts[task.id] ?? 0;
                const dueDateInfo = getDueDateInfo(task.due_date);
                const section = task.section_id ? sectionMap[task.section_id] : null;
                const archived = !!task.archived_at;
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-4 rounded-2xl border px-5 py-4 shadow-sm ${
                      archived
                        ? "border-slate-100 bg-white/60"
                        : "border-black/5 bg-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            archived ? "text-slate-500" : "text-slate-900"
                          }`}
                        >
                          {task.title}
                        </p>
                        {archived ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            archived
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              task.status === "open"
                                ? "bg-emerald-50 text-emerald-700"
                                : task.status === "draft"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {task.status ?? "open"}
                          </span>
                        )}
                        {task.major && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                            {task.major}
                          </span>
                        )}
                        {section && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
                            {section.name}
                          </span>
                        )}
                        {dueDateInfo && !archived && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${dueDateInfo.cls}`}
                          >
                            {dueDateInfo.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {task.submission_type ?? "any"} submission
                        {subCount > 0
                          ? ` · ${subCount} submission${subCount !== 1 ? "s" : ""}`
                          : " · no submissions yet"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/company/tasks/${task.id}/submissions`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {subCount > 0 ? `Review (${subCount})` : "Submissions"}
                      </Link>
                      <Link
                        href={`/company/tasks/${task.id}`}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                      >
                        Edit
                      </Link>
                      {!archived && (
                        <form action={archiveCompanyTask}>
                          <input type="hidden" name="task_id" value={task.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                            title="Archive this task"
                          >
                            Archive
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
