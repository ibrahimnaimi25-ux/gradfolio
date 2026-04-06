import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  q?: string;
  taskStatus?: string;
  submissionStatus?: string;
  success?: string;
  error?: string;
}>;

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "student" | "admin";
  major: string | null;
};

type MajorRow = {
  id: string;
  name: string;
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
  role: "student" | "admin";
};

type SubmissionType = "any" | "text" | "link" | "file" | "image";

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
};

type SubmissionRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string | null;
  link_url: string | null;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  submitted_at: string | null;
  admin_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type UserMap = Record<string, { full_name: string | null; major: string | null }>;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(size: number | null) {
  if (!size || size <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function isImageFile(fileType: string | null, fileUrl: string | null) {
  if (fileType?.startsWith("image/")) return true;
  const lowerUrl = (fileUrl || "").toLowerCase();
  return (
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg") ||
    lowerUrl.endsWith(".webp") ||
    lowerUrl.endsWith(".gif")
  );
}

function getTaskStatusClasses(status: string | null) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "open") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (normalized === "closed") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (normalized === "draft") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-slate-100 text-slate-600";
}

function getSubmissionStatusClasses(reviewedAt: string | null) {
  if (reviewedAt) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
}

function getUserDisplayName(userId: string, userMap: UserMap, fallbackPrefix = "User") {
  const profile = userMap[userId];
  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;
  return `${fallbackPrefix} ${userId.slice(0, 8)}`;
}

function getSubmissionTypeLabel(type: SubmissionType | null) {
  switch (type) {
    case "text": return "Text only";
    case "link": return "Link only";
    case "file": return "File only";
    case "image": return "Image only";
    default: return "Any type";
  }
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "admin" }>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");
  return { supabase, user };
}

async function createTask(formData: FormData) {
  "use server";
  const { supabase, user } = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "open").trim();
  const assignmentType = String(formData.get("assignment_type") || "major").trim();
  const submissionType = String(formData.get("submission_type") || "any").trim() as SubmissionType;
  const major = String(formData.get("major") || "").trim();
  const assignedUserId = String(formData.get("assigned_user_id") || "").trim();
  const sectionId = String(formData.get("section_id") || "").trim() || null;

  if (!title) redirect("/admin/tasks?error=missing-title");
  if (assignmentType === "major" && !major) redirect("/admin/tasks?error=select-a-major#create-task");
  if (assignmentType === "direct" && !assignedUserId) redirect("/admin/tasks?error=select-a-student#create-task");

  const payload: {
    title: string;
    description: string | null;
    status: string;
    assignment_type: string;
    submission_type: SubmissionType;
    major: string | null;
    assigned_user_id: string | null;
    created_by: string;
    section_id: string | null;
  } = {
    title,
    description: description || null,
    status: status || "open",
    assignment_type: assignmentType === "direct" ? "direct" : "major",
    submission_type: submissionType || "any",
    major: null,
    assigned_user_id: null,
    created_by: user.id,
    section_id: sectionId,
  };

  if (payload.assignment_type === "major") {
    payload.major = major || null;
    payload.assigned_user_id = null;
  } else {
    payload.major = null;
    payload.assigned_user_id = assignedUserId || null;
  }

  const { error } = await supabase.from("tasks").insert(payload);
  if (error) redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (sectionId) revalidatePath(`/tasks/sections/${sectionId}`);
  redirect("/admin/tasks?success=task-created#create-task");
}

async function updateTask(formData: FormData) {
  "use server";
  const { supabase } = await requireAdmin();
  const taskId = String(formData.get("task_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const status = String(formData.get("status") || "open").trim();
  const assignmentType = String(formData.get("assignment_type") || "major").trim();
  const submissionType = String(formData.get("submission_type") || "any").trim() as SubmissionType;
  const major = String(formData.get("major") || "").trim();
  const assignedUserId = String(formData.get("assigned_user_id") || "").trim();
  const sectionId = String(formData.get("section_id") || "").trim() || null;

  if (!taskId) redirect("/admin/tasks?error=missing-task-id#manage-tasks");
  if (!title) redirect("/admin/tasks?error=title-required#manage-tasks");
  if (assignmentType === "major" && !major) redirect("/admin/tasks?error=select-a-major#manage-tasks");
  if (assignmentType === "direct" && !assignedUserId) redirect("/admin/tasks?error=select-a-student#manage-tasks");

  const payload: {
    title: string;
    description: string | null;
    status: string;
    assignment_type: string;
    submission_type: SubmissionType;
    major: string | null;
    assigned_user_id: string | null;
    section_id: string | null;
  } = {
    title,
    description: description || null,
    status: status || "open",
    assignment_type: assignmentType === "direct" ? "direct" : "major",
    submission_type: submissionType || "any",
    major: null,
    assigned_user_id: null,
    section_id: sectionId,
  };

  if (payload.assignment_type === "major") {
    payload.major = major || null;
    payload.assigned_user_id = null;
  } else {
    payload.major = null;
    payload.assigned_user_id = assignedUserId || null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select();

  if (error) redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}#manage-tasks`);
  if (!data || data.length === 0) redirect("/admin/tasks?error=task-update-blocked#manage-tasks");
  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  if (sectionId) revalidatePath(`/tasks/sections/${sectionId}`);
  redirect("/admin/tasks?success=task-updated#manage-tasks");
}

async function deleteTask(formData: FormData) {
  "use server";
  const { supabase } = await requireAdmin();
  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) redirect("/admin/tasks?error=missing-task-id#manage-tasks");
  const { error: joinsError } = await supabase.from("task_joins").delete().eq("task_id", taskId);
  if (joinsError) redirect(`/admin/tasks?error=${encodeURIComponent(joinsError.message)}#manage-tasks`);
  const { error: submissionsError } = await supabase.from("submissions").delete().eq("task_id", taskId);
  if (submissionsError) redirect(`/admin/tasks?error=${encodeURIComponent(submissionsError.message)}#manage-tasks`);
  const { error: taskError } = await supabase.from("tasks").delete().eq("id", taskId);
  if (taskError) redirect(`/admin/tasks?error=${encodeURIComponent(taskError.message)}#manage-tasks`);
  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  redirect("/admin/tasks?success=task-deleted#manage-tasks");
}

async function reviewSubmission(formData: FormData) {
  "use server";
  const { supabase, user } = await requireAdmin();
  const submissionId = String(formData.get("submission_id") || "").trim();
  const feedback = String(formData.get("admin_feedback") || "").trim();
  if (!submissionId) redirect("/admin/tasks?error=missing-submission-id#review-submissions");
  const { error } = await supabase
    .from("submissions")
    .update({
      admin_feedback: feedback || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", submissionId);
  if (error) redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}#review-submissions`);
  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/admin/tasks?success=feedback-saved#review-submissions");
}

function decodeMessage(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).replaceAll("-", " ").trim();
  } catch {
    return value.replaceAll("-", " ").trim();
  }
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const taskStatus = typeof params.taskStatus === "string" ? params.taskStatus : "all";
  const submissionStatus = typeof params.submissionStatus === "string" ? params.submissionStatus : "pending";
  const successMessage = typeof params.success === "string" ? decodeMessage(params.success) : null;
  const errorMessage = typeof params.error === "string" ? decodeMessage(params.error) : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, major")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  if (profileError || !profile || profile.role !== "admin") redirect("/dashboard");

  const { data: majors } = await supabase
    .from("majors")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<MajorRow[]>();

  // Fetch sections for the dropdown
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, major")
    .order("major", { ascending: true })
    .returns<SectionRow[]>();

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, major, role")
    .eq("role", "student")
    .order("full_name", { ascending: true })
    .returns<StudentRow[]>();

  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select("id, title, description, major, status, assignment_type, submission_type, assigned_user_id, section_id, created_at")
    .order("created_at", { ascending: false })
    .returns<TaskRow[]>();

  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select("id, task_id, user_id, content, link_url, file_name, file_path, file_url, file_type, file_size, submitted_at, admin_feedback, reviewed_at, reviewed_by")
    .order("submitted_at", { ascending: false })
    .returns<SubmissionRow[]>();

  const userIds = Array.from(new Set([
    ...(students ?? []).map((s) => s.id),
    ...(submissionsRaw ?? []).map((s) => s.user_id),
    ...(submissionsRaw ?? []).map((s) => s.reviewed_by).filter(Boolean) as string[],
    ...(tasksRaw ?? []).map((t) => t.assigned_user_id).filter(Boolean) as string[],
  ]));

  let userMap: UserMap = {};
  if (userIds.length > 0) {
    const { data: relatedProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, major")
      .in("id", userIds)
      .returns<Array<{ id: string; full_name: string | null; major: string | null }>>();
    userMap = relatedProfiles?.reduce<UserMap>((acc, item) => {
      acc[item.id] = { full_name: item.full_name, major: item.major };
      return acc;
    }, {}) ?? {};
  }

  // Build a section map for display
  const sectionMap = (sections ?? []).reduce<Record<string, SectionRow>>((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const taskMap = tasksRaw?.reduce<Record<string, TaskRow>>((acc, task) => {
    acc[task.id] = task;
    return acc;
  }, {}) ?? {};

  const filteredTasks = (tasksRaw ?? []).filter((task) => {
    const assignedName = task.assigned_user_id
      ? getUserDisplayName(task.assigned_user_id, userMap, "Student").toLowerCase()
      : "";
    const matchesSearch =
      !q ||
      task.title.toLowerCase().includes(q) ||
      (task.description || "").toLowerCase().includes(q) ||
      (task.major || "").toLowerCase().includes(q) ||
      (task.assignment_type || "").toLowerCase().includes(q) ||
      (task.submission_type || "").toLowerCase().includes(q) ||
      assignedName.includes(q);
    const normalizedStatus = (task.status || "open").toLowerCase();
    const matchesStatus = taskStatus === "all" || normalizedStatus === taskStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredSubmissions = (submissionsRaw ?? [])
    .filter((submission) => {
      const task = taskMap[submission.task_id];
      const studentName = getUserDisplayName(submission.user_id, userMap, "Student").toLowerCase();
      const studentMajor = userMap[submission.user_id]?.major?.toLowerCase() || "";
      const isReviewed = !!submission.reviewed_at;
      const matchesSearch =
        !q ||
        (task?.title || "").toLowerCase().includes(q) ||
        studentName.includes(q) ||
        studentMajor.includes(q) ||
        (submission.content || "").toLowerCase().includes(q) ||
        (submission.link_url || "").toLowerCase().includes(q) ||
        (submission.file_name || "").toLowerCase().includes(q);
      const matchesStatus =
        submissionStatus === "all" ||
        (submissionStatus === "pending" && !isReviewed) ||
        (submissionStatus === "reviewed" && isReviewed);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aPending = !a.reviewed_at ? 1 : 0;
      const bPending = !b.reviewed_at ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bTime - aTime;
    });

  const totalTasks = tasksRaw?.length ?? 0;
  const totalSubmissions = submissionsRaw?.length ?? 0;
  const totalStudents = students?.length ?? 0;
  const pendingCount = submissionsRaw?.filter((s) => !s.reviewed_at).length ?? 0;

  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900";
  const labelClass = "mb-2 block text-sm font-medium text-slate-700";

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Admin Panel</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">GradFolio Admin</h1>
              <p className="mt-3 text-base leading-7 text-slate-500">Create tasks, manage tasks, and review student submissions.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#create-task" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium !text-white transition hover:bg-slate-700">Create Task</a>
              <a href="#manage-tasks" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Manage Tasks</a>
              <a href="#review-submissions" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Review Submissions</a>
              <a href="/admin/sections" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Manage Sections</a>
              <a href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Dashboard</a>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Tasks", value: totalTasks, description: "All created tasks" },
            { label: "Total Submissions", value: totalSubmissions, description: "All student submissions" },
            { label: "Students", value: totalStudents, description: "Registered student accounts" },
            { label: "Total Users", value: totalUsers ?? 0, description: "All accounts including admins" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-2 text-4xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-400">{stat.description}</p>
            </div>
          ))}
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-sm font-medium text-amber-700">Pending Review</p>
            <p className="mt-2 text-4xl font-bold text-slate-900">{pendingCount}</p>
            <p className="mt-1 text-sm text-amber-600">Needs your attention</p>
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
          <p className="mb-4 text-sm font-medium text-slate-700">Filter tasks and submissions</p>
          <form className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
            <div>
              <label htmlFor="q" className={labelClass}>Search</label>
              <input id="q" name="q" defaultValue={params.q || ""} placeholder="Tasks, students, majors, files…" className={inputClass} />
            </div>
            <div>
              <label htmlFor="taskStatus" className={labelClass}>Task Status</label>
              <select id="taskStatus" name="taskStatus" defaultValue={taskStatus} className={inputClass}>
                <option value="all">All tasks</option>
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label htmlFor="submissionStatus" className={labelClass}>Submission Status</label>
              <select id="submissionStatus" name="submissionStatus" defaultValue={submissionStatus} className={inputClass}>
                <option value="pending">Pending first</option>
                <option value="reviewed">Reviewed only</option>
                <option value="all">All submissions</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium !text-white transition hover:bg-slate-700">Apply</button>
            </div>
          </form>
        </section>

        {/* Section 1 — Create Task */}
        <section id="create-task" className="mt-6 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Section 1</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Create Task</h2>
            <p className="mt-2 text-sm text-slate-500">Create a new task for a major or assign it directly to one student.</p>
          </div>
          <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Choose what kind of submission the student must send: text, link, file, image, or any.
          </div>
          <form action={createTask} className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>Title</label>
              <input id="title" name="title" type="text" required placeholder="e.g. Risk Assessment Report" className={inputClass} />
            </div>
            <div>
              <label htmlFor="description" className={labelClass}>Description</label>
              <textarea id="description" name="description" rows={5} placeholder="Write task instructions here…" className={inputClass} />
            </div>
            <div className="grid gap-5 md:grid-cols-3">
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
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="major" className={labelClass}>Major</label>
                <select id="major" name="major" defaultValue="" className={inputClass}>
                  <option value="">Select a major</option>
                  {(majors ?? []).map((major) => (
                    <option key={major.id} value={major.name}>{major.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assigned_user_id" className={labelClass}>Assign to Student</label>
                <select id="assigned_user_id" name="assigned_user_id" defaultValue="" className={inputClass}>
                  <option value="">Select a student</option>
                  {(students ?? []).map((student) => (
                    <option key={student.id} value={student.id}>
                      {getUserDisplayName(student.id, { [student.id]: { full_name: student.full_name, major: student.major } }, "Student")}
                      {student.major ? ` — ${student.major}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section dropdown */}
            <div>
              <label htmlFor="section_id" className={labelClass}>Section (optional)</label>
              <select id="section_id" name="section_id" defaultValue="" className={inputClass}>
                <option value="">No section</option>
                {(sections ?? []).map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name} — {section.major}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium !text-white transition hover:bg-slate-700">
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
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">{filteredTasks.length} shown</span>
          </div>
          <div className="space-y-6">
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No tasks found.</div>
            ) : (
              filteredTasks.map((task) => {
                const assignedStudentName = task.assigned_user_id ? getUserDisplayName(task.assigned_user_id, userMap, "Student") : null;
                const assignedStudentMajor = task.assigned_user_id ? userMap[task.assigned_user_id]?.major : null;
                const taskSection = task.section_id ? sectionMap[task.section_id] : null;
                return (
                  <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                      <h3 className="mr-2 text-base font-semibold text-slate-900">{task.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTaskStatusClasses(task.status)}`}>{task.status || "open"}</span>
                      {task.assignment_type && (
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-100">{task.assignment_type}</span>
                      )}
                      {task.major && (
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">{task.major}</span>
                      )}
                      {taskSection && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                          📂 {taskSection.name}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">{getSubmissionTypeLabel(task.submission_type)}</span>
                    </div>
                    <p className="mb-1 text-xs text-slate-400">Created: {formatDate(task.created_at)}</p>
                    {task.assignment_type === "direct" && assignedStudentName && (
                      <p className="mb-4 text-xs text-slate-500">
                        Assigned to: <span className="font-medium text-slate-700">{assignedStudentName}</span>
                        {assignedStudentMajor ? ` — ${assignedStudentMajor}` : ""}
                      </p>
                    )}
                    <form action={updateTask} className="space-y-4">
                      <input type="hidden" name="task_id" value={task.id} />
                      <div>
                        <label htmlFor={`title-${task.id}`} className={labelClass}>Title</label>
                        <input id={`title-${task.id}`} name="title" type="text" required defaultValue={task.title} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor={`description-${task.id}`} className={labelClass}>Description</label>
                        <textarea id={`description-${task.id}`} name="description" rows={4} defaultValue={task.description || ""} className={inputClass} />
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label htmlFor={`status-${task.id}`} className={labelClass}>Status</label>
                          <select id={`status-${task.id}`} name="status" defaultValue={task.status || "open"} className={inputClass}>
                            <option value="open">open</option>
                            <option value="draft">draft</option>
                            <option value="closed">closed</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`assignment_type-${task.id}`} className={labelClass}>Assignment Type</label>
                          <select id={`assignment_type-${task.id}`} name="assignment_type" defaultValue={task.assignment_type || "major"} className={inputClass}>
                            <option value="major">major</option>
                            <option value="direct">direct</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`submission_type-${task.id}`} className={labelClass}>Submission Type</label>
                          <select id={`submission_type-${task.id}`} name="submission_type" defaultValue={task.submission_type || "any"} className={inputClass}>
                            <option value="any">any</option>
                            <option value="text">text</option>
                            <option value="link">link</option>
                            <option value="file">file</option>
                            <option value="image">image</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label htmlFor={`major-${task.id}`} className={labelClass}>Major</label>
                          <select id={`major-${task.id}`} name="major" defaultValue={task.major || ""} className={inputClass}>
                            <option value="">Select a major</option>
                            {(majors ?? []).map((major) => (
                              <option key={major.id} value={major.name}>{major.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`assigned_user_id-${task.id}`} className={labelClass}>Assign to Student</label>
                          <select id={`assigned_user_id-${task.id}`} name="assigned_user_id" defaultValue={task.assigned_user_id || ""} className={inputClass}>
                            <option value="">Select a student</option>
                            {(students ?? []).map((student) => (
                              <option key={student.id} value={student.id}>
                                {getUserDisplayName(student.id, { [student.id]: { full_name: student.full_name, major: student.major } }, "Student")}
                                {student.major ? ` — ${student.major}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Section dropdown in edit form */}
                      <div>
                        <label htmlFor={`section_id-${task.id}`} className={labelClass}>Section (optional)</label>
                        <select id={`section_id-${task.id}`} name="section_id" defaultValue={task.section_id || ""} className={inputClass}>
                          <option value="">No section</option>
                          {(sections ?? []).map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name} — {section.major}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium !text-white transition hover:bg-slate-700">
                          Save Changes
                        </button>
                      </div>
                    </form>
                    <form action={deleteTask} className="mt-3">
                      <input type="hidden" name="task_id" value={task.id} />
                      <button type="submit" className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50">
                        Delete Task
                      </button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Section 3 — Review Submissions */}
        <section id="review-submissions" className="mt-6 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Section 3</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Review Submissions</h2>
              <p className="mt-2 text-sm text-slate-500">Pending submissions are shown first so review is faster.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">{pendingCount} pending</span>
          </div>
          <div className="space-y-6">
            {filteredSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No submissions found.</div>
            ) : (
              filteredSubmissions.map((submission) => {
                const task = taskMap[submission.task_id];
                const studentName = getUserDisplayName(submission.user_id, userMap, "Student");
                const studentMajor = userMap[submission.user_id]?.major || null;
                const reviewerName = submission.reviewed_by ? getUserDisplayName(submission.reviewed_by, userMap, "Admin") : null;
                const isReviewed = !!submission.reviewed_at;
                return (
                  <div key={submission.id} className={`rounded-2xl border p-6 ${isReviewed ? "border-slate-100 bg-slate-50" : "border-amber-100 bg-amber-50/40"}`}>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <h3 className="mr-2 text-base font-semibold text-slate-900">{task?.title || "Unknown task"}</h3>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getSubmissionStatusClasses(submission.reviewed_at)}`}>
                        {isReviewed ? "Reviewed" : "Pending"}
                      </span>
                      {task?.major && (
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">{task.major}</span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                        {getSubmissionTypeLabel(task?.submission_type ?? "any")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Student: <span className="font-medium text-slate-900">{studentName}</span>
                      {studentMajor ? ` — ${studentMajor}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Submitted: {formatDate(submission.submitted_at)}</p>
                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Text</p>
                        <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                          {submission.content || "No text provided."}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Link</p>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          {submission.link_url ? (
                            <a href={submission.link_url} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
                              {submission.link_url}
                            </a>
                          ) : "No link provided."}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">File</p>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          {!submission.file_url ? "No file uploaded." : (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <a href={submission.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium !text-white transition hover:bg-slate-700">
                                  Open / Download
                                </a>
                                <span className="text-xs text-slate-400">
                                  {submission.file_name || "Uploaded file"}
                                  {submission.file_size ? ` • ${formatFileSize(submission.file_size)}` : ""}
                                </span>
                              </div>
                              {isImageFile(submission.file_type, submission.file_url) && (
                                <img src={submission.file_url} alt={submission.file_name || "Submitted image"} className="max-h-80 rounded-xl border border-slate-200 object-contain" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <form action={reviewSubmission} className="mt-5 space-y-4">
                      <input type="hidden" name="submission_id" value={submission.id} />
                      <div>
                        <label htmlFor={`feedback-${submission.id}`} className="mb-2 block text-sm font-medium text-slate-700">Admin Feedback</label>
                        <textarea id={`feedback-${submission.id}`} name="admin_feedback" rows={4} defaultValue={submission.admin_feedback || ""} placeholder="Write feedback for the student…" className={inputClass} />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">
                          {isReviewed
                            ? `Last reviewed: ${formatDate(submission.reviewed_at)}${reviewerName ? ` by ${reviewerName}` : ""}`
                            : "Not reviewed yet."}
                        </p>
                        <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium !text-white transition hover:bg-slate-700">
                          Save Feedback
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </div>
    </main>
  );
}