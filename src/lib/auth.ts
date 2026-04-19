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
};

export type Organization = {
  id: string;
  type: "company" | "university";
  slug: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  size: string | null;
  status: string;
  verified_at: string | null;
  owner_user_id: string | null;
  plan: string;
  plan_status: string;
  plan_seats: number;
  plan_renews_at: string | null;
};

export type OrgMembership = {
  org_id: string;
  user_id: string;
  role_in_org: "owner" | "manager" | "recruiter" | "advisor" | "member";
  status: string;
  joined_at: string;
};

/**
 * Require a company account. Also loads the caller's primary company
 * organization and their membership in it. Both are guaranteed non-null
 * on success — Phase 9's backfill creates one org per company profile.
 *
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
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle<CompanyProfile>();

  if (!profile || profile.role !== "company") {
    redirect("/dashboard");
  }

  // Find the primary company org for this user. Prefer owned orgs; fall
  // back to any active company membership.
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id, user_id, role_in_org, status, joined_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .returns<OrgMembership[]>();

  const allMemberships = memberships ?? [];
  if (allMemberships.length === 0) {
    // Backfill should have created one. If not, the user is mid-migration.
    redirect("/company/dashboard?error=Organization+not+found");
  }

  const ownerFirst = [...allMemberships].sort((a, b) =>
    a.role_in_org === "owner" ? -1 : b.role_in_org === "owner" ? 1 : 0
  );

  const orgIds = ownerFirst.map((m) => m.org_id);
  const { data: orgs } = await supabase
    .from("organizations")
    .select(
      "id, type, slug, name, logo_url, website, description, industry, size, status, verified_at, owner_user_id, plan, plan_status, plan_seats, plan_renews_at"
    )
    .in("id", orgIds)
    .eq("type", "company")
    .returns<Organization[]>();

  const orgsById = new Map((orgs ?? []).map((o) => [o.id, o]));
  const primary = ownerFirst
    .map((m) => orgsById.get(m.org_id))
    .find((o): o is Organization => !!o);

  if (!primary) {
    redirect("/company/dashboard?error=Organization+not+found");
  }

  const membership = ownerFirst.find((m) => m.org_id === primary.id)!;

  return { supabase, user, profile, org: primary, membership };
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
  org_id: string | null;
  task_source: string | null;
};

/**
 * Require a company account AND that the given task belongs to their org.
 */
export async function requireOwnedTask(taskId: string) {
  const ctx = await requireCompany();
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select(
      "id, title, description, major, status, submission_type, due_date, section_id, archived_at, created_at, org_id, task_source"
    )
    .eq("id", taskId)
    .eq("org_id", ctx.org.id)
    .eq("task_source", "company")
    .maybeSingle<OwnedTask>();

  if (!task) redirect("/company/tasks?error=Task+not+found");
  return { ...ctx, task };
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
  org_id: string | null;
};

/**
 * Require a company account AND that the given job post belongs to their org.
 */
export async function requireOwnedJob(jobId: string) {
  const ctx = await requireCompany();
  const { data: job } = await ctx.supabase
    .from("job_posts")
    .select(
      "id, title, description, location, employment_type, required_task_id, min_score, salary_text, majors, status, deadline, created_at, closed_at, org_id"
    )
    .eq("id", jobId)
    .eq("org_id", ctx.org.id)
    .maybeSingle<OwnedJob>();

  if (!job) redirect("/company/jobs?error=Job+not+found");
  return { ...ctx, job };
}
