import { requireStaff, getMajorFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview | GradFolio" };

export default async function AdminOverviewPage() {
  const { profile } = await requireStaff();
  const supabase = await createClient();
  const majorFilter = getMajorFilter(profile);
  const isAdmin = profile.role === "admin";

  // ── Core counts ─────────────────────────────────────────────────────────────

  // Students
  const { count: studentCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "student");

  // Tasks
  let tasksQuery = supabase
    .from("tasks")
    .select("*", { count: "exact", head: true });
  if (majorFilter) tasksQuery = tasksQuery.eq("major", majorFilter);
  const { count: totalTasks } = await tasksQuery;

  let openTasksQuery = supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");
  if (majorFilter) openTasksQuery = openTasksQuery.eq("major", majorFilter);
  const { count: openTasks } = await openTasksQuery;

  // Submissions
  let subQuery = supabase
    .from("submissions")
    .select("*", { count: "exact", head: true });
  if (majorFilter) {
    const { data: majorTaskIds } = await supabase
      .from("tasks")
      .select("id")
      .eq("major", majorFilter);
    const ids = (majorTaskIds ?? []).map((t: any) => t.id);
    if (ids.length > 0) subQuery = subQuery.in("task_id", ids);
    else subQuery = subQuery.eq("task_id", "00000000-0000-0000-0000-000000000000");
  }
  const { count: totalSubmissions } = await subQuery;

  // Pending reviews
  let pendingQuery = supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .is("reviewed_at", null);
  if (majorFilter) {
    const { data: majorTaskIds } = await supabase
      .from("tasks")
      .select("id")
      .eq("major", majorFilter);
    const ids = (majorTaskIds ?? []).map((t: any) => t.id);
    if (ids.length > 0) pendingQuery = pendingQuery.in("task_id", ids);
    else pendingQuery = pendingQuery.eq("task_id", "00000000-0000-0000-0000-000000000000");
  }
  const { count: pendingReviews } = await pendingQuery;

  // Approved / needs revision
  let approvedQuery = supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "approved");
  let revisionQuery = supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "needs_revision");
  if (majorFilter) {
    const { data: majorTaskIds } = await supabase
      .from("tasks")
      .select("id")
      .eq("major", majorFilter);
    const ids = (majorTaskIds ?? []).map((t: any) => t.id);
    if (ids.length > 0) {
      approvedQuery = approvedQuery.in("task_id", ids);
      revisionQuery = revisionQuery.in("task_id", ids);
    }
  }
  const [{ count: approvedCount }, { count: revisionCount }] = await Promise.all([
    approvedQuery,
    revisionQuery,
  ]);

  // Sections
  let sectionsQuery = supabase
    .from("sections")
    .select("*", { count: "exact", head: true });
  if (majorFilter) sectionsQuery = sectionsQuery.eq("major", majorFilter);
  const { count: sectionCount } = await sectionsQuery;

  // Recent submissions (last 10)
  type SubRow = {
    id: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    review_status: string | null;
    user_id: string;
    task_id: string;
  };
  let recentQuery = supabase
    .from("submissions")
    .select("id, submitted_at, reviewed_at, review_status, user_id, task_id")
    .order("submitted_at", { ascending: false })
    .limit(8);
  if (majorFilter) {
    const { data: majorTaskIds } = await supabase
      .from("tasks")
      .select("id")
      .eq("major", majorFilter);
    const ids = (majorTaskIds ?? []).map((t: any) => t.id);
    if (ids.length > 0) recentQuery = recentQuery.in("task_id", ids);
  }
  const { data: recentSubs } = await recentQuery.returns<SubRow[]>();

  // Enrich recent submissions with profile + task names
  const recentList = recentSubs ?? [];
  const userIds = [...new Set(recentList.map((s) => s.user_id))];
  const taskIds = [...new Set(recentList.map((s) => s.task_id))];

  const [{ data: profRows }, { data: taskRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", userIds),
    supabase.from("tasks").select("id, title").in("id", taskIds),
  ]);

  const profMap = Object.fromEntries(
    (profRows ?? []).map((p: any) => [p.id, p.full_name])
  );
  const taskMap = Object.fromEntries(
    (taskRows ?? []).map((t: any) => [t.id, t.title])
  );

  // Submission breakdown by status
  const reviewRate =
    totalSubmissions && totalSubmissions > 0
      ? Math.round(((totalSubmissions - (pendingReviews ?? 0)) / totalSubmissions) * 100)
      : 0;

  function relativeTime(iso: string | null) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  const statusConfig: Record<string, { label: string; cls: string }> = {
    approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
    needs_revision: { label: "Revision", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
    pending: { label: "Pending", cls: "bg-slate-100 text-slate-600" },
  };

  const stats = [
    {
      label: "Total Students",
      value: studentCount ?? 0,
      icon: "👤",
      color: "bg-indigo-50",
      iconColor: "text-indigo-600",
      href: "/admin/students",
      show: isAdmin,
    },
    {
      label: "Open Tasks",
      value: openTasks ?? 0,
      sub: `of ${totalTasks ?? 0} total`,
      icon: "📋",
      color: "bg-sky-50",
      iconColor: "text-sky-600",
      href: "/admin/tasks",
      show: true,
    },
    {
      label: "Total Sections",
      value: sectionCount ?? 0,
      icon: "📂",
      color: "bg-violet-50",
      iconColor: "text-violet-600",
      href: "/admin/sections",
      show: true,
    },
    {
      label: "Total Submissions",
      value: totalSubmissions ?? 0,
      sub: `${reviewRate}% reviewed`,
      icon: "📝",
      color: "bg-amber-50",
      iconColor: "text-amber-600",
      href: "/admin/submissions",
      show: true,
    },
    {
      label: "Pending Reviews",
      value: pendingReviews ?? 0,
      icon: "⏳",
      color: pendingReviews && pendingReviews > 0 ? "bg-rose-50" : "bg-slate-50",
      iconColor: pendingReviews && pendingReviews > 0 ? "text-rose-600" : "text-slate-400",
      href: "/admin/submissions",
      show: true,
    },
    {
      label: "Approved",
      value: approvedCount ?? 0,
      icon: "✅",
      color: "bg-emerald-50",
      iconColor: "text-emerald-600",
      href: "/admin/submissions",
      show: true,
    },
  ].filter((s) => s.show);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-1">
          {isAdmin ? "Super Admin" : `Manager — ${profile.assigned_major ?? ""}`}
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin
            ? "Real-time stats across all majors and students."
            : `Stats for ${profile.assigned_major ?? "your major"}.`}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group flex items-start gap-4 rounded-3xl border border-black/5 bg-white p-6 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {stat.label}
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 leading-none">
                {stat.value.toLocaleString()}
              </p>
              {stat.sub && (
                <p className="mt-1 text-xs text-slate-400">{stat.sub}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Submission health bar */}
      {(totalSubmissions ?? 0) > 0 && (
        <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Submission Breakdown
          </h2>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden flex">
              {/* Approved */}
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{
                  width: `${Math.round(((approvedCount ?? 0) / (totalSubmissions ?? 1)) * 100)}%`,
                }}
              />
              {/* Needs revision */}
              <div
                className="h-full bg-amber-400 transition-all"
                style={{
                  width: `${Math.round(((revisionCount ?? 0) / (totalSubmissions ?? 1)) * 100)}%`,
                }}
              />
              {/* Pending */}
              <div
                className="h-full bg-slate-300 transition-all"
                style={{
                  width: `${Math.round(((pendingReviews ?? 0) / (totalSubmissions ?? 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 inline-block" />
              Approved ({approvedCount ?? 0})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400 inline-block" />
              Needs Revision ({revisionCount ?? 0})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 inline-block" />
              Pending ({pendingReviews ?? 0})
            </span>
          </div>
        </section>
      )}

      {/* Recent submissions */}
      {recentList.length > 0 && (
        <section className="rounded-3xl border border-black/5 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Recent Submissions
            </h2>
            <Link
              href="/admin/submissions"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {recentList.map((sub) => {
              const cfg = statusConfig[sub.review_status ?? "pending"] ?? statusConfig.pending;
              return (
                <li key={sub.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {taskMap[sub.task_id] ?? "Unknown task"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {profMap[sub.user_id] ?? "Student"} · {relativeTime(sub.submitted_at)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/admin/tasks", label: "Manage Tasks", icon: "📋" },
          { href: "/admin/sections", label: "Manage Sections", icon: "📂" },
          { href: "/admin/submissions", label: "Review Submissions", icon: "📝" },
          { href: "/admin/students", label: "Student Directory", icon: "👤", adminOnly: true },
        ]
          .filter((l) => !l.adminOnly || isAdmin)
          .map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm transition hover:shadow-md hover:text-indigo-700"
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
              <span className="ml-auto text-slate-300 group-hover:text-indigo-300">→</span>
            </Link>
          ))}
      </section>
    </div>
  );
}
