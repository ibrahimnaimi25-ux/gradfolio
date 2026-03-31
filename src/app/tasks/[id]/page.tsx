import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type TaskDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function joinTask(taskId: string) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("task_joins").insert({
    user_id: user.id,
    task_id: taskId,
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message);
  }

  redirect(`/tasks/${taskId}`);
}

async function submitWork(taskId: string, formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const content = formData.get("content")?.toString().trim() || "";

  if (!content) {
    return;
  }

  const { error } = await supabase.from("submissions").insert({
    user_id: user.id,
    task_id: taskId,
    content,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect(`/tasks/${taskId}`);
}

export default async function TaskDetailsPage({ params }: TaskDetailsPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !task) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-red-600">Task not found</h1>
          <p className="mt-2 text-gray-600">
            The requested task does not exist or could not be loaded.
          </p>
        </div>
      </main>
    );
  }

  const { data: joinedTask } = await supabase
    .from("task_joins")
    .select("id")
    .eq("task_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const alreadyJoined = !!joinedTask;

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, content, submitted_at")
    .eq("task_id", id)
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false });

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <Link
          href="/tasks"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to tasks
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
              <span className="rounded-full bg-gray-100 px-3 py-1">
                Major: {task.major}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1">
                Status: {task.status}
              </span>
            </div>
          </div>

          {alreadyJoined ? (
            <div className="rounded-xl bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              Joined
            </div>
          ) : (
            <form action={joinTask.bind(null, id)}>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Join Task
              </button>
            </form>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Description</h2>
          <p className="mt-2 whitespace-pre-line text-gray-600">
            {task.description}
          </p>
        </div>

        {alreadyJoined && (
          <div className="mt-10 rounded-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">Submit Your Work</h2>
            <p className="mt-2 text-gray-600">
              Paste your work, summary, answer, or portfolio evidence here.
            </p>

            <form action={submitWork.bind(null, id)} className="mt-6 space-y-4">
              <textarea
                name="content"
                rows={8}
                required
                placeholder="Write your submission here..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600"
              />

              <button
                type="submit"
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-black"
              >
                Submit Work
              </button>
            </form>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">Your Submissions</h2>

          {submissions && submissions.length > 0 ? (
            <div className="mt-4 space-y-4">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="rounded-2xl border border-gray-200 p-5"
                >
                  <p className="whitespace-pre-line text-gray-700">
                    {submission.content}
                  </p>
                  <p className="mt-3 text-xs text-gray-500">
                    Submitted at:{" "}
                    {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-gray-600">No submissions yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}