import { requireCompany } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { logAudit } from "@/lib/audit";
import { getMajorNames } from "@/lib/majors-db";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
} from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Job | GradFolio" };

type JobPostRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string;
  required_task_id: string | null;
  min_score: number | null;
  salary_text: string | null;
  majors: string[] | null;
  status: string;
  deadline: string | null;
};

type TaskOption = {
  id: string;
  title: string;
  major: string | null;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

async function updateJobPost(formData: FormData) {
  "use server";
  const { supabase, user } = await requireCompany();

  const jobId = String(formData.get("job_id") || "").trim();
  if (!jobId) redirect("/company/jobs?error=Missing+job+id");

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const location = String(formData.get("location") || "").trim() || null;
  const employmentType = String(formData.get("employment_type") || "internship").trim();
  const requiredTaskId = String(formData.get("required_task_id") || "").trim() || null;
  const minScoreRaw = String(formData.get("min_score") || "").trim();
  const minScore = minScoreRaw ? Math.max(1, Math.min(5, parseInt(minScoreRaw, 10))) : null;
  const salaryText = String(formData.get("salary_text") || "").trim() || null;
  const majorsRaw = formData.getAll("majors").map((v) => String(v)).filter(Boolean);
  const deadline = String(formData.get("deadline") || "").trim() || null;

  if (!title) redirect(`/company/jobs/${jobId}/edit?error=Title+is+required`);
  if (!EMPLOYMENT_TYPES.includes(employmentType as EmploymentType)) {
    redirect(`/company/jobs/${jobId}/edit?error=Invalid+employment+type`);
  }

  const { data, error } = await supabase
    .from("job_posts")
    .update({
      title,
      description,
      location,
      employment_type: employmentType,
      required_task_id: requiredTaskId,
      min_score: minScore,
      salary_text: salaryText,
      majors: majorsRaw,
      deadline,
    })
    .eq("id", jobId)
    .eq("company_id", user.id)
    .select("id");

  if (error) redirect(`/company/jobs/${jobId}/edit?error=${encodeURIComponent(error.message)}`);
  if (!data || data.length === 0) {
    redirect("/company/jobs?error=Job+not+found+or+access+denied");
  }

  await logAudit({
    userId: user.id,
    action: "job_post.updated",
    entityType: "job_post",
    entityId: jobId,
  });

  revalidatePath("/company/jobs");
  revalidatePath(`/company/jobs/${jobId}/edit`);
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  redirect("/company/jobs?success=Job+updated");
}

function decodeMessage(v: string | undefined) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export default async function EditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const error = decodeMessage(sp.error);

  const { supabase, user } = await requireCompany();

  const { data: job } = await supabase
    .from("job_posts")
    .select(
      "id, company_id, title, description, location, employment_type, required_task_id, min_score, salary_text, majors, status, deadline"
    )
    .eq("id", id)
    .eq("company_id", user.id)
    .maybeSingle<JobPostRow>();

  if (!job) notFound();

  const { data: companyTasks } = await supabase
    .from("tasks")
    .select("id, title, major")
    .eq("company_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<TaskOption[]>();

  const { data: platformTasks } = await supabase
    .from("tasks")
    .select("id, title, major")
    .is("company_id", null)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<TaskOption[]>();

  const majorNames = await getMajorNames(supabase);
  const selectedMajors = new Set(job.majors ?? []);

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-3xl px-4 md:px-6 space-y-6">
        <Link
          href="/company/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to jobs
        </Link>

        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit job post</h1>
          <p className="mt-1 text-sm text-slate-500">Update details or the gating requirement.</p>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
              ✗ {error}
            </div>
          )}

          <form action={updateJobPost} className="mt-6 space-y-5">
            <input type="hidden" name="job_id" value={job.id} />

            <div>
              <label htmlFor="title" className={labelClass}>
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={job.title}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={job.description ?? ""}
                className={inputClass}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="employment_type" className={labelClass}>
                  Type
                </label>
                <select
                  id="employment_type"
                  name="employment_type"
                  defaultValue={job.employment_type}
                  className={inputClass}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EMPLOYMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="location" className={labelClass}>
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  defaultValue={job.location ?? ""}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="deadline" className={labelClass}>
                  Deadline
                </label>
                <input
                  id="deadline"
                  name="deadline"
                  type="date"
                  defaultValue={job.deadline ?? ""}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="salary_text" className={labelClass}>
                Compensation
              </label>
              <input
                id="salary_text"
                name="salary_text"
                type="text"
                defaultValue={job.salary_text ?? ""}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Target majors{" "}
                <span className="font-normal text-slate-400">(empty = all majors)</span>
              </label>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 md:grid-cols-3">
                {majorNames.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      name="majors"
                      value={m}
                      defaultChecked={selectedMajors.has(m)}
                      className="rounded"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-4">
              <p className="text-sm font-semibold text-indigo-900">Task gate</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="required_task_id" className={labelClass}>
                    Required task
                  </label>
                  <select
                    id="required_task_id"
                    name="required_task_id"
                    defaultValue={job.required_task_id ?? ""}
                    className={inputClass}
                  >
                    <option value="">No task required</option>
                    {(companyTasks ?? []).length > 0 && (
                      <optgroup label="My company tasks">
                        {(companyTasks ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                            {t.major ? ` — ${t.major}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {(platformTasks ?? []).length > 0 && (
                      <optgroup label="Platform tasks">
                        {(platformTasks ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                            {t.major ? ` — ${t.major}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="min_score" className={labelClass}>
                    Minimum score
                  </label>
                  <select
                    id="min_score"
                    name="min_score"
                    defaultValue={job.min_score?.toString() ?? ""}
                    className={inputClass}
                  >
                    <option value="">No minimum</option>
                    <option value="3">★★★☆☆ 3+</option>
                    <option value="4">★★★★☆ 4+</option>
                    <option value="5">★★★★★ 5</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Save changes
              </button>
              <Link
                href="/company/jobs"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
