"use server";

import { requireCompany, requireOwnedJob } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/constants";

export async function createJobPost(formData: FormData) {
  const { supabase, user, org } = await requireCompany();

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const location = String(formData.get("location") || "").trim() || null;
  const employmentType = String(formData.get("employment_type") || "internship").trim();
  const requiredTaskId = String(formData.get("required_task_id") || "").trim() || null;
  const minScoreRaw = String(formData.get("min_score") || "").trim();
  const minScore = minScoreRaw
    ? Math.max(1, Math.min(5, parseInt(minScoreRaw, 10)))
    : null;
  const salaryText = String(formData.get("salary_text") || "").trim() || null;
  const majorsRaw = formData
    .getAll("majors")
    .map((v) => String(v))
    .filter(Boolean);
  const deadline = String(formData.get("deadline") || "").trim() || null;

  if (!title) redirect("/company/jobs/new?error=Title+is+required");
  if (!EMPLOYMENT_TYPES.includes(employmentType as EmploymentType)) {
    redirect("/company/jobs/new?error=Invalid+employment+type");
  }

  // Validate required_task_id, if present, is either owned by the caller's
  // org or a platform (org_id IS NULL) task.
  if (requiredTaskId) {
    const { data: t } = await supabase
      .from("tasks")
      .select("id, org_id")
      .eq("id", requiredTaskId)
      .maybeSingle<{ id: string; org_id: string | null }>();
    if (!t || (t.org_id !== null && t.org_id !== org.id)) {
      redirect("/company/jobs/new?error=Invalid+required+task");
    }
  }

  // Shadow mode: dual-write company_id (legacy) + org_id (new).
  const { data: newJob, error } = await supabase
    .from("job_posts")
    .insert({
      company_id: user.id,
      org_id: org.id,
      title,
      description,
      location,
      employment_type: employmentType,
      required_task_id: requiredTaskId,
      min_score: minScore,
      salary_text: salaryText,
      majors: majorsRaw.length > 0 ? majorsRaw : [],
      status: "open",
      deadline,
    })
    .select("id")
    .maybeSingle();

  if (error) redirect(`/company/jobs/new?error=${encodeURIComponent(error.message)}`);

  await logAudit({
    userId: user.id,
    action: "job_post.created",
    entityType: "job_post",
    entityId: newJob?.id,
    metadata: { title, org_id: org.id },
  });

  revalidatePath("/company/jobs");
  revalidatePath("/company/dashboard");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+created");
}

export async function closeJobPost(formData: FormData) {
  const jobId = String(formData.get("job_id") || "").trim();
  if (!jobId) redirect("/company/jobs?error=Missing+job+id");

  const { supabase, org } = await requireOwnedJob(jobId);

  const { error } = await supabase
    .from("job_posts")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("org_id", org.id);

  if (error) redirect(`/company/jobs?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/company/jobs");
  revalidatePath("/company/dashboard");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+closed");
}

export async function reopenJobPost(formData: FormData) {
  const jobId = String(formData.get("job_id") || "").trim();
  if (!jobId) redirect("/company/jobs?error=Missing+job+id");

  const { supabase, org } = await requireOwnedJob(jobId);

  const { error } = await supabase
    .from("job_posts")
    .update({ status: "open", closed_at: null })
    .eq("id", jobId)
    .eq("org_id", org.id);

  if (error) redirect(`/company/jobs?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/company/jobs");
  revalidatePath("/company/dashboard");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+reopened");
}

export async function deleteJobPost(formData: FormData) {
  const jobId = String(formData.get("job_id") || "").trim();
  if (!jobId) redirect("/company/jobs?error=Missing+job+id");

  const { supabase, org } = await requireOwnedJob(jobId);

  const { error } = await supabase
    .from("job_posts")
    .delete()
    .eq("id", jobId)
    .eq("org_id", org.id);

  if (error) redirect(`/company/jobs?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/company/jobs");
  revalidatePath("/company/dashboard");
  revalidatePath("/jobs");
  redirect("/company/jobs?success=Job+deleted");
}
