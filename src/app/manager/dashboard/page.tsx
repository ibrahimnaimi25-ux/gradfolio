import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

/**
 * Managers share the staff UI with admins but are scoped to their
 * assigned major(s). We centralize staff experience at /admin/overview;
 * this route just guarantees the manager lands somewhere sensible on
 * login (middleware + auth-form route managers here).
 */
export default async function ManagerDashboardPage() {
  await requireStaff();
  redirect("/admin/overview");
}
