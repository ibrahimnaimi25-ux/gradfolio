import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/constants";

export type StaffProfile = {
  id: string;
  full_name: string | null;
  role: AppRole;
  /** Set for managers — their assigned major. Null means all-access (admin). */
  assigned_major: string | null;
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
    .select("id, full_name, role, assigned_major")
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
 * - Admin  → null   (no filter, sees everything)
 * - Manager → their assigned_major string (may be "" if misconfigured)
 */
export function getMajorFilter(profile: StaffProfile): string | null {
  if (profile.role === "manager") return profile.assigned_major ?? "";
  return null;
}
