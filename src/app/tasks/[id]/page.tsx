import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

type SubmissionType = "any" | "text" | "link" | "file" | "image";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  major: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
  assignment_type: string | null;
  submission_type: SubmissionType | null;
  assigned_user_id: string | null;
  due_date: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "student" | "admin";
  major: string | null;
};

type SubmissionRow = {
  id: string;
  user_id: string;
  task_id: string;
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

type ReviewerRow = { full_name: string | null };

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

function decodeMessage(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).replaceAll("-", " ").trim();
  } catch {
    return value.replaceAll("-", " ").trim();
  }
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

function getDueDateInfo(dueDateStr: string | null) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (diffDays < 0) return { label: `Overdue · ${formatted}`, cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", urgent: true };
  if (diffDays === 0) return { label: "Due today!", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", urgent: true };
  if (diffDays === 1) return { label: "Due tomorrow", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", urgent: true };
  if (diffDays <= 7) return { label: `Due in ${diffDays} days`, cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", urgent: false };
  return { label: `Due ${formatted}`, cls: "bg-slate-100 text-slate-500", urgent: false };
}

function getTaskStatusClasses(status: string | null) {
  const n = (status || "").toLowerCase();
  if (n === "open") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (n === "closed") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (n === "draft") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-slate-100 text-slate-600";
}

function validateSubmissionByType(args: {
  submissionType: SubmissionType | null;
  content: string;
  linkUrl: string;
  uploadedFile: File | null;
}) {
  const type = args.submissionType || "any";
  const hasText = !!args.content.trim();
  const hasLink = !!args.linkUrl.trim();
  const hasFile = !!args.uploadedFile;
  const isImage = args.uploadedFile?.type?.startsWith("image/") ?? false;
  if (type === "text" && !hasText) return "text-submission-required";
  if (type === "link" && !hasLink) return "link-submission-required";
  if (type === "file" && !hasFile) return "file-submission-required";
  if (type === "image" && !hasFile) return "image-submission-required";
  if (type === "image" && hasFile && !isImage) return "only-image-files-are-allowed";
  if (type === "any" && !hasText && !hasLink && !hasFile) return "please-add-text-link-or-file";
  return null;
}

async function saveSubmission(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const taskId = String(formData.get("task_id") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const linkUrl = String(formData.get("link_url") || "").trim();
  const file = formData.get("file");
  const redirectBase = `/tasks/${taskId}`;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const uploadedFile = file instanceof File && file.size > 0 ? file : null;
  const { data: profile } = await supabase
    .from("profiles").select("id, role, major").eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "admin"; major: string | null }>();
  if (!profile || profile.role !== "student") redirect("/dashboard");
  const { data: task } = await supabase
    .from("tasks").select("id, major, assigned_user_id, submission_type").eq("id", taskId)
    .maybeSingle<{ id: string; major: string | null; assigned_user_id: string | null; submission_type: SubmissionType | null }>();
  if (!task) notFound();
  const canAccessTask =
    task.assigned_user_id === user.id ||
    (!task.assigned_user_id && !!task.major && !!profile.major && task.major === profile.major);
  if (!canAccessTask) notFound();
  const validationError = validateSubmissionByType({ submissionType: task.submission_type, content, linkUrl, uploadedFile });
  if (validationError) redirect(`${redirectBase}?error=${validationError}`);
  const { data: existingSubmission } = await supabase
    .from("submissions").select("id, file_path").eq("task_id", taskId).eq("user_id", user.id)
    .maybeSingle<{ id: string; file_path: string | null }>();
  let file_name: string | null = null;
  let file_path: string | null = existingSubmission?.file_path ?? null;
  let file_url: string | null = null;
  let file_type: string | null = null;
  let file_size: number | null = null;
  if (uploadedFile) {
    const allowedMimeTypes = new Set([
      "application/pdf","application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip","text/plain","image/png","image/jpeg","image/jpg","image/webp","image/gif",
    ]);
    const allowedExtensions = [".pdf",".doc",".docx",".ppt",".pptx",".xls",".xlsx",".zip",".txt",".png",".jpg",".jpeg",".webp",".gif"];
    const lowerName = uploadedFile.name.toLowerCase();
    const hasAllowedExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext));
    if (uploadedFile.type && !allowedMimeTypes.has(uploadedFile.type) && !hasAllowedExtension)
      redirect(`${redirectBase}?error=file-type-not-allowed`);
    if (!uploadedFile.type && !hasAllowedExtension)
      redirect(`${redirectBase}?error=file-type-not-allowed`);
    if (task.submission_type === "image" && !(uploadedFile.type || "").startsWith("image/"))
      redirect(`${redirectBase}?error=only-image-files-are-allowed`);
    const safeFileName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePath = `${user.id}/${taskId}/${Date.now()}-${safeFileName}`;
    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error: uploadError } = await supabase.storage
      .from("submission-files").upload(uniquePath, buffer, {
        contentType: uploadedFile.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) redirect(`${redirectBase}?error=${encodeURIComponent(uploadError.message)}`);
    if (existingSubmission?.file_path) {
      await supabase.storage.from("submission-files").remove([existingSubmission.file_path]);
    }
    const { data: { publicUrl } } = supabase.storage.from("submission-files").getPublicUrl(uniquePath);
    file_name = uploadedFile.name;
    file_path = uniquePath;
    file_url = publicUrl;
    file_type = uploadedFile.type || null;
    file_size = uploadedFile.size;
  } else if (existingSubmission?.id) {
    const { data: currentSubmission } = await supabase
      .from("submissions").select("file_name, file_path, file_url, file_type, file_size")
      .eq("id", existingSubmission.id)
      .maybeSingle<{ file_name: string | null; file_path: string | null; file_url: string | null; file_type: string | null; file_size: number | null }>();
    file_name = currentSubmission?.file_name ?? null;
    file_path = currentSubmission?.file_path ?? null;
    file_url = currentSubmission?.file_url ?? null;
    file_type = currentSubmission?.file_type ?? null;
    file_size = currentSubmission?.file_size ?? null;
  }
  const payload = {
    content: content || "",
    link_url: linkUrl || null,
    file_name, file_path, file_url, file_type, file_size,
    submitted_at: new Date().toISOString(),
  };
  if (existingSubmission) {
    const { error } = await supabase.from("submissions").update(payload).eq("id", existingSubmission.id);
    if (error) redirect(`${redirectBase}?error=${encodeURIComponent(error.message)}`);
  } else {
    const { error } = await supabase.from("submissions").insert({ task_id: taskId, user_id: user.id, ...payload });
    if (error) redirect(`${redirectBase}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/submit`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/admin/tasks");
  redirect(`${redirectBase}?success=submission-saved`);
}

export default async function TaskDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const errorMessage = decodeMessage(resolvedSearchParams.error);
  const successMessage = decodeMessage(resolvedSearchParams.success);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("id, full_name, role, major").eq("id", user.id)
    .maybeSingle<ProfileRow>();
  if (profileError || !profile) notFound();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, description, major, status, created_by, created_at, assignment_type, submission_type, assigned_user_id, due_date")
    .eq("id", id).maybeSingle<TaskRow>();
  if (taskError || !task) notFound();

  const isAdmin = profile.role === "admin";
  const isDirectlyAssigned = task.assigned_user_id === user.id;
  const isMajorTask = !task.assigned_user_id && !!task.major && !!profile.major && task.major === profile.major;
  const canAccessTask = isAdmin || isDirectlyAssigned || isMajorTask;
  if (!canAccessTask) notFound();

  let studentSubmission: SubmissionRow | null = null;
  let reviewerProfile: ReviewerRow | null = null;

  if (profile.role === "student") {
    const { data: submission } = await supabase
      .from("submissions")
      .select("id, user_id, task_id, content, link_url, file_name, file_path, file_url, file_type, file_size, submitted_at, admin_feedback, reviewed_at, reviewed_by")
      .eq("task_id", task.id).eq("user_id", user.id)
      .order("submitted_at", { ascending: false }).limit(1)
      .maybeSingle<SubmissionRow>();
    studentSubmission = submission ?? null;
    if (studentSubmission?.reviewed_by) {
      const { data: reviewer } = await supabase
        .from("profiles").select("full_name").eq("id", studentSubmission.reviewed_by)
        .maybeSingle<ReviewerRow>();
      reviewerProfile = reviewer ?? null;
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto max-w-5xl px-4 md:px-6">

        {/* Back + title */}
        <div className="mb-8">
          <Link
            href="/tasks"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to tasks
          </Link>

          <div className="mt-2 rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getTaskStatusClasses(task.status)}`}>
                {task.status || "open"}
              </span>
              {task.major && (
                <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                  {task.major}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                {getSubmissionTypeLabel(task.submission_type)}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                {formatDate(task.created_at)}
              </span>
              {task.due_date && (() => {
                const info = getDueDateInfo(task.due_date);
                return info ? (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.cls}`}>
                    🗓 {info.label}
                  </span>
                ) : null;
              })()}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {task.title}
            </h1>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Description */}
          <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-4">
              Task Description
            </p>
            <div className="whitespace-pre-wrap text-base leading-7 text-slate-700">
              {task.description || "No description provided."}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-4">
                Task Info
              </p>
              <div className="space-y-4 text-sm">
                {[
                  { label: "Your Role", value: profile.role },
                  { label: "Your Major", value: profile.major || "—" },
                  { label: "Assignment", value: task.assignment_type || "—" },
                  { label: "Submission", value: getSubmissionTypeLabel(task.submission_type) },
                  { label: "Status", value: task.status || "open" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="mt-0.5 capitalize text-slate-500">{item.value}</p>
                  </div>
                ))}
                {task.due_date && (() => {
                  const info = getDueDateInfo(task.due_date);
                  return (
                    <div>
                      <p className="font-medium text-slate-900">Due Date</p>
                      {info ? (
                        <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.cls}`}>
                          🗓 {info.label}
                        </span>
                      ) : (
                        <p className="mt-0.5 text-slate-500">—</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {profile.role === "student" && (
              <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-4">
                  Submission Status
                </p>
                {!studentSubmission ? (
                  <p className="text-sm text-slate-500">Not submitted yet.</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      studentSubmission.reviewed_at
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                    }`}>
                      {studentSubmission.reviewed_at ? "Reviewed" : "Submitted"}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">Submitted at</p>
                      <p className="mt-0.5 text-slate-500">{formatDate(studentSubmission.submitted_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* Student submission form + history */}
        {profile.role === "student" && (
          <>
            {/* Alerts */}
            {(successMessage || errorMessage) && (
              <div className="mt-6 space-y-3">
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
              </div>
            )}

            {/* Submit form */}
            <section className="mt-6 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-1">
                {studentSubmission ? "Update your submission" : "Submit your work"}
              </p>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                {studentSubmission ? "You can update your submission below" : "Upload your work for this task"}
              </h2>

              <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Required type:{" "}
                <span className="font-semibold">{getSubmissionTypeLabel(task.submission_type)}</span>
              </div>

              <form action={saveSubmission} className="space-y-5">
                <input type="hidden" name="task_id" value={task.id} />

                <div>
                  <label htmlFor="content" className="mb-2 block text-sm font-medium text-slate-700">
                    Text Submission
                  </label>
                  <textarea
                    id="content" name="content" rows={7}
                    defaultValue={studentSubmission?.content || ""}
                    className={inputClass}
                    placeholder="Write your work here..."
                  />
                </div>

                <div>
                  <label htmlFor="link_url" className="mb-2 block text-sm font-medium text-slate-700">
                    Link Submission
                  </label>
                  <input
                    id="link_url" name="link_url" type="url"
                    defaultValue={studentSubmission?.link_url || ""}
                    className={inputClass}
                    placeholder="https://example.com/your-work"
                  />
                </div>

                <div>
                  <label htmlFor="file" className="mb-2 block text-sm font-medium text-slate-700">
                    File / Image / Photo
                  </label>
                  <input
                    id="file" name="file" type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.webp,.gif,.txt"
                    className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:!text-white"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Leave empty to keep your existing file.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    {studentSubmission ? "Update Submission" : "Submit Work"}
                  </button>
                </div>
              </form>
            </section>

            {/* Previous submission */}
            {studentSubmission && (
              <section className="mt-6 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-4">
                  Your Submission
                </p>

                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-medium text-slate-900 mb-2">Text</p>
                    <div className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                      {studentSubmission.content || "No text provided."}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900 mb-2">Link</p>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                      {studentSubmission.link_url ? (
                        <a href={studentSubmission.link_url} target="_blank" rel="noreferrer"
                          className="font-medium text-blue-600 hover:underline">
                          {studentSubmission.link_url}
                        </a>
                      ) : "No link provided."}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900 mb-2">File</p>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                      {!studentSubmission.file_url ? "No file uploaded." : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <a href={studentSubmission.file_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                              Open / Download
                            </a>
                            <span className="text-xs text-slate-400">
                              {studentSubmission.file_name || "Uploaded file"}
                              {studentSubmission.file_size ? ` • ${formatFileSize(studentSubmission.file_size)}` : ""}
                            </span>
                          </div>
                          {isImageFile(studentSubmission.file_type, studentSubmission.file_url) && (
                            <img src={studentSubmission.file_url}
                              alt={studentSubmission.file_name || "Submitted image"}
                              className="max-h-80 rounded-2xl border border-slate-200 object-contain" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className={`rounded-2xl border p-5 ${
                    studentSubmission.reviewed_at
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <p className={`text-sm font-semibold ${
                        studentSubmission.reviewed_at ? "text-emerald-900" : "text-slate-900"
                      }`}>
                        Admin Feedback
                      </p>
                      {studentSubmission.reviewed_at && (
                        <span className="text-xs text-emerald-700">
                          Reviewed: {formatDate(studentSubmission.reviewed_at)}
                        </span>
                      )}
                    </div>
                    {studentSubmission.admin_feedback ? (
                      <p className="whitespace-pre-wrap text-sm leading-7 text-emerald-950">
                        {studentSubmission.admin_feedback}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No feedback yet. Waiting for admin review.
                      </p>
                    )}
                    {reviewerProfile && (
                      <p className="mt-4 border-t border-emerald-200 pt-3 text-xs text-emerald-800">
                        Reviewed by:{" "}
                        <span className="font-semibold">{reviewerProfile.full_name || "Admin"}</span>
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}