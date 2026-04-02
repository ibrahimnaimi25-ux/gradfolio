import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  q?: string;
  taskStatus?: string;
  submissionStatus?: string;
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

type UserMap = Record<
  string,
  {
    full_name: string | null;
    major: string | null;
  }
>;

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

  if (normalized === "open") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (normalized === "closed") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (normalized === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getSubmissionStatusClasses(reviewedAt: string | null) {
  if (reviewedAt) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
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

function getSubmissionTypeLabel(type: SubmissionType | null) {
  switch (type) {
    case "text":
      return "Text only";
    case "link":
      return "Link only";
    case "file":
      return "File only";
    case "image":
      return "Image only";
    default:
      return "Any type";
  }
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "admin" }>();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

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

  if (!title) {
    redirect("/admin/tasks?error=missing-title");
  }

  if (assignmentType === "major" && !major) {
    redirect("/admin/tasks?error=select-a-major#create-task");
  }

  if (assignmentType === "direct" && !assignedUserId) {
    redirect("/admin/tasks?error=select-a-student#create-task");
  }

  const payload: {
    title: string;
    description: string | null;
    status: string;
    assignment_type: string;
    submission_type: SubmissionType;
    major: string | null;
    assigned_user_id: string | null;
    created_by: string;
  } = {
    title,
    description: description || null,
    status: status || "open",
    assignment_type: assignmentType === "direct" ? "direct" : "major",
    submission_type: submissionType || "any",
    major: null,
    assigned_user_id: null,
    created_by: user.id,
  };

  if (payload.assignment_type === "major") {
    payload.major = major || null;
    payload.assigned_user_id = null;
  } else {
    payload.major = null;
    payload.assigned_user_id = assignedUserId || null;
  }

  const { error } = await supabase.from("tasks").insert(payload);

  if (error) {
    redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");

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

  if (!taskId) {
    redirect("/admin/tasks?error=missing-task-id#manage-tasks");
  }

  if (!title) {
    redirect("/admin/tasks?error=title-required#manage-tasks");
  }

  if (assignmentType === "major" && !major) {
    redirect("/admin/tasks?error=select-a-major#manage-tasks");
  }

  if (assignmentType === "direct" && !assignedUserId) {
    redirect("/admin/tasks?error=select-a-student#manage-tasks");
  }

  const payload: {
    title: string;
    description: string | null;
    status: string;
    assignment_type: string;
    submission_type: SubmissionType;
    major: string | null;
    assigned_user_id: string | null;
  } = {
    title,
    description: description || null,
    status: status || "open",
    assignment_type: assignmentType === "direct" ? "direct" : "major",
    submission_type: submissionType || "any",
    major: null,
    assigned_user_id: null,
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

  if (error) {
    redirect(`/admin/tasks?error=${encodeURIComponent(error.message)}#manage-tasks`);
  }

  if (!data || data.length === 0) {
    redirect("/admin/tasks?error=task-update-blocked#manage-tasks");
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");

  redirect("/admin/tasks?success=task-updated#manage-tasks");
}

async function deleteTask(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const taskId = String(formData.get("task_id") || "").trim();

  if (!taskId) {
    redirect("/admin/tasks?error=missing-task-id#manage-tasks");
  }

  const { error: joinsError } = await supabase
    .from("task_joins")
    .delete()
    .eq("task_id", taskId);

  if (joinsError) {
    redirect(`/admin/tasks?error=${encodeURIComponent(joinsError.message)}#manage-tasks`);
  }

  const { error: submissionsError } = await supabase
    .from("submissions")
    .delete()
    .eq("task_id", taskId);

  if (submissionsError) {
    redirect(`/admin/tasks?error=${encodeURIComponent(submissionsError.message)}#manage-tasks`);
  }

  const { error: taskError } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId);

  if (taskError) {
    redirect(`/admin/tasks?error=${encodeURIComponent(taskError.message)}#manage-tasks`);
  }

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

  if (!submissionId) {
    redirect("/admin/tasks?error=missing-submission-id#review-submissions");
  }

  const { error } = await supabase
    .from("submissions")
    .update({
      admin_feedback: feedback || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", submissionId);

  if (error) {
    redirect(
      `/admin/tasks?error=${encodeURIComponent(error.message)}#review-submissions`
    );
  }

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

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-violet-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: number;
  description: string;
  tone?: "default" | "highlight";
}) {
  const classes =
    tone === "highlight"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-white";

  const labelClasses =
    tone === "highlight" ? "text-amber-700" : "text-slate-500";

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${classes}`}>
      <p className={`text-sm font-medium ${labelClasses}`}>{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q || "").trim().toLowerCase();
  const taskStatus = params.taskStatus || "all";
  const submissionStatus = params.submissionStatus || "pending";
  const successMessage = decodeMessage(params.success);
  const errorMessage = decodeMessage(params.error);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, major")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: majors } = await supabase
    .from("majors")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<MajorRow[]>();

  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, major, role")
    .eq("role", "student")
    .order("full_name", { ascending: true })
    .returns<StudentRow[]>();

  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select(
      "id, title, description, major, status, assignment_type, submission_type, assigned_user_id, created_at"
    )
    .order("created_at", { ascending: false })
    .returns<TaskRow[]>();

  const { data: submissionsRaw } = await supabase
    .from("submissions")
    .select(
      "id, task_id, user_id, content, link_url, file_name, file_path, file_url, file_type, file_size, submitted_at, admin_feedback, reviewed_at, reviewed_by"
    )
    .order("submitted_at", { ascending: false })
    .returns<SubmissionRow[]>();

  const userIds = Array.from(
    new Set([
      ...(students ?? []).map((student) => student.id),
      ...(submissionsRaw ?? []).map((submission) => submission.user_id),
      ...(submissionsRaw ?? [])
        .map((submission) => submission.reviewed_by)
        .filter(Boolean) as string[],
      ...(tasksRaw ?? [])
        .map((task) => task.assigned_user_id)
        .filter(Boolean) as string[],
    ])
  );

  let userMap: UserMap = {};

  if (userIds.length > 0) {
    const { data: relatedProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, major")
      .in("id", userIds)
      .returns<Array<{ id: string; full_name: string | null; major: string | null }>>();

    userMap =
      relatedProfiles?.reduce<UserMap>((acc, item) => {
        acc[item.id] = {
          full_name: item.full_name,
          major: item.major,
        };
        return acc;
      }, {}) ?? {};
  }

  const taskMap =
    tasksRaw?.reduce<Record<string, TaskRow>>((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {}) ?? {};

  const filteredTasks =
    (tasksRaw ?? []).filter((task) => {
      const assignedStudentName = task.assigned_user_id
        ? getUserDisplayName(task.assigned_user_id, userMap, "Student").toLowerCase()
        : "";

      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description || "").toLowerCase().includes(q) ||
        (task.major || "").toLowerCase().includes(q) ||
        (task.assignment_type || "").toLowerCase().includes(q) ||
        (task.submission_type || "").toLowerCase().includes(q) ||
        assignedStudentName.includes(q);

      const normalizedStatus = (task.status || "open").toLowerCase();
      const matchesStatus = taskStatus === "all" || normalizedStatus === taskStatus;

      return matchesSearch && matchesStatus;
    }) ?? [];

  const filteredSubmissions =
    (submissionsRaw ?? [])
      .filter((submission) => {
        const task = taskMap[submission.task_id];
        const studentName = getUserDisplayName(
          submission.user_id,
          userMap,
          "Student"
        ).toLowerCase();
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

        if (aPending !== bPending) {
          return bPending - aPending;
        }

        const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;

        return bTime - aTime;
      }) ?? [];

  const totalTasks = tasksRaw?.length ?? 0;
  const totalSubmissions = submissionsRaw?.length ?? 0;
  const totalStudents = students?.length ?? 0;
  const pendingSubmissionsCount =
    submissionsRaw?.filter((item) => !item.reviewed_at).length ?? 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-violet-600">Admin Panel</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                GradFolio Admin Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Create tasks, manage tasks, and review student submissions from one clearer page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#create-task"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Create Task
              </a>
              <a
                href="#manage-tasks"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Manage Tasks
              </a>
              <a
                href="#review-submissions"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Review Submissions
              </a>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Tasks" value={totalTasks} description="All created tasks" />
          <StatCard label="Total Submissions" value={totalSubmissions} description="All student submissions" />
          <StatCard
            label="Pending Review"
            value={pendingSubmissionsCount}
            description="Needs admin attention first"
            tone="highlight"
          />
          <StatCard label="Students" value={totalStudents} description="Registered student accounts" />
        </section>

        {(successMessage || errorMessage) && (
          <section className="mt-6 space-y-3">
            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Success: {successMessage}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                Error: {errorMessage}
              </div>
            )}
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <form className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
            <div>
              <label htmlFor="q" className="mb-2 block text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q || ""}
                placeholder="Search tasks, students, majors, files, or links..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label htmlFor="taskStatus" className="mb-2 block text-sm font-medium text-slate-700">
                Task Status
              </label>
              <select
                id="taskStatus"
                name="taskStatus"
                defaultValue={taskStatus}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="all">All tasks</option>
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label htmlFor="submissionStatus" className="mb-2 block text-sm font-medium text-slate-700">
                Submission Status
              </label>
              <select
                id="submissionStatus"
                name="submissionStatus"
                defaultValue={submissionStatus}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="pending">Pending first</option>
                <option value="reviewed">Reviewed only</option>
                <option value="all">All submissions</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply
              </button>
            </div>
          </form>
        </section>

        <section
          id="create-task"
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <SectionTitle
            eyebrow="Section 1"
            title="Create Task"
            description="Create a new task for a major or assign it directly to one student."
          />

          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            Choose what kind of submission the student must send: text, link, file, image, or any.
          </div>

          <form action={createTask} className="mt-5 space-y-5">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                placeholder="Example: Risk Assessment Report"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                placeholder="Write task instructions here..."
              />
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="open"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="open">open</option>
                  <option value="draft">draft</option>
                  <option value="closed">closed</option>
                </select>
              </div>

              <div>
                <label htmlFor="assignment_type" className="mb-2 block text-sm font-medium text-slate-700">
                  Assignment Type
                </label>
                <select
                  id="assignment_type"
                  name="assignment_type"
                  defaultValue="major"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="major">major</option>
                  <option value="direct">direct</option>
                </select>
              </div>

              <div>
                <label htmlFor="submission_type" className="mb-2 block text-sm font-medium text-slate-700">
                  Submission Type
                </label>
                <select
                  id="submission_type"
                  name="submission_type"
                  defaultValue="any"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
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
                <label htmlFor="major" className="mb-2 block text-sm font-medium text-slate-700">
                  Major
                </label>
                <select
                  id="major"
                  name="major"
                  defaultValue=""
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="">Select a major</option>
                  {(majors ?? []).map((major) => (
                    <option key={major.id} value={major.name}>
                      {major.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="assigned_user_id" className="mb-2 block text-sm font-medium text-slate-700">
                  Assign to Student
                </label>
                <select
                  id="assigned_user_id"
                  name="assigned_user_id"
                  defaultValue=""
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
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

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create Task
            </button>
          </form>
        </section>

        <section
          id="manage-tasks"
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <SectionTitle
              eyebrow="Section 2"
              title="Manage Tasks"
              description="Edit existing tasks from one organized list."
            />

            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {filteredTasks.length} shown
            </div>
          </div>

          <div className="space-y-5">
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
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

                return (
                  <div
                    key={task.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {task.title}
                          </h3>

                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getTaskStatusClasses(
                              task.status
                            )}`}
                          >
                            {task.status || "open"}
                          </span>

                          {task.assignment_type && (
                            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              {task.assignment_type}
                            </span>
                          )}

                          {task.major && (
                            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                              {task.major}
                            </span>
                          )}

                          <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {getSubmissionTypeLabel(task.submission_type)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-600">
                          Created: {formatDate(task.created_at)}
                        </p>

                        {task.assignment_type === "major" && (
                          <p className="mt-1 text-sm text-slate-600">
                            This task is assigned by major.
                          </p>
                        )}

                        {task.assignment_type === "direct" && task.assigned_user_id && (
                          <p className="mt-1 text-sm text-slate-600">
                            Assigned student:{" "}
                            <span className="font-medium text-slate-900">
                              {assignedStudentName}
                            </span>
                            {assignedStudentMajor ? ` — ${assignedStudentMajor}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <form action={updateTask} className="space-y-4">
                      <input type="hidden" name="task_id" value={task.id} />

                      <div>
                        <label htmlFor={`title-${task.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                          Title
                        </label>
                        <input
                          id={`title-${task.id}`}
                          name="title"
                          type="text"
                          required
                          defaultValue={task.title}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        />
                      </div>

                      <div>
                        <label htmlFor={`description-${task.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                          Description
                        </label>
                        <textarea
                          id={`description-${task.id}`}
                          name="description"
                          rows={4}
                          defaultValue={task.description || ""}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label htmlFor={`status-${task.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                            Status
                          </label>
                          <select
                            id={`status-${task.id}`}
                            name="status"
                            defaultValue={task.status || "open"}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          >
                            <option value="open">open</option>
                            <option value="draft">draft</option>
                            <option value="closed">closed</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor={`assignment_type-${task.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                            Assignment Type
                          </label>
                          <select
                            id={`assignment_type-${task.id}`}
                            name="assignment_type"
                            defaultValue={task.assignment_type || "major"}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          >
                            <option value="major">major</option>
                            <option value="direct">direct</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor={`submission_type-${task.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                            Submission Type
                          </label>
                          <select
                            id={`submission_type-${task.id}`}
                            name="submission_type"
                            defaultValue={task.submission_type || "any"}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          >
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
                          <label htmlFor={`major-${task.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                            Major
                          </label>
                          <select
                            id={`major-${task.id}`}
                            name="major"
                            defaultValue={task.major || ""}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          >
                            <option value="">Select a major</option>
                            {(majors ?? []).map((major) => (
                              <option key={major.id} value={major.name}>
                                {major.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor={`assigned_user_id-${task.id}`} className="mb-2 block text-sm font-medium text-slate-700">
                            Assign to Student
                          </label>
                          <select
                            id={`assigned_user_id-${task.id}`}
                            name="assigned_user_id"
                            defaultValue={task.assigned_user_id || ""}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
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

                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Save Task Changes
                        </button>
                      </div>
                    </form>

                    <form action={deleteTask} className="mt-3">
                      <input type="hidden" name="task_id" value={task.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-2xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Delete Task
                      </button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section
          id="review-submissions"
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <SectionTitle
              eyebrow="Section 3"
              title="Review Submissions"
              description="Pending submissions are shown first so review is faster."
            />

            <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Pending prioritized
            </div>
          </div>

          <div className="space-y-5">
            {filteredSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No submissions found.
              </div>
            ) : (
              filteredSubmissions.map((submission) => {
                const task = taskMap[submission.task_id];
                const studentName = getUserDisplayName(
                  submission.user_id,
                  userMap,
                  "Student"
                );
                const studentMajor = userMap[submission.user_id]?.major || null;
                const reviewerName = submission.reviewed_by
                  ? getUserDisplayName(submission.reviewed_by, userMap, "Admin")
                  : null;

                return (
                  <div
                    key={submission.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {task?.title || "Unknown task"}
                          </h3>

                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getSubmissionStatusClasses(
                              submission.reviewed_at
                            )}`}
                          >
                            {submission.reviewed_at ? "Reviewed" : "Pending"}
                          </span>

                          {task?.major && (
                            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                              {task.major}
                            </span>
                          )}

                          <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {getSubmissionTypeLabel(task?.submission_type ?? "any")}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-600">
                          Student:{" "}
                          <span className="font-medium text-slate-900">
                            {studentName}
                          </span>
                          {studentMajor ? ` — ${studentMajor}` : ""}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Submitted: {formatDate(submission.submitted_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Text Submission
                        </p>
                        <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                          {submission.content || "No text provided."}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Link Submission
                        </p>
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          {submission.link_url ? (
                            <a
                              href={submission.link_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              {submission.link_url}
                            </a>
                          ) : (
                            "No link provided."
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          File Submission
                        </p>
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          {!submission.file_url ? (
                            "No file uploaded."
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <a
                                  href={submission.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                >
                                  Open / Download File
                                </a>

                                <span className="text-xs text-slate-500">
                                  {submission.file_name || "Uploaded file"}
                                  {submission.file_size
                                    ? ` • ${formatFileSize(submission.file_size)}`
                                    : ""}
                                </span>
                              </div>

                              {isImageFile(submission.file_type, submission.file_url) && (
                                <img
                                  src={submission.file_url}
                                  alt={submission.file_name || "Submitted image"}
                                  className="max-h-[360px] rounded-2xl border border-slate-200 object-contain"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <form action={reviewSubmission} className="mt-5 space-y-4">
                      <input type="hidden" name="submission_id" value={submission.id} />

                      <div>
                        <label
                          htmlFor={`feedback-${submission.id}`}
                          className="mb-2 block text-sm font-semibold text-slate-900"
                        >
                          Admin Feedback
                        </label>
                        <textarea
                          id={`feedback-${submission.id}`}
                          name="admin_feedback"
                          rows={4}
                          defaultValue={submission.admin_feedback || ""}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          placeholder="Write feedback for the student..."
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                          {submission.reviewed_at ? (
                            <>
                              Last reviewed: {formatDate(submission.reviewed_at)}
                              {reviewerName ? ` by ${reviewerName}` : ""}
                            </>
                          ) : (
                            <>This submission has not been reviewed yet.</>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
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