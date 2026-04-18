import { requireCompany } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logAudit } from "@/lib/audit";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Tasks | GradFolio" };

type SearchParams = Promise<{ success?: string; error?: string }>;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  major: string | null;
  status: string | null;
  submission_type: string | null;
  due_date: string | null;
  archived_at: string | null;
  created_at: string;
};

type SubmissionCount = { task_id: string; count: number };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";

function getDueDateInfo(dueDateStr: string | null) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (diffDays < 0) return { label: `Overdue · ${formatted}`, cls: "bg-rose-50 text-rose-700" };
  if (diffDays === 0) return { label: "Due today", cls: "bg-rose-50 text-rose-700" };
  if (diffDays <= 7) return { label: `Due in ${diffDays}d`, cls: "bg-amber-50 text-amber-700" };
  return { label: `Due ${formatted}`, cls: "bg-slate-100 text-slate-500" };
}

// ─── Server actions ───────────────────────────────────────────────────────────

async function createCompanyTask(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const major = String(formData.get("major") || "").trim() || null;
  const submissionType = String(formData.get("submission_type") || "any").trim();
  const dueDate = String(formData.get("due_date") || "").trim() || null;
  const status = String(formData.get("status") || "open").trim();

  if (!title) redirect("/company/tasks?error=Title+is+required");

  const { data: newTask, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description,
      major,
      submission_type: submissionType,
      due_date: dueDate,
      status,
      task_source: "company",
      company_id: user.id,
      created_by: user.id,
      assignment_type: "major",
    })
    .select("id")
    .maybeSingle();

  if (error) redirect(`/company/tasks?error=${encodeURIComponent(error.message)}`);

  await logAudit({
    userId: user.id,
    action: "company_task.created",
    entityType: "task",
    entityId: newTask?.id,
    metadata: { title },
  });

  revalidatePath("/company/tasks");
  revalidatePath("/tasks");
  redirect("/company/tasks?success=Task+created+successfully");
}

async function archiveCompanyTask(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/company/tasks?error=Missing+task+ID");

  const { data: task } = await supabase
    .from("tasks")
    .select("id, company_id, title")
    .eq("id", taskId)
    .maybeSingle<{ id: string; company_id: string | null; title: string }>();

  if (!task || task.company_id !== user.id) {
    redirect("/company/tasks?error=Task+not+found");
  }

  await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString(), status: "closed" })
    .eq("id", taskId)
    .eq("company_id", user.id);

  await logAudit({
    userId: user.id,
    action: "company_task.archived",
    entityType: "task",
    entityId: taskId,
    metadata: { title: task.title },
  });

  revalidatePath("/company/tasks");
  revalidatePath("/tasks");
  redirect("/company/tasks?success=Task+archived");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, user, profile } = await requireCompany();
  const { success, error } = await searchParams;

  // Fetch this company's tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, major, status, submission_type, due_date, archived_at, created_at")
    .eq("company_id", user.id)
    .eq("task_source", "company")
    .order("created_at", { ascending: false })
    .returns<TaskRow[]>();

  const taskList = tasks ?? [];

  // Submission counts per task
  const taskIds = taskList.map((t) => t.id);
  let submissionCounts: Record<string, number> = {};
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

  const activeTasks = taskList.filter((t) => !t.archived_at);
  const archivedTasks = taskList.filter((t) => t.archived_at);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 space-y-8">

        {/* Header */}
        <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Company Workspace</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">My Tasks</h1>
              <p className="mt-1 text-sm text-slate-500">
                Create challenges for students. Review their submissions and shortlist the best.
              </p>
            </div>
            <a
              href="#create-task"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              + New Task
            </a>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Active Tasks</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{activeTasks.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Submissions</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {Object.values(submissionCounts).reduce((a, b) => a + b, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Archived</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{archivedTasks.length}</p>
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

        {/* Active tasks */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Tasks ({activeTasks.length})
          </h2>
          {activeTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="text-base font-semibold text-slate-700">No tasks yet</h3>
              <p className="mt-1 text-sm text-slate-400">
                Create your first challenge below. Students in the matching major will see it.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTasks.map((task) => {
                const subCount = submissionCounts[task.id] ?? 0;
                const dueDateInfo = getDueDateInfo(task.due_date);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white px-5 py-4 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          task.status === "open"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {task.status ?? "open"}
                        </span>
                        {task.major && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                            {task.major}
                          </span>
                        )}
                        {dueDateInfo && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dueDateInfo.cls}`}>
                            {dueDateInfo.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {task.submission_type ?? "any"} submission
                        {subCount > 0 ? ` · ${subCount} submission${subCount !== 1 ? "s" : ""}` : " · no submissions yet"}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Create task form */}
        <section id="create-task" className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">Create New Task</h2>
          <p className="mb-5 text-xs text-slate-400">
            Students in the selected major will see this under &ldquo;Company Challenges&rdquo; on their Tasks page.
          </p>
          <form action={createCompanyTask} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Task Title <span className="text-rose-500">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                placeholder="e.g. Penetration Testing Brief"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description / Brief</label>
              <textarea
                name="description"
                rows={4}
                placeholder="Describe what you want students to do, what to submit, and what you are looking for…"
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Target Major</label>
                <input
                  name="major"
                  type="text"
                  placeholder="e.g. Cybersecurity"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Submission Type</label>
                <select name="submission_type" className={inputClass}>
                  <option value="any">Any</option>
                  <option value="text">Text</option>
                  <option value="link">Link</option>
                  <option value="file">File</option>
                  <option value="image">Image</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                <select name="status" className={inputClass}>
                  <option value="open">Open (visible to students)</option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Due Date <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input name="due_date" type="date" className={inputClass} />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Create Task
            </button>
          </form>
        </section>

        {/* Archived tasks */}
        {archivedTasks.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Archived ({archivedTasks.length})
            </h2>
            <div className="space-y-2">
              {archivedTasks.map((task) => {
                const subCount = submissionCounts[task.id] ?? 0;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/60 px-5 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-500 truncate">{task.title}</p>
                      <p className="text-xs text-slate-400">
                        {task.major ?? "All majors"} · {subCount} submission{subCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Link
                      href={`/company/tasks/${task.id}/submissions`}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      View Submissions
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
