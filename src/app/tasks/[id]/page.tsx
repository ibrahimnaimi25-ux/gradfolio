import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
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

type ReviewerRow = {
  full_name: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusClasses(status: string | null) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "reviewed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "submitted") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "open") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
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
  if (type === "any" && !hasText && !hasLink && !hasFile) {
    return "please-add-text-link-or-file";
  }

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const uploadedFile = file instanceof File && file.size > 0 ? file : null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, major")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: "student" | "admin"; major: string | null }>();

  if (!profile || profile.role !== "student") {
    redirect("/dashboard");
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id, major, assigned_user_id, submission_type")
    .eq("id", taskId)
    .maybeSingle<{
      id: string;
      major: string | null;
      assigned_user_id: string | null;
      submission_type: SubmissionType | null;
    }>();

  if (!task) {
    notFound();
  }

  const canAccessTask =
    task.assigned_user_id === user.id ||
    (!task.assigned_user_id &&
      !!task.major &&
      !!profile.major &&
      task.major === profile.major);

  if (!canAccessTask) {
    notFound();
  }

  const validationError = validateSubmissionByType({
    submissionType: task.submission_type,
    content,
    linkUrl,
    uploadedFile,
  });

  if (validationError) {
    redirect(`${redirectBase}?error=${validationError}`);
  }

  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("id, file_path")
    .eq("task_id", taskId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; file_path: string | null }>();

  let file_name: string | null = null;
  let file_path: string | null = existingSubmission?.file_path ?? null;
  let file_url: string | null = null;
  let file_type: string | null = null;
  let file_size: number | null = null;

  if (uploadedFile) {
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
      "text/plain",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ]);

    const allowedExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".ppt",
      ".pptx",
      ".xls",
      ".xlsx",
      ".zip",
      ".txt",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
    ];

    const lowerName = uploadedFile.name.toLowerCase();
    const hasAllowedExtension = allowedExtensions.some((ext) =>
      lowerName.endsWith(ext)
    );

    if (
      uploadedFile.type &&
      !allowedMimeTypes.has(uploadedFile.type) &&
      !hasAllowedExtension
    ) {
      redirect(`${redirectBase}?error=file-type-not-allowed`);
    }

    if (!uploadedFile.type && !hasAllowedExtension) {
      redirect(`${redirectBase}?error=file-type-not-allowed`);
    }

    if (
      task.submission_type === "image" &&
      !(uploadedFile.type || "").startsWith("image/")
    ) {
      redirect(`${redirectBase}?error=only-image-files-are-allowed`);
    }

    const safeFileName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePath = `${user.id}/${taskId}/${Date.now()}-${safeFileName}`;

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("submission-files")
      .upload(uniquePath, buffer, {
        contentType: uploadedFile.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      redirect(`${redirectBase}?error=${encodeURIComponent(uploadError.message)}`);
    }

    if (existingSubmission?.file_path) {
      await supabase.storage
        .from("submission-files")
        .remove([existingSubmission.file_path]);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("submission-files").getPublicUrl(uniquePath);

    file_name = uploadedFile.name;
    file_path = uniquePath;
    file_url = publicUrl;
    file_type = uploadedFile.type || null;
    file_size = uploadedFile.size;
  } else if (existingSubmission?.id) {
    const { data: currentSubmission } = await supabase
      .from("submissions")
      .select("file_name, file_path, file_url, file_type, file_size")
      .eq("id", existingSubmission.id)
      .maybeSingle<{
        file_name: string | null;
        file_path: string | null;
        file_url: string | null;
        file_type: string | null;
        file_size: number | null;
      }>();

    file_name = currentSubmission?.file_name ?? null;
    file_path = currentSubmission?.file_path ?? null;
    file_url = currentSubmission?.file_url ?? null;
    file_type = currentSubmission?.file_type ?? null;
    file_size = currentSubmission?.file_size ?? null;
  }

  const payload = {
    content: content || "",
    link_url: linkUrl || null,
    file_name,
    file_path,
    file_url,
    file_type,
    file_size,
    submitted_at: new Date().toISOString(),
  };

  if (existingSubmission) {
    const { error } = await supabase
      .from("submissions")
      .update(payload)
      .eq("id", existingSubmission.id);

    if (error) {
      redirect(`${redirectBase}?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { error } = await supabase.from("submissions").insert({
      task_id: taskId,
      user_id: user.id,
      ...payload,
    });

    if (error) {
      redirect(`${redirectBase}?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/submit`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/admin/tasks");

  redirect(`${redirectBase}?success=submission-saved`);
}

export default async function TaskDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const errorMessage = decodeMessage(resolvedSearchParams.error);
  const successMessage = decodeMessage(resolvedSearchParams.success);

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

  if (profileError || !profile) {
    notFound();
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, title, description, major, status, created_by, created_at, assignment_type, submission_type, assigned_user_id"
    )
    .eq("id", id)
    .maybeSingle<TaskRow>();

  if (taskError || !task) {
    notFound();
  }

  const isAdmin = profile.role === "admin";
  const isDirectlyAssigned = task.assigned_user_id === user.id;
  const isMajorTask =
    !task.assigned_user_id &&
    !!task.major &&
    !!profile.major &&
    task.major === profile.major;

  const canAccessTask = isAdmin || isDirectlyAssigned || isMajorTask;

  if (!canAccessTask) {
    notFound();
  }

  let studentSubmission: SubmissionRow | null = null;
  let reviewerProfile: ReviewerRow | null = null;

  if (profile.role === "student") {
    const { data: submission } = await supabase
      .from("submissions")
      .select(
        "id, user_id, task_id, content, link_url, file_name, file_path, file_url, file_type, file_size, submitted_at, admin_feedback, reviewed_at, reviewed_by"
      )
      .eq("task_id", task.id)
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubmissionRow>();

    studentSubmission = submission ?? null;

    if (studentSubmission?.reviewed_by) {
      const { data: reviewer } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", studentSubmission.reviewed_by)
        .maybeSingle<ReviewerRow>();

      reviewerProfile = reviewer ?? null;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/tasks"
              className="mb-3 inline-flex text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              ← Back to tasks
            </Link>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {task.title}
            </h1>

            <div className="mt-3 flex flex-wrap gap-3">
              {task.major && (
                <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                  Major: {task.major}
                </span>
              )}

              {task.assignment_type && (
                <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
                  Type: {task.assignment_type}
                </span>
              )}

              {task.assigned_user_id && (
                <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                  Directly assigned
                </span>
              )}

              <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                Submission: {getSubmissionTypeLabel(task.submission_type)}
              </span>

              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getStatusClasses(
                  task.status
                )}`}
              >
                {task.status || "open"}
              </span>

              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700">
                Created: {formatDate(task.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Task Description
            </h2>

            <div className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
              {task.description || "No description provided."}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">
                Task Info
              </h3>

              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="font-medium text-slate-900">Your Role</p>
                  <p className="mt-1 capitalize">{profile.role}</p>
                </div>

                <div>
                  <p className="font-medium text-slate-900">Your Major</p>
                  <p className="mt-1">{profile.major || "—"}</p>
                </div>

                <div>
                  <p className="font-medium text-slate-900">Assignment Type</p>
                  <p className="mt-1">{task.assignment_type || "—"}</p>
                </div>

                <div>
                  <p className="font-medium text-slate-900">Submission Type</p>
                  <p className="mt-1">{getSubmissionTypeLabel(task.submission_type)}</p>
                </div>

                <div>
                  <p className="font-medium text-slate-900">Task Status</p>
                  <p className="mt-1">{task.status || "open"}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {profile.role === "student" && (
          <>
            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Submit Your Work
                </h2>
              </div>

              {(successMessage || errorMessage) && (
                <div className="mt-4 space-y-3">
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
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                Required submission type:{" "}
                <span className="font-semibold">{getSubmissionTypeLabel(task.submission_type)}</span>
              </div>

              <form action={saveSubmission} className="mt-5 space-y-5">
                <input type="hidden" name="task_id" value={task.id} />

                <div>
                  <label htmlFor="content" className="mb-2 block text-sm font-medium text-slate-700">
                    Text Submission
                  </label>
                  <textarea
                    id="content"
                    name="content"
                    rows={8}
                    defaultValue={studentSubmission?.content || ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                    placeholder="Write your work here..."
                  />
                </div>

                <div>
                  <label htmlFor="link_url" className="mb-2 block text-sm font-medium text-slate-700">
                    Link Submission
                  </label>
                  <input
                    id="link_url"
                    name="link_url"
                    type="url"
                    defaultValue={studentSubmission?.link_url || ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                    placeholder="https://example.com/your-work"
                  />
                </div>

                <div>
                  <label htmlFor="file" className="mb-2 block text-sm font-medium text-slate-700">
                    File / Image / Photo
                  </label>
                  <input
                    id="file"
                    name="file"
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.webp,.gif,.txt"
                    className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Leave this empty if you only want to update text or link.
                  </p>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {studentSubmission ? "Update Submission" : "Submit Work"}
                </button>
              </form>
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Your Submission
                </h2>
              </div>

              {!studentSubmission ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  You have not submitted this task yet.
                </div>
              ) : (
                <div className="mt-5 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Submission Status
                      </p>
                      <div className="mt-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${
                            studentSubmission.reviewed_at
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }`}
                        >
                          {studentSubmission.reviewed_at ? "Reviewed" : "Submitted"}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Submitted At
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {formatDate(studentSubmission.submitted_at)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">Text Submission</p>
                    <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                      {studentSubmission.content || "No text provided."}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">Link Submission</p>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      {studentSubmission.link_url ? (
                        <a
                          href={studentSubmission.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          {studentSubmission.link_url}
                        </a>
                      ) : (
                        "No link provided."
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">File Submission</p>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      {!studentSubmission.file_url ? (
                        "No file uploaded."
                      ) : (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <a
                              href={studentSubmission.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              Open / Download File
                            </a>

                            <span className="text-xs text-slate-500">
                              {studentSubmission.file_name || "Uploaded file"}
                              {studentSubmission.file_size
                                ? ` • ${formatFileSize(studentSubmission.file_size)}`
                                : ""}
                            </span>
                          </div>

                          {isImageFile(
                            studentSubmission.file_type,
                            studentSubmission.file_url
                          ) && (
                            <img
                              src={studentSubmission.file_url}
                              alt={studentSubmission.file_name || "Submitted image"}
                              className="max-h-[420px] rounded-2xl border border-slate-200 object-contain"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-emerald-900">
                        Admin Feedback
                      </h3>

                      {studentSubmission.reviewed_at && (
                        <span className="text-xs font-medium text-emerald-800">
                          Reviewed: {formatDate(studentSubmission.reviewed_at)}
                        </span>
                      )}
                    </div>

                    {studentSubmission.admin_feedback ? (
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-950">
                        {studentSubmission.admin_feedback}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-emerald-900/80">
                        No feedback yet. Your submission is waiting for admin review.
                      </p>
                    )}

                    {reviewerProfile && (
                      <div className="mt-4 border-t border-emerald-200 pt-4 text-xs text-emerald-900/80">
                        Reviewed by:{" "}
                        <span className="font-semibold text-emerald-950">
                          {reviewerProfile.full_name || "Admin"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}