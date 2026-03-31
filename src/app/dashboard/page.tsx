import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type JoinedTask = {
  id: string;
  joined_at: string;
  tasks: {
    id: string;
    title: string;
    major: string;
    status: string;
  } | null;
};

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
    .select("full_name, role")
    .eq("id", user.id)
    .single();

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
        status
      )
    `
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const { count: submissionsCount } = await supabase
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const safeJoinedTasks = (joinedTasks ?? []) as unknown as JoinedTask[];

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Welcome back</p>
              <h1 className="text-3xl font-bold text-gray-900">
                {profile?.full_name || "User"}
              </h1>
              <p className="mt-2 text-gray-600">
                Role: {profile?.role || "student"}
              </p>
              <p className="text-gray-600">Email: {user.email}</p>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                Logout
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Joined Tasks</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {safeJoinedTasks.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Submissions</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {submissionsCount || 0}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Profile Role</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {profile?.role || "student"}
            </h2>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/tasks"
            className="rounded-2xl border border-gray-200 bg-white p-6 hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold text-gray-900">Browse Tasks</h2>
            <p className="mt-2 text-gray-600">View available tasks.</p>
          </Link>

          {profile?.role === "admin" && (
            <Link
              href="/admin/tasks"
              className="rounded-2xl border border-gray-200 bg-white p-6 hover:bg-gray-50"
            >
              <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
              <p className="mt-2 text-gray-600">Create tasks as admin.</p>
            </Link>
          )}
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your Joined Tasks</h2>
              <p className="mt-2 text-gray-600">
                Track the tasks you joined and continue your work.
              </p>
            </div>
          </div>

          {safeJoinedTasks.length > 0 ? (
            <div className="mt-6 space-y-4">
              {safeJoinedTasks.map((item) =>
                item.tasks ? (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.tasks.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                        <span className="rounded-full bg-gray-100 px-3 py-1">
                          Major: {item.tasks.major}
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1">
                          Status: {item.tasks.status}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/tasks/${item.tasks.id}`}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Open Task
                    </Link>
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <p className="mt-6 text-gray-600">
              You have not joined any tasks yet.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}