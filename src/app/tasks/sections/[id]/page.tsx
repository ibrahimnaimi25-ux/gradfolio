import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sections")
    .select("name")
    .eq("id", id)
    .single();
  if (!data) return { title: "Not Found | GradFolio" };
  return { title: `${data.name} | GradFolio` };
}

// ─── Due date badge ───────────────────────────────────────────────────────────
function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  let label: string;
  let cls: string;
  if (diffDays < 0) {
    label = `Overdue · ${formatted}`;
    cls = "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  } else if (diffDays === 0) {
    label = "Due today!";
    cls = "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  } else if (diffDays === 1) {
    label = "Due tomorrow";
    cls = "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  } else if (diffDays <= 7) {
    label = `Due in ${diffDays}d`;
    cls = "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  } else {
    label = `🗓 ${formatted}`;
    cls = "bg-slate-100 text-slate-500";
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

// ─── Task status badge (open / draft / closed) ────────────────────────────────
function TaskStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, string> = {
    open: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    active: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    completed: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
    closed: "bg-slate-100 text-slate-500",
    draft: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize shrink-0 ${cls}`}>
      {status}
    </span>
  );
}

// ─── Student progress badge (submitted / reviewed) ───────────────────────────
type ProgressState = "reviewed" | "submitted" | null;

function ProgressBadge({ state }: { state: ProgressState }) {
  if (!state) return null;

  if (state === "reviewed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 shrink-0">
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Reviewed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 shrink-0">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      Submitted
    </span>
  );
}

export default async function SectionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  let role: string = "guest";
  let userMajor: string | null = null;
  let assignedMajor: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, major, assigned_major")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? "student";
    userMajor = profile?.major ?? null;
    assignedMajor = profile?.assigned_major ?? null;
  }

  const { data: section, error } = await supabase
    .from("sections")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !section) notFound();

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isStaff = isAdmin || isManager;
  const isGuest = !user;

  // ─── Access control ──────────────────────────────────────────────────────────
  // Guests can browse any section. Logged-in non-admin users are scoped to their major.
  if (!isGuest && !isAdmin) {
    const allowedMajor = isManager ? assignedMajor : userMajor;
    if (!allowedMajor || section.major !== allowedMajor) {
      notFound();
    }
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, status, major, assignment_type, submission_type, due_date")
    .eq("section_id", id)
    .order("created_at", { ascending: true });

  // Guests only see publicly browsable tasks — direct-assignment (company-specific) tasks
  // are hidden from unauthenticated users and require login to access.
  const taskList = isGuest
    ? (tasks ?? []).filter((t: any) => t.assignment_type !== "direct")
    : (tasks ?? []);

  // ─── Student progress map ────────────────────────────────────────────────────
  // Only for logged-in students — guests have no progress to show.
  const progressMap: Record<string, ProgressState> = {};

  if (!isGuest && !isStaff && user && taskList.length > 0) {
    const taskIds = taskList.map((t) => t.id);
    const { data: submissions } = await supabase
      .from("submissions")
      .select("task_id, reviewed_at")
      .eq("user_id", user.id)
      .in("task_id", taskIds);

    for (const sub of submissions ?? []) {
      progressMap[sub.task_id] = sub.reviewed_at ? "reviewed" : "submitted";
    }
  }

  // ─── Section progress counts (students only) ─────────────────────────────────
  const completedCount = Object.values(progressMap).filter((v) => v === "reviewed").length;
  const submittedCount = Object.values(progressMap).filter((v) => v === "submitted").length;
  const doneCount = completedCount + submittedCount;

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
          <nav className="text-sm text-slate-400 mb-5 flex items-center gap-1.5 flex-wrap">
            <Link href="/tasks" className="hover:text-indigo-600 transition-colors">
              Tasks
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">{section.name}</span>
          </nav>

          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
            {section.major}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {section.name}
          </h1>
          {section.description && (
            <p className="text-slate-500 mt-2 max-w-xl text-sm leading-relaxed">
              {section.description}
            </p>
          )}

          <div className="mt-6 flex items-center gap-8 flex-wrap">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tasks</p>
              <p className="text-2xl font-bold text-slate-900">{taskList.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Created</p>
              <p className="text-sm font-medium text-slate-700">
                {new Date(section.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Progress bar — logged-in students only */}
            {!isGuest && !isStaff && taskList.length > 0 && (
              <div className="flex-1 min-w-[160px]">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Your progress</p>
                  <p className="text-xs font-semibold text-slate-600">
                    {doneCount} / {taskList.length}
                  </p>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${taskList.length > 0 ? (doneCount / taskList.length) * 100 : 0}%` }}
                  />
                </div>
                {doneCount > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {completedCount > 0 && `${completedCount} reviewed`}
                    {completedCount > 0 && submittedCount > 0 && " · "}
                    {submittedCount > 0 && `${submittedCount} pending review`}
                  </p>
                )}
              </div>
            )}

            {isStaff && (
              <Link
                href="/admin/sections"
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                ← Manage Sections
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {taskList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-4">
              📋
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">
              No tasks in this section yet
            </h3>
            <p className="text-sm text-slate-400 max-w-xs">
              {isStaff
                ? "Create a task and assign it to this section."
                : "An admin hasn't added any tasks here yet. Check back soon."
              }
            </p>
            <div className="mt-5 flex gap-3">
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                ← Back to Tasks
              </Link>
              {isStaff && (
                <Link
                  href="/admin/tasks"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  + Create Task
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {taskList.map((task: any, i: number) => {
              const progress = progressMap[task.id] ?? null;
              const isDone = progress === "reviewed";
              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className={`group flex items-start gap-4 rounded-2xl border px-5 py-4 transition-all duration-150 block
                    ${isDone
                      ? "border-emerald-100 bg-emerald-50/30 hover:border-emerald-300 hover:shadow-sm"
                      : "border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm"
                    }`}
                >
                  {/* Row number */}
                  <span className={`text-xs font-mono mt-1 w-6 shrink-0 transition-colors
                    ${isDone ? "text-emerald-300 group-hover:text-emerald-400" : "text-slate-300 group-hover:text-indigo-300"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <h3 className={`font-medium leading-snug transition-colors
                        ${isDone ? "text-slate-600 group-hover:text-emerald-700" : "text-slate-900 group-hover:text-indigo-700"}`}>
                        {task.title}
                      </h3>

                      {/* Right-hand badges — due date + task status + student progress */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <DueDateBadge dueDate={task.due_date ?? null} />
                        <TaskStatusBadge status={task.status} />
                        <ProgressBadge state={progress} />
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <span className={`text-sm mt-1 shrink-0 transition-colors
                    ${isDone ? "text-emerald-200 group-hover:text-emerald-400" : "text-slate-200 group-hover:text-indigo-400"}`}>
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
