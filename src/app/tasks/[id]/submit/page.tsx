// ─── DB migrations required ───────────────────────────────────────────────────
// ALTER TABLE submissions ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
// ALTER TABLE tasks ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;
// ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cohort_id uuid;
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";
import { logAudit } from "@/lib/audit";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

type SubmissionType = "any" | "text" | "link" | "file" | "image";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "student" | "admin";
  major: string | null;
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
  created_at: string;
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
  version: number | null;
};

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
  const redirectBase = `/tasks/${taskId}/submit`;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const uploadedFile = file instanceof File && file.size > 0 ? file : null;
  const { data: profile } = await supabase
    .from("profiles").select("id, role, major").eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "admin"; major: string | null }>();
  if (!profile || profile.role !== "student") redirect("/dashboard");
  const { data: task } = await supabase
    .from("tasks").select("id, major, assigned_user_id, submission_type, due_date").eq("id", taskId)
    .maybeSingle<{ id: string; major: string | null; assigned_user_id: string | null; submission_type: SubmissionType | null; due_date: string | null }>();
  if (!task) notFound();

  // Due date enforcement — reject submissions past the deadline
  if (task.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    if (today > due) {
      redirect(`${redirectBase}?error=submission-deadline-has-passed`);
    }
  }
  const canAccessTask =
    task.assigned_user_id === user.id ||
    (!task.assigned_user_id && !!task.major && !!profile.major && task.major === profile.major);
  if (!canAccessTask) notFound();
  const validationError = validateSubmissionByType({ submissionType: task.submission_type, content, linkUrl, uploadedFile });
  if (validationError) redirect(`${redirectBase}?error=${validationError}`);
  const { data: existingSubmission } = await supabase
    .from("submissions").select("id, file_path, version").eq("task_id", taskId).eq("user_id", user.id)
    .maybeSingle<{ id: string; file_path: string | null; version: number | null }>();
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
    const nextVersion = (existingSubmission.version ?? 1) + 1;
    const { error } = await supabase.from("submissions").update({ ...payload, version: nextVersion }).eq("id", existingSubmission.id);
    if (error) redirect(`${redirectBase}?error=${encodeURIComponent(error.message)}`);
  } else {
    const { error } = await supabase.from("submissions").insert({ task_id: taskId, user_id: user.id, ...payload, version: 1 });
    if (error) redirect(`${redirectBase}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/submit`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/admin/tasks");

  // Fire-and-forget audit log
  await logAudit({
    userId: user.id,
    action: existingSubmission ? "submission.updated" : "submission.created",
    entityType: "submission",
    entityId: taskId,
    metadata: { task_id: taskId },
  });

  redirect(`/tasks/${taskId}?success=submission-saved`);
}

export default async function SubmitTaskPage({ params, searchParams }: PageProps) {
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
  if (profileError || !profile) redirect("/login");
  if (profile.role !== "student") redirect("/dashboard");

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, description, major, status, assignment_type, submission_type, assigned_user_id, created_at")
    .eq("id", id).maybeSingle<TaskRow>();
  if (taskError || !task) notFound();

  const canAccessTask =
    task.assigned_user_id === user.id ||
    (!task.assigned_user_id && !!task.major && !!profile.major && task.major === profile.major);
  if (!canAccessTask) notFound();

  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("id, user_id, task_id, content, link_url, file_name, file_path, file_url, file_type, file_size, submitted_at, admin_feedback, reviewed_at, reviewed_by, version")
    .eq("task_id", task.id).eq("user_id", user.id)
    .maybeSingle<SubmissionRow>();

  const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900";

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto max-w-4xl px-4 md:px-6">

        {/* Header */}
        <div className="mb-8">
          <Link href={`/tasks/${task.id}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900">
            ← Back to task
          </Link>
          <div className="mt-2 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Submit Work
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {task.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {existingSubmission ? "Update your existing submission below." : "Submit your work for this task."}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* Task description */}
          <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Task Description
            </p>
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {task.description || "No description provided."}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {task.major && (
                <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                  {task.major}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                {getSubmissionTypeLabel(task.submission_type)}
              </span>
              {task.status && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                  {task.status}
                </span>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Current Submission
            </p>
            {!existingSubmission ? (
              <p className="text-sm text-slate-500">No submission yet.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">Last submitted</p>
                  <p className="mt-0.5 text-slate-500">{formatDate(existingSubmission.submitted_at)}</p>
                </div>
                {existingSubmission.version && existingSubmission.version > 1 && (
                  <div>
                    <p className="font-medium text-slate-900">Version</p>
                    <p className="mt-0.5 text-slate-500">v{existingSubmission.version}</p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-900">Review status</p>
                  <p className="mt-0.5 text-slate-500">
                    {existingSubmission.reviewed_at ? "Reviewed" : "Waiting for review"}
                  </p>
                </div>
                {existingSubmission.file_name && (
                  <div>
                    <p className="font-medium text-slate-900">Current file</p>
                    <p className="mt-0.5 text-slate-500">
                      {existingSubmission.file_name}
                      {existingSubmission.file_size ? ` • ${formatFileSize(existingSubmission.file_size)}` : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

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

        {/* Form */}
        <section className="mt-6 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
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
              <textarea id="content" name="content" rows={7}
                defaultValue={existingSubmission?.content || ""}
                className={inputClass} placeholder="Write your work here..." />
            </div>

            <div>
              <label htmlFor="link_url" className="mb-2 block text-sm font-medium text-slate-700">
                Link Submission
              </label>
              <input id="link_url" name="link_url" type="url"
                defaultValue={existingSubmission?.link_url || ""}
                className={inputClass} placeholder="https://example.com/your-work" />
            </div>

            <div>
              <label htmlFor="file" className="mb-2 block text-sm font-medium text-slate-700">
                File / Image / Photo
              </label>
              <input id="file" name="file" type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.webp,.gif,.txt"
                className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:!text-white" />
              <p className="mt-2 text-xs text-slate-400">Leave empty to keep your existing file.</p>
            </div>

            {existingSubmission?.file_url && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-medium text-slate-900">Current uploaded file</p>
                <div className="space-y-3">
                  <a href={existingSubmission.file_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium !text-white transition hover:bg-slate-700">
                    Open / Download
                  </a>
                  <p className="text-xs text-slate-400">
                    {existingSubmission.file_name || "Uploaded file"}
                    {existingSubmission.file_size ? ` • ${formatFileSize(existingSubmission.file_size)}` : ""}
                  </p>
                  {isImageFile(existingSubmission.file_type, existingSubmission.file_url) && (
                    <img src={existingSubmission.file_url}
                      alt={existingSubmission.file_name || "Submitted image"}
                      className="max-h-72 rounded-2xl border border-slate-200 object-contain" />
                  )}
                </div>
              </div>
            )}

            <div className="pt-2">
              <SubmitButton
                label={existingSubmission ? "Update Submission" : "Submit Work"}
                loadingLabel={existingSubmission ? "Updating…" : "Submitting…"}
              />
            </div>
          </form>
        </section>

      </div>
    </main>
  );
}