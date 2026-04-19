import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { findQualifyingSubmission, type JobPostRow } from "@/lib/jobs";
import {
  EMPLOYMENT_TYPE_LABELS,
  JOB_APP_STATUS_LABELS,
  JOB_APP_STATUS_CLASSES,
  type EmploymentType,
  type JobAppStatus,
} from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Job Details | GradFolio" };

type CompanyRow = {
  id: string;
  name: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  major: string | null;
};

type ExistingAppRow = {
  id: string;
  status: string;
  cover_note: string | null;
  applied_at: string | null;
  qualifying_submission_id: string | null;
};

function decodeMessage(v: string | undefined) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

async function applyToJob(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jobId = String(formData.get("job_id") || "").trim();
  const coverNote = String(formData.get("cover_note") || "").trim() || null;
  if (!jobId) redirect("/jobs?error=Missing+job+id");

  // Verify student role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();
  if (!profile || profile.role !== "student") {
    redirect(`/jobs/${jobId}?error=Only+students+can+apply`);
  }

  // Fetch job + verify still open
  const { data: job } = await supabase
    .from("job_posts")
    .select("id, required_task_id, min_score, status")
    .eq("id", jobId)
    .maybeSingle<Pick<JobPostRow, "id" | "required_task_id" | "min_score" | "status">>();
  if (!job) redirect("/jobs?error=Job+not+found");
  if (job.status !== "open") {
    redirect(`/jobs/${jobId}?error=This+job+is+no+longer+accepting+applications`);
  }

  // Verify qualification at apply-time
  const qualifying = await findQualifyingSubmission(supabase, user.id, job);
  if (!qualifying) {
    redirect(`/jobs/${jobId}?error=You+don%27t+meet+the+requirements+for+this+role`);
  }

  const submissionIdToLink =
    qualifying.id === "__no_gate__" ? null : qualifying.id;

  const { error } = await supabase.from("job_applications").insert({
    job_id: jobId,
    user_id: user.id,
    qualifying_submission_id: submissionIdToLink,
    cover_note: coverNote,
    status: "submitted",
  });

  if (error) {
    // Probably unique violation — already applied
    const message = error.message.includes("duplicate")
      ? "You've already applied to this job"
      : error.message;
    redirect(`/jobs/${jobId}?error=${encodeURIComponent(message)}`);
  }

  await logAudit({
    userId: user.id,
    action: "job_application.submitted",
    entityType: "job_post",
    entityId: jobId,
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect(`/jobs/${jobId}?success=Application+submitted`);
}

async function withdrawApplication(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const appId = String(formData.get("application_id") || "").trim();
  const jobId = String(formData.get("job_id") || "").trim();
  if (!appId || !jobId) redirect("/jobs?error=Missing+ids");

  const { error } = await supabase
    .from("job_applications")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", appId)
    .eq("user_id", user.id);

  if (error) redirect(`/jobs/${jobId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  redirect(`/jobs/${jobId}?success=Application+withdrawn`);
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const success = decodeMessage(sp.success);
  const error = decodeMessage(sp.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job } = await supabase
    .from("job_posts")
    .select(
      "id, org_id, title, description, location, employment_type, required_task_id, min_score, salary_text, majors, status, deadline, created_at, closed_at"
    )
    .eq("id", id)
    .maybeSingle<JobPostRow>();

  if (!job) notFound();

  const { data: company } = job.org_id
    ? await supabase
        .from("organizations")
        .select("id, name, industry, website, description")
        .eq("id", job.org_id)
        .maybeSingle<CompanyRow>()
    : { data: null };

  let requiredTask: TaskRow | null = null;
  if (job.required_task_id) {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, major")
      .eq("id", job.required_task_id)
      .maybeSingle<TaskRow>();
    requiredTask = data ?? null;
  }

  // Viewer-specific state
  let viewerRole: string | null = null;
  let qualifies = false;
  let existingApp: ExistingAppRow | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>();
    viewerRole = profile?.role ?? null;

    if (viewerRole === "student") {
      const qualifying = await findQualifyingSubmission(supabase, user.id, job);
      qualifies = !!qualifying;

      const { data: app } = await supabase
        .from("job_applications")
        .select("id, status, cover_note, applied_at, qualifying_submission_id")
        .eq("job_id", job.id)
        .eq("user_id", user.id)
        .maybeSingle<ExistingAppRow>();
      existingApp = app ?? null;
    }
  }

  const isStudent = viewerRole === "student";
  const canApply = isStudent && qualifies && !existingApp && job.status === "open";
  const daysLeft = job.deadline
    ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-3xl px-4 md:px-6 space-y-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to jobs
        </Link>

        {(success || error) && (
          <div className="space-y-3">
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                ✓ {success}
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                ✗ {error}
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
            {company?.name ?? "Company"}
            {company?.industry ? ` · ${company.industry}` : ""}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {job.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
              {EMPLOYMENT_TYPE_LABELS[job.employment_type as EmploymentType] ??
                job.employment_type}
            </span>
            {job.location && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                📍 {job.location}
              </span>
            )}
            {job.salary_text && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                💵 {job.salary_text}
              </span>
            )}
            {daysLeft !== null && daysLeft >= 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                ⏱ {daysLeft === 0 ? "Closes today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
              </span>
            )}
            {job.status !== "open" && (
              <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                {job.status}
              </span>
            )}
          </div>

          {job.majors && job.majors.length > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              🎓 For students in: <span className="font-medium text-slate-700">{job.majors.join(", ")}</span>
            </p>
          )}
        </section>

        {/* Description */}
        {job.description && (
          <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">About this role</h2>
            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {job.description}
            </div>
          </section>
        )}

        {/* Company */}
        {company?.description && (
          <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              About {company.name}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {company.description}
            </p>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Visit website →
              </a>
            )}
          </section>
        )}

        {/* Task gate info */}
        {requiredTask && (
          <section className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-6">
            <h2 className="text-sm font-semibold text-indigo-900">Requirements to apply</h2>
            <p className="mt-2 text-sm text-indigo-800">
              This role requires an <strong>approved submission</strong> for:
            </p>
            <Link
              href={`/tasks/${requiredTask.id}`}
              className="mt-2 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100 hover:bg-indigo-100"
            >
              {requiredTask.title}
              {requiredTask.major ? ` — ${requiredTask.major}` : ""}
            </Link>
            {job.min_score && (
              <p className="mt-2 text-xs text-indigo-700">
                Minimum score required: <strong>{job.min_score}+ / 5</strong>
              </p>
            )}
          </section>
        )}

        {/* Apply section */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          {!user ? (
            <div className="text-center">
              <p className="text-sm text-slate-600">You need an account to apply.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Create an account
                </Link>
              </div>
            </div>
          ) : !isStudent ? (
            <p className="text-sm text-slate-600">
              Only students can apply for jobs. If you&apos;re a company representative, you can
              manage your postings from your dashboard.
            </p>
          ) : existingApp ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Your application</h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    JOB_APP_STATUS_CLASSES[existingApp.status as JobAppStatus] ??
                    "bg-slate-100 text-slate-600"
                  }`}
                >
                  {JOB_APP_STATUS_LABELS[existingApp.status as JobAppStatus] ??
                    existingApp.status}
                </span>
              </div>
              {existingApp.applied_at && (
                <p className="text-xs text-slate-500">
                  Applied on{" "}
                  {new Date(existingApp.applied_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {existingApp.cover_note && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your cover note
                  </p>
                  <p className="whitespace-pre-wrap">{existingApp.cover_note}</p>
                </div>
              )}
              {existingApp.status !== "withdrawn" && existingApp.status !== "hired" && (
                <form action={withdrawApplication}>
                  <input type="hidden" name="application_id" value={existingApp.id} />
                  <input type="hidden" name="job_id" value={job.id} />
                  <button
                    type="submit"
                    className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                  >
                    Withdraw application
                  </button>
                </form>
              )}
            </div>
          ) : job.status !== "open" ? (
            <p className="text-sm text-slate-600">This job is no longer accepting applications.</p>
          ) : !qualifies ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-semibold text-amber-900">🔒 Apply locked</h2>
              <p className="mt-1 text-sm text-amber-800">
                You need an approved submission
                {job.min_score ? ` with a score of ${job.min_score} or higher` : ""} for{" "}
                <strong>{requiredTask?.title ?? "the required task"}</strong> before you can apply.
              </p>
              {requiredTask && (
                <Link
                  href={`/tasks/${requiredTask.id}`}
                  className="mt-3 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Start the task →
                </Link>
              )}
            </div>
          ) : canApply ? (
            <form action={applyToJob} className="space-y-4">
              <input type="hidden" name="job_id" value={job.id} />
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                ✓ You qualify for this role — your approved submission will be attached
                automatically.
              </div>
              <div>
                <label
                  htmlFor="cover_note"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Cover note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="cover_note"
                  name="cover_note"
                  rows={5}
                  maxLength={2000}
                  placeholder="Tell the company why you're a great fit for this role…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Submit application
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
