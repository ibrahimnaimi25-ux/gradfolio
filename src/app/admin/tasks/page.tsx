import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, getMajorFilter, getMajorLabel } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { MajorSectionSelect } from "@/components/admin/MajorSectionSelect";
import { getMajorNames } from "@/lib/majors-db";
import { TASK_STATUS_CLASSES, SUBMISSION_TYPE_LABELS } from "@/lib/constants";
import type { SubmissionType } from "@/lib/constants";

type SearchParams = Promise<{
  q?: string;
  taskStatus?: string;
  success?: string;
  error?: string;
}>;

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "student" | "manager" | "admin";
  major: string | null;
  assigned_major: string | null;
};

type SectionRow = {
  id: string;
  name: string;
  major: string;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  major: string | null;
  role: "student" | "admin" | "manager";
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  major: string | null;
  status: string | null;
  assignment_type: string | null;
  submission_type: SubmissionType | null;
  assigned_user_id: string | null;
  section_id: string | null;
  created_at: string;
  due_date: string | null;
  order_index: number | null;
};

type UserMap = Record<string, { full_name: string | null; major: string | null }>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getTaskStatusClasses(status: string | null): string {
  return TASK_STATUS_CLASSES[(status || "").toLowerCase()] ?? "bg-slate-100 text-slate-600";
}

function getSubmissionTypeLabel(type: SubmissionType | null): string {
  return SUBMISSION_TYPE_LABELS[type ?? "any"] ?? "Any type";
}

function getUserDisplayName(
  userId: string,
  userMap: UserMap,
  fallbackPrefix = "User"
) {
  const profile = userMap[userId];
  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;
  return `${fallbackPrefix} ${userId.slice(0, 8)}`;
}

function getDueDateInfo(dueDateStr: string | null) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (diffDays < 0) return { label: `Overdue · ${formatted}`, cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" };
  if (diffDays === 0) return { label: "Due today!", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" };
  if (diffDays === 1) return { label: "Due tomorrow", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" };
  if (diffDays <= 7) return { label: `Due in ${diffDays} days`, cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" };
  return { label: `Due ${formatted}`, cls: "bg-slate-100 text-slate-500" };
}

function decodeMessage(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).replaceAll("-", " ").trim();
  } catch {
    return value.replaceAll("-", " ").trim();
  }
}

// ─── Server actions ───────────────────────────────────────────────────────────

async function createTask(formData: FormData) {
  "use server";
  const { supabase, user, profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "open").trim();
  const assignmentType = String(formData.get("assignment_type") || "major").trim();
  const submissionType = String(formData.get("submission_type") || "any").trim() as SubmissionType;
  const major = String(formData.get("major") || "").trim();
  const assignedUserId = String(formData.get("assigned_user_id") || "").trim();
  const sectionId = String(formData.get("section_id") || "").trim() || null;
  const dueDate = String(formData.get("due_date") || "").trim() || null;

  if (!title) redirect("/admin/tasks?error=missing-title#create-task");
  if (assignmentType === "major" && !major)
    redirect("/admin/tasks?error=select-a-major#create-task");
  if (assignmentType === "direct" && !assignedUserId)
    redirect("/admin/tasks?error=select-a-student#create-task");
  if (!sectionId) redirect("/admin/tasks?error=select-a-section#create-task");

  // Managers can only create tasks for their assigned major(s)
  if (majorFilter !== null && major && !majorFilter.includes(major)) {
    redirect("/admin/tasks?error=major-not-allowed#create-task");
  }

  const payload = {
    title,
    description: description || null,
    status: status || "open",
    assignment_type: assignmentType === "direct" ? "direct" : "major",
    submission_type: submissionType || "any",
    major: assignmentType === "major" ? (major || null) : null,
    assigned_user_id: assignmentType === "direct" ? (assignedUserId || null) : null,
    created_by: user.id,
    section_id: sectionId,
    due_date: dueDate,
  };

  const { data: newTask, error } = await supabase.from("tasks").insert(payload).select("id").maybeSingle();
  if (error) redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}`);
  await logAudit({ userId: user.id, action: "task.created", entityType: "task", entityId: newTask?.id, metadata: { title } });
  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (sectionId) revalidatePath(`/tasks/sections/${sectionId}`);
  redirect("/admin/tasks?success=task-created#create-task");
}

async function updateTask(formData: FormData) {
  "use server";
  const { supabase, profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);

  const taskId = String(formData.get("task_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "open").trim();
  const assignmentType = String(formData.get("assignment_type") || "major").trim();
  const submissionType = String(formData.get("submission_type") || "any").trim() as SubmissionType;
  const major = String(formData.get("major") || "").trim();
  const assignedUserId = String(formData.get("assigned_user_id") || "").trim();
  const sectionId = String(formData.get("section_id") || "").trim() || null;
  const dueDate = String(formData.get("due_date") || "").trim() || null;

  if (!taskId) redirect("/admin/tasks?error=missing-task-id#manage-tasks");
  if (!title) redirect("/admin/tasks?error=title-required#manage-tasks");
  if (assignmentType === "major" && !major)
    redirect("/admin/tasks?error=select-a-major#manage-tasks");
  if (assignmentType === "direct" && !assignedUserId)
    redirect("/admin/tasks?error=select-a-student#manage-tasks");

  // Managers can only update tasks for their assigned major(s)
  if (majorFilter !== null && major && !majorFilter.includes(major)) {
    redirect("/admin/tasks?error=major-not-allowed#manage-tasks");
  }

  const payload = {
    title,
    description: description || null,
    status: status || "open",
    assignment_type: assignmentType === "direct" ? "direct" : "major",
    submission_type: submissionType || "any",
    major: assignmentType === "major" ? (major || null) : null,
    assigned_user_id: assignmentType === "direct" ? (assignedUserId || null) : null,
    section_id: sectionId,
    due_date: dueDate,
  };

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select();

  if (error) redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}#manage-tasks`);
  if (!data || data.length === 0)
    redirect("/admin/tasks?error=task-update-blocked#manage-tasks");
  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  if (sectionId) revalidatePath(`/tasks/sections/${sectionId}`);
  redirect("/admin/tasks?success=task-updated#manage-tasks");
}

async function deleteTask(formData: FormData) {
  "use server";
  const { supabase, profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/admin/tasks?error=missing-task-id#manage-tasks");

  // Managers: verify this task belongs to their major
  if (majorFilter !== null) {
    const { data: task } = await supabase
      .from("tasks")
      .select("major")
      .eq("id", taskId)
      .maybeSingle<{ major: string | null }>();
    if (!task || !majorFilter.includes(task.major ?? "")) {
      redirect("/admin/tasks?error=access-denied#manage-tasks");
    }
  }

  await supabase.from("task_joins").delete().eq("task_id", taskId);
  await supabase.from("submissions").delete().eq("task_id", taskId);
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}#manage-tasks`);
  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/admin/tasks?success=task-deleted#manage-tasks");
}

async function moveTask(formData: FormData, direction: "up" | "down") {
  "use server";
  const { supabase } = await requireStaff();
  const taskId = String(formData.get("task_id") || "").trim();
  const sectionId = String(formData.get("section_id") || "").trim();
  if (!taskId || !sectionId) redirect("/admin/tasks#manage-tasks");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, order_index")
    .eq("section_id", sectionId)
    .order("order_index", { ascending: true, nullsFirst: true })
    .returns<{ id: string; order_index: number | null }[]>();

  if (!tasks || tasks.length < 2) redirect("/admin/tasks#manage-tasks");

  // Normalize null order_index values
  const normalized = tasks.map((t, i) => ({
    id: t.id,
    order_index: t.order_index ?? i,
  }));

  const idx = normalized.findIndex((t) => t.id === taskId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= normalized.length) {
    redirect("/admin/tasks#manage-tasks");
  }

  const curr = normalized[idx];
  const swap = normalized[swapIdx];

  await Promise.all([
    supabase.from("tasks").update({ order_index: swap.order_index }).eq("id", curr.id),
    supabase.from("tasks").update({ order_index: curr.order_index }).eq("id", swap.id),
  ]);

  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  redirect("/admin/tasks?success=task-reordered#manage-tasks");
}

async function moveTaskUp(formData: FormData) {
  "use server";
  return moveTask(formData, "up");
}

async function moveTaskDown(formData: FormData) {
  "use server";
  return moveTask(formData, "down");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const taskStatus = typeof params.taskStatus === "string" ? params.taskStatus : "all";
  const successMessage = typeof params.success === "string" ? decodeMessage(params.success) : null;
  const errorMessage = typeof params.error === "string" ? decodeMessage(params.error) : null;

  const { profile } = await requireStaff();
  const majorFilter = getMajorFilter(profile);
  const isManager = profile.role === "manager";
  const supabase = await createClient();

  // ── Data fetching with major filtering ──────────────────────────────────────
  let sectionsQuery = supabase
    .from("sections")
    .select("id, name, major")
    .order("major", { ascending: true });
  if (majorFilter !== null && majorFilter.length > 0) sectionsQuery = sectionsQuery.in("major", majorFilter);
  const { data: sections } = await sectionsQuery.returns<SectionRow[]>();

  let studentsQuery = supabase
    .from("profiles")
    .select("id, full_name, major, role")
    .eq("role", "student")
    .order("full_name", { ascending: true });
  if (majorFilter !== null && majorFilter.length > 0) studentsQuery = studentsQuery.in("major", majorFilter);
  const { data: students } = await studentsQuery.returns<StudentRow[]>();

  let tasksQuery = supabase
    .from("tasks")
    .select(
      "id, title, description, major, status, assignment_type, submission_type, assigned_user_id, section_id, created_at, due_date, order_index"
    )
    .order("order_index", { ascending: true, nullsFirst: true });
  if (majorFilter !== null && majorFilter.length > 0) tasksQuery = tasksQuery.in("major", majorFilter);
  const { data: tasksRaw } = await tasksQuery.returns<TaskRow[]>();

  // Pending review count for this staff member's scope
  const taskIds = (tasksRaw ?? []).map((t) => t.id);
  let pendingCount = 0;
  if (taskIds.length > 0) {
    const { count } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .in("task_id", taskIds)
      .is("reviewed_at", null);
    pendingCount = count ?? 0;
  } else if (majorFilter === null) {
    // Admin with no tasks at all
    const { count } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .is("reviewed_at", null);
    pendingCount = count ?? 0;
  }

  const totalTasks = tasksRaw?.length ?? 0;
  const totalStudents = students?.length ?? 0;

  // Build user map
  const userIds = Array.from(
    new Set([
      ...(students ?? []).map((s) => s.id),
      ...(tasksRaw ?? []).map((t) => t.assigned_user_id).filter(Boolean) as string[],
    ])
  );
  let userMap: UserMap = {};
  if (userIds.length > 0) {
    const { data: relatedProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, major")
      .in("id", userIds)
      .returns<Array<{ id: string; full_name: string | null; major: string | null }>>();
    userMap = (relatedProfiles ?? []).reduce<UserMap>((acc, item) => {
      acc[item.id] = { full_name: item.full_name, major: item.major };
      return acc;
    }, {});
  }

  const sectionMap = (sections ?? []).reduce<Record<string, SectionRow>>((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  // Filter tasks by search + status
  const filteredTasks = (tasksRaw ?? []).filter((task) => {
    const assignedName = task.assigned_user_id
      ? getUserDisplayName(task.assigned_user_id, userMap, "Student").toLowerCase()
      : "";
    const matchesSearch =
      !q ||
      task.title.toLowerCase().includes(q) ||
      (task.description || "").toLowerCase().includes(q) ||
      (task.major || "").toLowerCase().includes(q) ||
      assignedName.includes(q);
    const normalizedStatus = (task.status || "open").toLowerCase();
    const matchesStatus = taskStatus === "all" || normalizedStatus === taskStatus;
    return matchesSearch && matchesStatus;
  });

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900";
  const labelClass = "mb-2 block text-sm font-medium text-slate-700";

  // Major names available to this staff member (locked for managers)
  const dbMajors = await getMajorNames(supabase);
  const availableMajors = majorFilter !== null && majorFilter.length > 0 ? majorFilter : dbMajors;
  const majorLabel = getMajorLabel(profile);

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
                {isManager ? `Manager Panel — ${majorLabel}` : "Admin Panel"}
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                Task Management
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-500">
                {isManager
                  ? `Create and manage tasks for ${majorLabel || "your major"}.`
                  : "Create tasks and manage tasks across all majors."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#create-task"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium !text-white transition hover:bg-slate-700"
              >
                + Create Task
              </a>
              <a
                href="#manage-tasks"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Manage Tasks
              </a>
              <Link
                href="/admin/submissions"
                className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
              >
                {pendingCount > 0 ? `Review (${pendingCount})` : "Review Submissions"}
              </Link>
              <Link
                href="/admin/sections"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Sections
              </Link>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Tasks", value: totalTasks, desc: isManager ? `In ${majorLabel}` : "All created tasks" },
            { label: "Students", value: totalStudents, desc: isManager ? `In ${majorLabel}` : "Registered students" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-4xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-400">{stat.desc}</p>
            </div>
          ))}
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm xl:col-span-2">
            <p className="text-sm font-medium text-amber-700">Pending Review</p>
            <p className="mt-2 text-4xl font-bold text-slate-900">{pendingCount}</p>
            <p className="mt-1 text-sm text-amber-600">
              {pendingCount > 0 ? "Submissions waiting for your review" : "All caught up!"}
            </p>
          </div>
        </section>

        {/* Alerts */}
        {(successMessage || errorMessage) && (
          <section className="mt-6 space-y-3">
            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                ✓ {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                ✗ {errorMessage}
              </div>
            )}
          </section>
        )}

        {/* Filter bar */}
        <section className="mt-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-medium text-slate-700">Filter tasks</p>
          <form className="grid gap-4 lg:grid-cols-[1.5fr_1fr_auto]">
            <div>
              <label htmlFor="q" className={labelClass}>Search</label>
              <input
                id="q"
                name="q"
                defaultValue={params.q || ""}
                placeholder="Title, description, major…"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="taskStatus" className={labelClass}>Status</label>
              <select id="taskStatus" name="taskStatus" defaultValue={taskStatus} className={inputClass}>
                <option value="all">All tasks</option>
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium !text-white transition hover:bg-slate-700"
              >
                Apply
              </button>
            </div>
          </form>
        </section>

        {/* Section 1 — Create Task */}
        <section id="create-task" className="mt-6 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Section 1</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Create Task</h2>
            <p className="mt-2 text-sm text-slate-500">
              {isManager
                ? `Create a new task for ${majorLabel || "your major"}.`
                : "Create a new task for a major or assign it directly to one student."}
            </p>
          </div>
          <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Choose what kind of submission the student must send: text, link, file, image, or any.
          </div>
          <form action={createTask} className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>Title</label>
              <input
                id="title"
                name="title"
                type="text"
                required
                placeholder="e.g. Risk Assessment Report"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="description" className={labelClass}>Description</label>
              <textarea
                id="description"
                name="description"
                rows={5}
                placeholder="Write task instructions here…"
                className={inputClass}
              />
            </div>
            <div className="grid gap-5 md:grid-cols-4">
              <div>
                <label htmlFor="status" className={labelClass}>Status</label>
                <select id="status" name="status" defaultValue="open" className={inputClass}>
                  <option value="open">open</option>
                  <option value="draft">draft</option>
                  <option value="closed">closed</option>
                </select>
              </div>
              <div>
                <label htmlFor="assignment_type" className={labelClass}>Assignment Type</label>
                <select id="assignment_type" name="assignment_type" defaultValue="major" className={inputClass}>
                  <option value="major">major</option>
                  <option value="direct">direct</option>
                </select>
              </div>
              <div>
                <label htmlFor="submission_type" className={labelClass}>Submission Type</label>
                <select id="submission_type" name="submission_type" defaultValue="any" className={inputClass}>
                  <option value="any">any</option>
                  <option value="text">text</option>
                  <option value="link">link</option>
                  <option value="file">file</option>
                  <option value="image">image</option>
                </select>
              </div>
              <div>
                <label htmlFor="due_date" className={labelClass}>Due Date <span className="text-slate-400 font-normal">(optional)</span></label>
                <input id="due_date" name="due_date" type="date" className={inputClass} />
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <MajorSectionSelect
                majorNames={availableMajors}
                sections={sections ?? []}
                defaultMajor=""
                defaultSectionId=""
                inputClass={inputClass}
                labelClass={labelClass}
                lockedMajor={isManager && profile.assigned_major ? profile.assigned_major : undefined}
              />
              <div>
                <label htmlFor="assigned_user_id" className={labelClass}>Assign to Student</label>
                <select
                  id="assigned_user_id"
                  name="assigned_user_id"
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="">Select a student</option>
                  {(students ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {getUserDisplayName(
                        student.id,
                        { [student.id]: { full_name: student.full_name, major: student.major } },
                        "Student"
                      )}
                      {student.major ? ` — ${student.major}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium !text-white transition hover:bg-slate-700"
              >
                Create Task
              </button>
            </div>
          </form>
        </section>

        {/* Section 2 — Manage Tasks */}
        <section id="manage-tasks" className="mt-6 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Section 2</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Manage Tasks</h2>
              <p className="mt-2 text-sm text-slate-500">Edit or delete existing tasks.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
              {filteredTasks.length} shown
            </span>
          </div>
          <div className="space-y-6">
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No tasks found.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const assignedStudentName = task.assigned_user_id
                  ? getUserDisplayName(task.assigned_user_id, userMap, "Student")
                  : null;
                const assignedStudentMajor = task.assigned_user_id
                  ? userMap[task.assigned_user_id]?.major
                  : null;
                const taskSection = task.section_id ? sectionMap[task.section_id] : null;
                return (
                  <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                      <h3 className="mr-2 text-base font-semibold text-slate-900">
                        {task.title}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTaskStatusClasses(task.status)}`}
                      >
                        {task.status || "open"}
                      </span>
                      {task.assignment_type && (
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-100">
                          {task.assignment_type}
                        </span>
                      )}
                      {task.major && (
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                          {task.major}
                        </span>
                      )}
                      {taskSection && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                          📂 {taskSection.name}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {getSubmissionTypeLabel(task.submission_type)}
                      </span>
                      {task.due_date && (() => {
                        const info = getDueDateInfo(task.due_date);
                        return info ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${info.cls}`}>
                            🗓 {info.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <p className="mb-1 text-xs text-slate-400">Created: {formatDate(task.created_at)}</p>
                    {task.assignment_type === "direct" && assignedStudentName && (
                      <p className="mb-4 text-xs text-slate-500">
                        Assigned to:{" "}
                        <span className="font-medium text-slate-700">{assignedStudentName}</span>
                        {assignedStudentMajor ? ` — ${assignedStudentMajor}` : ""}
                      </p>
                    )}
                    <form action={updateTask} className="space-y-4">
                      <input type="hidden" name="task_id" value={task.id} />
                      <div>
                        <label htmlFor={`title-${task.id}`} className={labelClass}>Title</label>
                        <input
                          id={`title-${task.id}`}
                          name="title"
                          type="text"
                          required
                          defaultValue={task.title}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor={`description-${task.id}`} className={labelClass}>Description</label>
                        <textarea
                          id={`description-${task.id}`}
                          name="description"
                          rows={4}
                          defaultValue={task.description || ""}
                          className={inputClass}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <label htmlFor={`status-${task.id}`} className={labelClass}>Status</label>
                          <select
                            id={`status-${task.id}`}
                            name="status"
                            defaultValue={task.status || "open"}
                            className={inputClass}
                          >
                            <option value="open">open</option>
                            <option value="draft">draft</option>
                            <option value="closed">closed</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`assignment_type-${task.id}`} className={labelClass}>
                            Assignment Type
                          </label>
                          <select
                            id={`assignment_type-${task.id}`}
                            name="assignment_type"
                            defaultValue={task.assignment_type || "major"}
                            className={inputClass}
                          >
                            <option value="major">major</option>
                            <option value="direct">direct</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`submission_type-${task.id}`} className={labelClass}>
                            Submission Type
                          </label>
                          <select
                            id={`submission_type-${task.id}`}
                            name="submission_type"
                            defaultValue={task.submission_type || "any"}
                            className={inputClass}
                          >
                            <option value="any">any</option>
                            <option value="text">text</option>
                            <option value="link">link</option>
                            <option value="file">file</option>
                            <option value="image">image</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`due_date-${task.id}`} className={labelClass}>
                            Due Date <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <input
                            id={`due_date-${task.id}`}
                            name="due_date"
                            type="date"
                            defaultValue={task.due_date ?? ""}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <MajorSectionSelect
                          majorNames={availableMajors}
                          sections={sections ?? []}
                          defaultMajor={task.major ?? ""}
                          defaultSectionId={task.section_id ?? ""}
                          inputClass={inputClass}
                          labelClass={labelClass}
                          lockedMajor={isManager && majorFilter?.length === 1 ? majorFilter[0] : undefined}
                        />
                        <div>
                          <label htmlFor={`assigned_user_id-${task.id}`} className={labelClass}>
                            Assign to Student
                          </label>
                          <select
                            id={`assigned_user_id-${task.id}`}
                            name="assigned_user_id"
                            defaultValue={task.assigned_user_id || ""}
                            className={inputClass}
                          >
                            <option value="">Select a student</option>
                            {(students ?? []).map((student) => (
                              <option key={student.id} value={student.id}>
                                {getUserDisplayName(
                                  student.id,
                                  {
                                    [student.id]: {
                                      full_name: student.full_name,
                                      major: student.major,
                                    },
                                  },
                                  "Student"
                                )}
                                {student.major ? ` — ${student.major}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium !text-white transition hover:bg-slate-700"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {task.section_id && (
                        <>
                          <form action={moveTaskUp}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <input type="hidden" name="section_id" value={task.section_id} />
                            <button
                              type="submit"
                              title="Move task up within section"
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              ↑ Move Up
                            </button>
                          </form>
                          <form action={moveTaskDown}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <input type="hidden" name="section_id" value={task.section_id} />
                            <button
                              type="submit"
                              title="Move task down within section"
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              ↓ Move Down
                            </button>
                          </form>
                        </>
                      )}
                      <form action={deleteTask}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete Task
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Section 3 — Submission Review CTA */}
        <section
          id="review-submissions"
          className="mt-6 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-8 shadow-sm"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                Section 3
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Review Submissions
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {pendingCount > 0
                  ? `${pendingCount} submission${pendingCount !== 1 ? "s" : ""} waiting for your review.`
                  : "All submissions have been reviewed — great work!"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Submissions are managed on a dedicated page with full filtering,
                status tracking, and scoring.
              </p>
            </div>
            <Link
              href="/admin/submissions"
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              {pendingCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-amber-600">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
              Go to Submission Review →
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
