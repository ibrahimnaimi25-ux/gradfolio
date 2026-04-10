import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  } | null;
};

type SectionSummary = {
  id: string;
  name: string;
  major: string;
  task_count: number;
};

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

export default async function DashboardPage() {
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
      `id, joined_at, tasks ( id, title, major, status, assignment_type, assigned_user_id )`
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
            <CardContent>
              <Button href="/tasks">Go to Tasks</Button>
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
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium !text-white transition hover:bg-slate-700"
                  >
                    Save Major
                  </button>
                </form>
              </CardContent>
            </Card>
          )}
        </section>

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
                    {sections.map((section) => (
                      <Link
                        key={section.id}
                        href={`/tasks/sections/${section.id}`}
                        className="group flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-all duration-150 hover:border-indigo-200 hover:bg-white hover:shadow-sm"
                      >
                        <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">
                          {section.name}
                        </h4>
                        <div className="flex items-center justify-between mt-auto pt-1">
                          <span className="text-xs text-slate-400">
                            {section.task_count === 0
                              ? "No tasks yet"
                              : `${section.task_count} task${section.task_count !== 1 ? "s" : ""}`}
                          </span>
                          <span className="text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Open →
                          </span>
                        </div>
                      </Link>
                    ))}
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
