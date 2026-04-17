import { requireCompany } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logAudit } from "@/lib/audit";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Task | GradFolio" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ success?: string; error?: string }>;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";

// ─── Server actions ───────────────────────────────────────────────────────────

async function updateCompanyTask(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();

  const taskId = String(formData.get("task_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const major = String(formData.get("major") || "").trim() || null;
  const submissionType = String(formData.get("submission_type") || "any").trim();
  const dueDate = String(formData.get("due_date") || "").trim() || null;
  const status = String(formData.get("status") || "open").trim();

  if (!taskId) redirect("/company/tasks?error=Missing+task+ID");
  if (!title) redirect(`/company/tasks/${taskId}?error=Title+is+required`);

  // Ownership check — only update if company_id matches
  const { error } = await supabase
    .from("tasks")
    .update({ title, description, major, submission_type: submissionType, due_date: dueDate, status })
    .eq("id", taskId)
    .eq("company_id", user.id)
    .eq("task_source", "company");

  if (error) redirect(`/company/tasks/${taskId}?error=${encodeURIComponent(error.message)}`);

  await logAudit({
    userId: user.id,
    action: "company_task.updated",
    entityType: "task",
    entityId: taskId,
    metadata: { title },
  });

  revalidatePath(`/company/tasks/${taskId}`);
  revalidatePath("/company/tasks");
  revalidatePath("/tasks");
  redirect(`/company/tasks/${taskId}?success=Task+updated`);
}

async function archiveCompanyTask(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/company/tasks?error=Missing+task+ID");

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
  });

  revalidatePath("/company/tasks");
  revalidatePath("/tasks");
  redirect("/company/tasks?success=Task+archived");
}

async function restoreCompanyTask(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/company/tasks?error=Missing+task+ID");

  await supabase
    .from("tasks")
    .update({ archived_at: null, status: "open" })
    .eq("id", taskId)
    .eq("company_id", user.id);

  revalidatePath("/company/tasks");
  revalidatePath("/tasks");
  redirect(`/company/tasks/${taskId}?success=Task+restored`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyTaskEditPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { success, error } = await searchParams;
  const { supabase, user } = await requireCompany();

  // Fetch task and verify ownership
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, major, status, submission_type, due_date, archived_at, created_at")
    .eq("id", id)
    .eq("company_id", user.id)
    .eq("task_source", "company")
    .maybeSingle<{
      id: string;
      title: string;
      description: string | null;
      major: string | null;
      status: string | null;
      submission_type: string | null;
      due_date: string | null;
      archived_at: string | null;
      created_at: string;
    }>();

  if (!task) redirect("/company/tasks?error=Task+not+found");

  // Submission count for this task
  const { count: subCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("task_id", id);

  const isArchived = !!task.archived_at;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 space-y-6">

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
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Company Task</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">{task.title}</h1>
              <p className="mt-1 text-xs text-slate-400">
                Created {new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {task.major ? ` · ${task.major}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isArchived ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  Archived
                </span>
              ) : (
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  task.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {task.status ?? "open"}
                </span>
              )}
              <Link
                href={`/company/tasks/${id}/submissions`}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                View Submissions ({subCount ?? 0})
              </Link>
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

        {/* Edit form */}
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Edit Task</h2>
          <form action={updateCompanyTask} className="space-y-4">
            <input type="hidden" name="task_id" value={task.id} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Task Title <span className="text-rose-500">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                defaultValue={task.title}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description / Brief</label>
              <textarea
                name="description"
                rows={5}
                defaultValue={task.description ?? ""}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Target Major</label>
                <input
                  name="major"
                  type="text"
                  defaultValue={task.major ?? ""}
                  placeholder="e.g. Cybersecurity"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Submission Type</label>
                <select name="submission_type" defaultValue={task.submission_type ?? "any"} className={inputClass}>
                  <option value="any">Any</option>
                  <option value="text">Text</option>
                  <option value="link">Link</option>
                  <option value="file">File</option>
                  <option value="image">Image</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                <select name="status" defaultValue={task.status ?? "open"} className={inputClass}>
                  <option value="open">Open</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Due Date</label>
                <input
                  name="due_date"
                  type="date"
                  defaultValue={task.due_date ?? ""}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
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
