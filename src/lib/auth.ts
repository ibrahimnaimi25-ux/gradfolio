import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/constants";

export type StaffProfile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  /** Legacy single-major field. Prefer assigned_majors when available. */
  assigned_major: string | null;
  /** Multi-major support: list of majors a manager can access. */
  assigned_majors: string[] | null;
};

/**
 * Require admin OR manager.
 * Redirects students to /dashboard and unauthenticated users to /login.
 */
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, assigned_major, assigned_majors")
    .eq("id", user.id)
    .maybeSingle<StaffProfile>();

  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    redirect("/dashboard");
  }

  return { supabase, user, profile };
}

/**
 * Require super admin only.
 * Managers are redirected to /dashboard.
 */
export async function requireSuperAdmin() {
  const ctx = await requireStaff();
  if (ctx.profile.role !== "admin") redirect("/dashboard");
  return ctx;
}

/**
 * Returns the major filter to apply to Supabase queries.
 * - Admin   → null  (no filter, sees everything)
 * - Manager → string[] of their assigned majors (use .in("major", filter))
 */
export function getMajorFilter(profile: StaffProfile): string[] | null {
  if (profile.role !== "manager") return null;
  if (profile.assigned_majors && profile.assigned_majors.length > 0) {
    return profile.assigned_majors;
  }
  if (profile.assigned_major) return [profile.assigned_major];
  return [];
}

/**
 * Returns a display-friendly string of the manager's assigned major(s).
 */
export function getMajorLabel(profile: StaffProfile): string {
  const filter = getMajorFilter(profile);
  if (!filter || filter.length === 0) return "";
  return filter.join(", ");
}

export type CompanyProfile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  company_name: string | null;
  industry: string | null;
  company_website: string | null;
  company_size: string | null;
  company_description: string | null;
};

/**
 * Require a company account.
 * Redirects non-company users to /dashboard and guests to /login.
 */
export async function requireCompany() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_name, industry, company_website, company_size, company_description")
    .eq("id", user.id)
    .maybeSingle<CompanyProfile>();

  if (!profile || profile.role !== "company") {
    redirect("/dashboard");
  }

  return { supabase, user, profile };
}

export type OwnedTask = {
  id: string;
  title: string;
  description: string | null;
  major: string | null;
  status: string | null;
  submission_type: string | null;
  due_date: string | null;
  section_id: string | null;
  archived_at: string | null;
  created_at: string;
  company_id: string | null;
  task_source: string | null;
};

/**
 * Require a company account AND that the given task belongs to them.
 * Redirects to the tasks list with an error if the task is missing
 * or owned by someone else.
 */
export async function requireOwnedTask(taskId: string) {
  const { supabase, user, profile } = await requireCompany();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, title, description, major, status, submission_type, due_date, section_id, archived_at, created_at, company_id, task_source"
    )
    .eq("id", taskId)
    .eq("company_id", user.id)
    .eq("task_source", "company")
    .maybeSingle<OwnedTask>();

  if (!task) redirect("/company/tasks?error=Task+not+found");
  return { supabase, user, profile, task };
}

export type OwnedJob = {
  id: string;
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
  created_at: string;
  closed_at: string | null;
  company_id: string | null;
};

/**
 * Require a company account AND that the given job post belongs to them.
 */
export async function requireOwnedJob(jobId: string) {
  const { supabase, user, profile } = await requireCompany();
  const { data: job } = await supabase
    .from("job_posts")
    .select(
      "id, title, description, location, employment_type, required_task_id, min_score, salary_text, majors, status, deadline, created_at, closed_at, company_id"
    )
    .eq("id", jobId)
    .eq("company_id", user.id)
    .maybeSingle<OwnedJob>();

  if (!job) redirect("/company/jobs?error=Job+not+found");
  return { supabase, user, profile, job };
}
