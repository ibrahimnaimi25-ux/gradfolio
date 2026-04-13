import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { uploadResume, removeResume } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import Link from "next/link";
import { MAJOR_NAMES } from "@/lib/majors";
import OnboardingBanner from "@/components/onboarding-banner";
import { getSectionProgressMap, type SectionProgress } from "@/lib/section-progress";
import SubmitButton from "@/components/submit-button";

type JoinedTask = {
  id: string;
  joined_at: string;
  tasks: {
    id: string;
    title: string;
    major: string;
    status: string;
    assignment_type: string;
    assigned_user_id: string | null;
    due_date: string | null;
  } | null;
};

type UpcomingTask = {
  id: string;
  title: string;
  due_date: string;
  section_id: string | null;
};

type SectionSummary = {
  id: string;
  name: string;
  major: string;
  task_count: number;
};

function getDueDateInfo(dueDateStr: string | null) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (diffDays < 0) return { label: `Overdue · ${formatted}`, cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", urgent: true, diffDays };
  if (diffDays === 0) return { label: "Due today!", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", urgent: true, diffDays };
  if (diffDays === 1) return { label: "Due tomorrow", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", urgent: true, diffDays };
  if (diffDays <= 7) return { label: `Due in ${diffDays} days · ${formatted}`, cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", urgent: false, diffDays };
  return { label: `Due ${formatted}`, cls: "bg-slate-100 text-slate-500", urgent: false, diffDays };
}

function getStatusClasses(status: string) {
  const value = status.toLowerCase();
  if (value === "open")
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (value === "in progress")
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (value === "closed")
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  return "bg-slate-100 text-slate-600";
}

async function dismissOnboarding() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.set("gf_onboarding_done", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    httpOnly: true,
  });
}

async function updateMajor(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const major = formData.get("major")?.toString().trim() || "";
  if (!MAJOR_NAMES.includes(major)) return;
  await supabase.from("profiles").update({ major }).eq("id", user.id);
  redirect("/dashboard");
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ resume_error?: string; resume_success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, major, assigned_major")
    .eq("id", user.id)
    .maybeSingle();

  // Resume — optional columns, won't crash if not in DB yet
  let resumeUrl: string | null = null;
  let resumeName: string | null = null;
  let resumePath: string | null = null;
  let resumeError: string | null = null;
  let resumeSuccess = false;
  try {
    const { data: resumeData } = await supabase
      .from("profiles")
      .select("resume_url, resume_name, resume_path")
      .eq("id", user.id)
      .maybeSingle<{ resume_url: string | null; resume_name: string | null; resume_path: string | null }>();
    resumeUrl = resumeData?.resume_url ?? null;
    resumeName = resumeData?.resume_name ?? null;
    resumePath = resumeData?.resume_path ?? null;
  } catch { /* columns not in DB yet */ }

  const rawResumeError = params?.resume_error;
  resumeError = rawResumeError
    ? decodeURIComponent(rawResumeError).replaceAll("-", " ")
    : null;
  resumeSuccess = params?.resume_success === "1";

  // Onboarding — fetch optional profile fields to measure completeness
  let headline: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const { data: extras } = await supabase
      .from("profiles")
      .select("headline, avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ headline: string | null; avatar_url: string | null }>();
    headline = extras?.headline ?? null;
    avatarUrl = extras?.avatar_url ?? null;
  } catch { /* columns not in DB yet */ }

  const cookieStore = await cookies();
  const onboardingDismissed = cookieStore.get("gf_onboarding_done")?.value === "1";

  const role: string = profile?.role ?? "student";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isStaff = isAdmin || isManager;
  const userMajor = profile?.major ?? null;
  const assignedMajor: string | null = profile?.assigned_major ?? null;
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  // For students: load joined tasks and sections
  const { data: joinedTasks } = await supabase
    .from("task_joins")
    .select(
      `id, joined_at, tasks ( id, title, major, status, assignment_type, assigned_user_id, due_date )`
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const { count: submissionsCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const allJoinedTasks = (joinedTasks ?? []) as unknown as JoinedTask[];

  const safeJoinedTasks = isStaff
    ? allJoinedTasks
    : allJoinedTasks.filter((item) => {
        if (!item.tasks) return false;
        const isMajorTask =
          item.tasks.assignment_type === "major" &&
          item.tasks.major === userMajor;
        const isSpecificUserTask =
          item.tasks.assignment_type === "specific_user" &&
          item.tasks.assigned_user_id === user.id;
        return isMajorTask || isSpecificUserTask;
      });

  // Sections for student view
  let sections: SectionSummary[] = [];
  let sectionProgressMap: Record<string, SectionProgress> = {};
  if (!isStaff && userMajor) {
    const { data: sectionData } = await supabase
      .from("sections")
      .select("id, name, major, tasks(count)")
      .eq("major", userMajor)
      .order("name", { ascending: true });

    sections = (sectionData ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      major: s.major,
      task_count: s.tasks?.[0]?.count ?? 0,
    }));

    if (sections.length > 0) {
      sectionProgressMap = await getSectionProgressMap(
        supabase,
        user.id,
        sections.map((s) => s.id)
      );
    }
  }

  // Upcoming deadlines for students — tasks in their major with due_date within 14 days
  let upcomingDeadlines: UpcomingTask[] = [];
  if (!isStaff && userMajor) {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + 14);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];
      const { data: upcoming } = await supabase
        .from("tasks")
        .select("id, title, due_date, section_id")
        .eq("major", userMajor)
        .not("due_date", "is", null)
        .lte("due_date", cutoffStr)
        .order("due_date", { ascending: true })
        .limit(5)
        .returns<UpcomingTask[]>();
      upcomingDeadlines = (upcoming ?? []).filter((t) => t.due_date);
    } catch { /* due_date column may not exist yet */ }
  }

  // Pending submissions count for staff panels
  let pendingReviews = 0;
  if (isStaff) {
    let pendingQuery = supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .is("reviewed_at", null);

    if (isManager && assignedMajor) {
      // Count only submissions for the manager's major tasks
      const { data: majorTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("major", assignedMajor);
      const ids = (majorTasks ?? []).map((t: any) => t.id);
      if (ids.length > 0) {
        pendingQuery = pendingQuery.in("task_id", ids);
        const { count } = await pendingQuery;
        pendingReviews = count ?? 0;
      }
    } else if (isAdmin) {
      const { count } = await pendingQuery;
      pendingReviews = count ?? 0;
    }
  }

  const roleBadgeClass = isAdmin
    ? "bg-violet-50 text-violet-700"
    : isManager
    ? "bg-sky-50 text-sky-700"
    : "bg-blue-50 text-blue-700";

  return (
    <main className="min-h-screen pb-20 pt-10">
      <Container className="space-y-6">

        {/* Onboarding banner — students only, hidden once dismissed or fully complete */}
        {!isStaff && !onboardingDismissed && (
          <OnboardingBanner
            profileUrl={`/students/${user.id}/edit`}
            steps={[
              { label: "Name set", done: !!profile?.full_name?.trim() },
              { label: "Major chosen", done: !!userMajor },
              { label: "Headline added", done: !!headline?.trim() },
              { label: "Photo uploaded", done: !!avatarUrl },
            ]}
            dismiss={dismissOnboarding}
          />
        )}

        {/* Welcome header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-500">
                {isAdmin
                  ? "Manage tasks, review submissions, and oversee the platform."
                  : isManager
                  ? `Manage tasks and review submissions for ${assignedMajor ?? "your major"}.`
                  : "Track your joined tasks, manage your activity, and keep building your portfolio."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  {user.email}
                </span>
                <span className={`rounded-full px-3 py-1 text-sm ${roleBadgeClass}`}>
                  {isAdmin ? "Super Admin" : isManager ? "Manager" : "Student"}
                </span>
                {isManager && assignedMajor && (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
                    📂 {assignedMajor}
                  </span>
                )}
                {!isStaff && userMajor && (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-700">
                    {userMajor}
                  </span>
                )}
                {!isStaff && (
                  <Link
                    href={`/students/${user.id}`}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                  >
                    View Portfolio →
                  </Link>
                )}
              </div>
            </div>

            <form action="/auth/signout" method="post" className="shrink-0">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                Logout
              </button>
            </form>
          </div>
        </section>

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          {isStaff ? (
            <>
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardDescription>Pending Reviews</CardDescription>
                  <CardTitle className={`mt-1 text-4xl font-bold ${pendingReviews > 0 ? "text-amber-600" : "text-slate-900"}`}>
                    {pendingReviews}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardDescription>
                    {isAdmin ? "Access Level" : "Your Major"}
                  </CardDescription>
                  <CardTitle className="mt-1 text-2xl font-bold capitalize text-slate-900">
                    {isAdmin ? "Super Admin" : (assignedMajor ?? "Unassigned")}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardDescription>Role</CardDescription>
                  <CardTitle className="mt-1 text-4xl font-bold capitalize text-slate-900">
                    {isAdmin ? "Admin" : "Manager"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </>
          ) : (
            <>
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardDescription>Joined Tasks</CardDescription>
                  <CardTitle className="mt-1 text-4xl font-bold text-slate-900">
                    {safeJoinedTasks.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardDescription>Submissions</CardDescription>
                  <CardTitle className="mt-1 text-4xl font-bold text-slate-900">
                    {submissionsCount || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardDescription>Profile Role</CardDescription>
                  <CardTitle className="mt-1 text-4xl font-bold capitalize text-slate-900">
                    {role}
                  </CardTitle>
                </CardHeader>
              </Card>
            </>
          )}
        </section>

        {/* Quick actions */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Browse Tasks</CardTitle>
              <CardDescription>
                Explore available tasks and join work that fits your growth.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button href="/tasks">Go to Tasks</Button>
              {!isStaff && (
                <Button href="/submissions" variant="secondary">
                  {submissionsCount && submissionsCount > 0
                    ? `My Work (${submissionsCount})`
                    : "My Work"}
                </Button>
              )}
            </CardContent>
          </Card>

          {isStaff ? (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>
                  {isAdmin ? "Admin Panel" : "Manager Panel"}
                </CardTitle>
                <CardDescription>
                  {isAdmin
                    ? "Create tasks, manage sections, and oversee the whole platform."
                    : `Manage tasks and review submissions for ${assignedMajor ?? "your major"}.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button href="/admin/tasks">Manage Tasks</Button>
                <Button href="/admin/submissions" variant="secondary">
                  {pendingReviews > 0
                    ? `Review Submissions (${pendingReviews})`
                    : "Review Submissions"}
                </Button>
                <Button href="/admin/students" variant="secondary">
                  Students
                </Button>
                {isAdmin && (
                  <Button href="/admin/managers" variant="secondary">
                    Manage Team
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Change Major</CardTitle>
                <CardDescription>
                  Update your major to see tasks that match your field.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateMajor} className="space-y-3">
                  <select
                    name="major"
                    defaultValue={userMajor || MAJOR_NAMES[0]}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-900"
                  >
                    {MAJOR_NAMES.map((major) => (
                      <option key={major} value={major}>
                        {major}
                      </option>
                    ))}
                  </select>
                  <SubmitButton label="Save Major" loadingLabel="Saving…" />
                </form>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Resume upload — students only */}
        {!isStaff && (
          <section>
            <Card className="rounded-3xl">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>My Resume</CardTitle>
                    <CardDescription className="mt-1">
                      Upload your CV so employers can download it from your portfolio.
                    </CardDescription>
                  </div>
                  {resumeUrl && (
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      View Resume
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Alerts */}
                {resumeSuccess && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    ✓ Resume uploaded successfully.
                  </div>
                )}
                {resumeError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                    ✗ {resumeError}
                  </div>
                )}

                {/* Current resume */}
                {resumeUrl && resumeName && (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{resumeName}</p>
                        <p className="text-xs text-slate-400">PDF · Currently active</p>
                      </div>
                    </div>
                    <form action={removeResume}>
                      <input type="hidden" name="resume_path" value={resumePath ?? ""} />
                      <button
                        type="submit"
                        className="shrink-0 text-xs font-medium text-rose-500 hover:text-rose-700 transition"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                )}

                {/* Upload form */}
                <form action={uploadResume} className="space-y-3">
                  <div>
                    <input
                      name="resume"
                      type="file"
                      accept=".pdf"
                      required
                      className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">PDF only · Max 5 MB</p>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {resumeUrl ? "Replace Resume" : "Upload Resume"}
                  </button>
                </form>

              </CardContent>
            </Card>
          </section>
        )}

        {/* Upcoming Deadlines — students only, shown when there are tasks with due dates */}
        {!isStaff && upcomingDeadlines.length > 0 && (
          <section>
            <Card className="rounded-3xl border-amber-100">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg">
                    🗓
                  </div>
                  <div>
                    <CardTitle>Upcoming Deadlines</CardTitle>
                    <CardDescription className="mt-0.5">
                      Tasks due in the next 14 days for your major — {userMajor}.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {upcomingDeadlines.map((task) => {
                    const info = getDueDateInfo(task.due_date);
                    const isUrgent = info ? info.diffDays <= 1 : false;
                    return (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition-all hover:shadow-sm ${
                          isUrgent
                            ? "border-rose-100 bg-rose-50/40 hover:border-rose-200"
                            : "border-amber-100 bg-amber-50/30 hover:border-amber-200"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                        </div>
                        {info && (
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.cls}`}>
                            {info.label}
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-slate-300">→</span>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* My Sections — students only */}
        {!isStaff && userMajor && (
          <section>
            <Card className="rounded-3xl">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>My Sections</CardTitle>
                    <CardDescription className="mt-1">
                      Sections for your major — {userMajor}.
                    </CardDescription>
                  </div>
                  <Link
                    href="/tasks"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    View all →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {sections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No sections have been created for {userMajor} yet.{" "}
                    <Link href="/tasks" className="font-medium text-blue-600 hover:underline">
                      Browse tasks →
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.map((section) => {
                      const prog = sectionProgressMap[section.id];
                      const hasProg = prog && prog.total > 0;
                      const pct = hasProg ? Math.round((prog.done / prog.total) * 100) : 0;
                      const allDone = hasProg && prog.done === prog.total;
                      return (
                        <Link
                          key={section.id}
                          href={`/tasks/sections/${section.id}`}
                          className={`group flex flex-col gap-2 rounded-2xl border p-4 transition-all duration-150 hover:shadow-sm ${
                            allDone
                              ? "border-emerald-100 bg-emerald-50/40 hover:border-emerald-200"
                              : "border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-white"
                          }`}
                        >
                          <h4 className={`text-sm font-semibold leading-snug transition-colors ${
                            allDone
                              ? "text-emerald-800 group-hover:text-emerald-700"
                              : "text-slate-900 group-hover:text-indigo-700"
                          }`}>
                            {section.name}
                          </h4>

                          {/* Progress bar */}
                          {hasProg && (
                            <div className="space-y-1">
                              <div className="h-1.5 w-full rounded-full bg-white/80 overflow-hidden border border-slate-200/60">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-indigo-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-auto pt-0.5">
                            <span className={`text-xs font-medium ${allDone ? "text-emerald-600" : "text-slate-400"}`}>
                              {section.task_count === 0
                                ? "No tasks yet"
                                : hasProg
                                ? allDone
                                  ? `✓ All ${prog.total} done`
                                  : `${prog.done} / ${prog.total} submitted`
                                : `${section.task_count} task${section.task_count !== 1 ? "s" : ""}`}
                            </span>
                            <span className="text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                              Open →
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Joined tasks — students only */}
        {!isStaff && (
          <section>
            <Card className="rounded-3xl">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>Your Joined Tasks</CardTitle>
                    <CardDescription className="mt-1">
                      Track the tasks you joined and continue your work.
                    </CardDescription>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
                    {safeJoinedTasks.length} task{safeJoinedTasks.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>

              <CardContent>
                {safeJoinedTasks.length > 0 ? (
                  <div className="space-y-3">
                    {safeJoinedTasks.map((item) =>
                      item.tasks ? (
                        <div
                          key={item.id}
                          className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(
                                  item.tasks.status
                                )}`}
                              >
                                {item.tasks.status}
                              </span>
                              {item.tasks.major && (
                                <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                                  {item.tasks.major}
                                </span>
                              )}
                            </div>
                            <h3 className="mt-2 text-base font-semibold text-slate-900">
                              {item.tasks.title}
                            </h3>
                          </div>

                          <div className="shrink-0">
                            <Button href={`/tasks/${item.tasks.id}`}>
                              Open Task →
                            </Button>
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    You have not joined any tasks yet.{" "}
                    <Link href="/tasks" className="font-medium text-blue-600 hover:underline">
                      Browse tasks →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

      </Container>
    </main>
  );
}
