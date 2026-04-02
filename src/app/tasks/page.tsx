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

type Task = {
  id: string;
  title: string;
  description: string;
  major: string | null;
  status: string;
  created_at: string;
  assignment_type: string;
  assigned_user_id: string | null;
};

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

export default async function TasksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("major, role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return (
      <main className="min-h-screen py-12">
        <Container>
          <Card className="rounded-3xl border-red-100">
            <CardHeader>
              <CardTitle className="text-red-600">Failed to load profile</CardTitle>
              <CardDescription>{profileError.message}</CardDescription>
            </CardHeader>
          </Card>
        </Container>
      </main>
    );
  }

  let tasksQuery = supabase.from("tasks").select("*");

  if (profile?.role === "admin") {
    tasksQuery = tasksQuery.order("created_at", { ascending: false });
  } else {
    if (!profile?.major) {
      return (
        <main className="min-h-screen py-12">
          <Container>
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Your major is not set</CardTitle>
                <CardDescription>
                  Ask the admin to set your major before viewing tasks.
                </CardDescription>
              </CardHeader>
            </Card>
          </Container>
        </main>
      );
    }

    tasksQuery = tasksQuery
      .or(
        `and(assignment_type.eq.major,major.eq.${profile.major}),and(assignment_type.eq.specific_user,assigned_user_id.eq.${user.id})`
      )
      .order("created_at", { ascending: false });
  }

  const { data: tasks, error } = await tasksQuery;

  if (error) {
    return (
      <main className="min-h-screen py-12">
        <Container>
          <Card className="rounded-3xl border-red-100">
            <CardHeader>
              <CardTitle className="text-red-600">Failed to load tasks</CardTitle>
              <CardDescription>{error.message}</CardDescription>
            </CardHeader>
          </Card>
        </Container>
      </main>
    );
  }

  const pageTitle =
    profile?.role === "admin" ? "All Tasks" : `Tasks for ${profile?.major}`;

  const pageDescription =
    profile?.role === "admin"
      ? "As admin, you can view all tasks across all majors and specific-user assignments."
      : "You only see tasks assigned to your major, plus any tasks assigned directly to you by the admin.";

  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <section className="mb-8 rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
                Task marketplace
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {pageTitle}
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
                {pageDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button href="/dashboard" variant="secondary">
                Dashboard
              </Button>
              <Button href="/" variant="ghost">
                Home
              </Button>
            </div>
          </div>
        </section>

        {tasks && tasks.length > 0 ? (
          <section className="grid gap-6">
            {tasks.map((task: Task) => (
              <Card key={task.id} className="rounded-3xl p-0">
                <CardContent className="p-6 md:p-7">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-3">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
                          {task.major || "No major"}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusClasses(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                          {task.assignment_type === "specific_user"
                            ? "Specific user"
                            : "Major task"}
                        </span>
                      </div>

                      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                        {task.title}
                      </h2>

                      <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                        {task.description}
                      </p>
                    </div>

                    <div className="lg:shrink-0">
                      <Button href={`/tasks/${task.id}`}>View Details</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>No tasks found</CardTitle>
              <CardDescription>
                {profile?.role === "admin"
                  ? "There are no tasks in the system yet."
                  : "There are currently no tasks for your major or directly assigned to you."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </Container>
    </main>
  );
}