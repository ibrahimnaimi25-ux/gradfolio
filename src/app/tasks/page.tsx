import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Task = {
  id: string;
  title: string;
  description: string;
  major: string;
  status: string;
  created_at: string;
};

export default async function TasksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-red-600">Failed to load tasks</h1>
          <p className="mt-2 text-gray-600">{error.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
            <p className="mt-2 text-gray-600">
              Browse real-world tasks and start building your portfolio.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              Home
            </Link>
          </div>
        </div>

        {tasks && tasks.length > 0 ? (
          <div className="grid gap-6">
            {tasks.map((task: Task) => (
              <div key={task.id} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{task.title}</h2>
                    <p className="mt-2 text-gray-600">{task.description}</p>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        Major: {task.major}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        Status: {task.status}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/tasks/${task.id}`}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-gray-600">No tasks found yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}