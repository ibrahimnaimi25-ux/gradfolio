import Link from "next/link";
import { requireCompany } from "@/lib/auth";
import KpiTile from "@/components/company/KpiTile";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard | GradFolio" };

type SearchParams = Promise<{ welcome?: string }>;

type TaskRow = { id: string; title: string; archived_at: string | null; status: string | null };
type JobRow = { id: string; title: string; status: string };
type SubmissionRow = {
  id: string;
  task_id: string;
  student_id: string;
  submitted_at: string | null;
  created_at: string;
  status: string | null;
};
type ApplicantRow = {
  id: string;
  job_id: string;
  student_id: string;
  created_at: string;
  status: string;
};
type ConnectionRow = {
  id: string;
  student_id: string;
  created_at: string;
  status: string;
};
type StudentLite = {
  id: string;
  full_name: string | null;
  major: string | null;
  headline: string | null;
  avatar_url: string | null;
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function CompanyDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase, profile, org } = await requireCompany();
  const { welcome } = await searchParams;

  // Tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, archived_at, status")
    .eq("org_id", org.id)
    .eq("task_source", "company")
    .returns<TaskRow[]>();
  const taskList = tasks ?? [];
  const activeTaskIds = taskList.filter((t) => !t.archived_at).map((t) => t.id);
  const activeTaskCount = activeTaskIds.length;

  // Submissions for this company's tasks
  const taskIds = taskList.map((t) => t.id);
  let totalSubmissions = 0;
  let recentSubmissions: SubmissionRow[] = [];
  if (taskIds.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("id, task_id, student_id, submitted_at, created_at, status")
      .in("task_id", taskIds)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<SubmissionRow[]>();
    const subList = subs ?? [];
    totalSubmissions = subList.length;
    recentSubmissions = subList.slice(0, 5);
  }

  // Jobs
  const { data: jobs } = await supabase
    .from("job_posts")
    .select("id, title, status")
    .eq("org_id", org.id)
    .returns<JobRow[]>();
  const jobList = jobs ?? [];
  const activeJobIds = jobList.filter((j) => j.status === "open").map((j) => j.id);
  const activeJobCount = activeJobIds.length;

  // Applicants across all jobs
  const jobIds = jobList.map((j) => j.id);
  let totalApplicants = 0;
  let recentApplicants: ApplicantRow[] = [];
  if (jobIds.length > 0) {
    const { data: apps } = await supabase
      .from("job_applications")
      .select("id, job_id, student_id, created_at, status")
      .in("job_id", jobIds)
      .neq("status", "withdrawn")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<ApplicantRow[]>();
    const appList = apps ?? [];
    totalApplicants = appList.length;
    recentApplicants = appList.slice(0, 5);
  }

  // Connections / pipeline
  const { data: connections } = await supabase
    .from("connections")
    .select("id, student_id, created_at, status")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(6)
    .returns<ConnectionRow[]>();
  const connectionList = connections ?? [];

  // Resolve student details for the activity panels
  const studentIdSet = new Set<string>();
  recentSubmissions.forEach((s) => studentIdSet.add(s.student_id));
  recentApplicants.forEach((a) => studentIdSet.add(a.student_id));
  connectionList.forEach((c) => studentIdSet.add(c.student_id));

  let studentMap: Record<string, StudentLite> = {};
  if (studentIdSet.size > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, major, headline, avatar_url")
      .in("id", Array.from(studentIdSet))
      .returns<StudentLite[]>();
    studentMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
  }

  const taskTitleMap = Object.fromEntries(taskList.map((t) => [t.id, t.title]));
  const jobTitleMap = Object.fromEntries(jobList.map((j) => [j.id, j.title]));

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-sm">
                {getInitials(profile.company_name)}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                  Company Workspace
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  {profile.company_name ?? "Your Company"}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {[profile.industry, profile.company_size].filter(Boolean).join(" · ") ||
                    "Complete your profile to get started"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/company/tasks"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                + Create Task
              </Link>
              <Link
                href="/company/jobs"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                + Post Job
              </Link>
              <Link
                href="/discover"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                🔍 Discover Talent
              </Link>
            </div>
          </div>
        </section>

        {welcome === "1" && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            Welcome to GradFolio! Your company workspace is ready.{" "}
            <Link href="/company/profile" className="font-semibold underline">
              Complete your profile
            </Link>{" "}
            to help students recognise you.
          </div>
        )}

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Active Tasks"
            value={activeTaskCount}
            hint={taskList.length > activeTaskCount ? `${taskList.length - activeTaskCount} archived` : "Tasks you own"}
            href="/company/tasks"
            tone="indigo"
          />
          <KpiTile
            label="Total Submissions"
            value={totalSubmissions}
            hint={totalSubmissions === 0 ? "No submissions yet" : "Across all your tasks"}
            href="/company/tasks"
            tone="emerald"
          />
          <KpiTile
            label="Active Jobs"
            value={activeJobCount}
            hint={jobList.length > activeJobCount ? `${jobList.length - activeJobCount} closed` : "Open job postings"}
            href="/company/jobs"
            tone="violet"
          />
          <KpiTile
            label="Applicants"
            value={totalApplicants}
            hint={totalApplicants === 0 ? "No applicants yet" : "Across all your jobs"}
            href="/company/jobs"
            tone="amber"
          />
        </section>

        {/* Activity split */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Recent submissions */}
          <div className="rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Recent submissions</h2>
              <Link
                href="/company/tasks"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                View all →
              </Link>
            </div>
            {recentSubmissions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-slate-500">No submissions yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Create a task to start receiving student work.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentSubmissions.map((s) => {
                  const student = studentMap[s.student_id];
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
                    >
                      {student?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={student.avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                          {getInitials(student?.full_name ?? null)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {student?.full_name ?? "Student"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {taskTitleMap[s.task_id] ?? "Task"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            s.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : s.status === "needs_revision"
                              ? "bg-amber-50 text-amber-700"
                              : s.status === "rejected"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.status ?? "pending"}
                        </span>
                        <Link
                          href={`/company/tasks/${s.task_id}/submissions`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          Review
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recent applicants */}
          <div className="rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Recent applicants</h2>
              <Link
                href="/company/jobs"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                View all →
              </Link>
            </div>
            {recentApplicants.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-slate-500">No applicants yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Post a job to start receiving applications.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentApplicants.map((a) => {
                  const student = studentMap[a.student_id];
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
                    >
                      {student?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={student.avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-xs font-bold text-white">
                          {getInitials(student?.full_name ?? null)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {student?.full_name ?? "Student"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {jobTitleMap[a.job_id] ?? "Job"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-slate-400">{relativeTime(a.created_at)}</span>
                        <Link
                          href={`/company/jobs/${a.job_id}/applicants`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          Review
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Interested pipeline */}
        {connectionList.length > 0 && (
          <section className="rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Your talent pipeline</h2>
              <Link
                href="/discover"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Discover more →
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {connectionList.map((c) => {
                const student = studentMap[c.student_id];
                if (!student) return null;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50"
                  >
                    {student.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={student.avatar_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                        {getInitials(student.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {student.full_name ?? "Student"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {student.major ?? ""}
                        {student.headline ? ` · ${student.headline}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="text-slate-400">{relativeTime(c.created_at)}</span>
                      <Link
                        href={`/students/${c.student_id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        View →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
