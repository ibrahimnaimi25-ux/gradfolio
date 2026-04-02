import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

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

const MAJORS = ["Cybersecurity", "Marketing", "Business"];

function getStatusClasses(status: string) {
  const value = status.toLowerCase();

  if (value === "open") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (value === "in progress") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  if (value === "closed") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

async function updateMajor(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const major = formData.get("major")?.toString().trim() || "";

  if (!MAJORS.includes(major)) {
    return;
  }

  await supabase.from("profiles").update({ major }).eq("id", user.id);

  redirect("/dashboard");
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, major")
    .eq("id", user.id)
    .maybeSingle();

  const { data: joinedTasks } = await supabase
    .from("task_joins")
    .select(
      `
      id,
      joined_at,
      tasks (
        id,
        title,
        major,
        status,
        assignment_type,
        assigned_user_id
      )
    `
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const { count: submissionsCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const allJoinedTasks = (joinedTasks ?? []) as unknown as JoinedTask[];

  const safeJoinedTasks =
    profile?.role === "admin"
      ? allJoinedTasks
      : allJoinedTasks.filter((item) => {
          if (!item.tasks) return false;

          const isMajorTask =
            item.tasks.assignment_type === "major" &&
            item.tasks.major === profile?.major;

          const isSpecificUserTask =
            item.tasks.assignment_type === "specific_user" &&
            item.tasks.assigned_user_id === user.id;

          return isMajorTask || isSpecificUserTask;
        });

  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container className="space-y-8">
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
                Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                Welcome back, {profile?.full_name || "User"}
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Track your joined tasks, manage your activity, and continue
                building your portfolio through practical work.
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Role: {profile?.role || "student"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Major: {profile?.major || "Not set"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {user.email}
                </span>
              </div>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
              >
                Logout
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardDescription>Joined Tasks</CardDescription>
              <CardTitle className="text-4xl">{safeJoinedTasks.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardDescription>Submissions</CardDescription>
              <CardTitle className="text-4xl">{submissionsCount || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardDescription>Profile Role</CardDescription>
              <CardTitle className="text-4xl capitalize">
                {profile?.role || "student"}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

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

          {profile?.role === "admin" ? (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Admin Panel</CardTitle>
                <CardDescription>
                  Create and manage tasks for students across the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button href="/admin/tasks" variant="secondary">
                  Open Admin Panel
                </Button>
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
                <form action={updateMajor} className="space-y-4">
                  <select
                    name="major"
                    defaultValue={profile?.major || "Cybersecurity"}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
                  >
                    {MAJORS.map((major) => (
                      <option key={major} value={major}>
                        {major}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save Major
                  </button>
                </form>
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Your Joined Tasks</CardTitle>
              <CardDescription>
                Track the tasks you joined and continue your work.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {safeJoinedTasks.length > 0 ? (
                <div className="space-y-4">
                  {safeJoinedTasks.map((item) =>
                    item.tasks ? (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-semibold text-slate-900">
                            {item.tasks.title}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-3">
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
                              {item.tasks.major}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusClasses(
                                item.tasks.status
                              )}`}
                            >
                              {item.tasks.status}
                            </span>
                          </div>
                        </div>

                        <div className="lg:shrink-0">
                          <Button href={`/tasks/${item.tasks.id}`}>Open Task</Button>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-5 text-slate-600">
                  You have not joined any tasks yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </Container>
    </main>
  );
}