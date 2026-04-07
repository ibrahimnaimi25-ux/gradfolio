import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
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

function StatusBadge({ status }: { status: string | null }) {
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

export default async function SectionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, major")
    .eq("id", user.id)
    .maybeSingle();

  const { data: section, error } = await supabase
    .from("sections")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !section) notFound();

  const isAdmin = profile?.role === "admin";
  const userMajor = profile?.major ?? null;

  if (!isAdmin && userMajor && section.major !== userMajor) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, status, major, assignment_type, submission_type")
    .eq("section_id", id)
    .order("created_at", { ascending: true });

  const taskList = tasks ?? [];

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
              An admin hasn't added any tasks here yet. Check back soon or explore other sections.
            </p>
            <Link
              href="/tasks"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              ← Back to Tasks
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {taskList.map((task: any, i: number) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="group bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-start gap-4 hover:border-indigo-200 hover:shadow-sm transition-all duration-150 block"
              >
                <span className="text-xs font-mono text-slate-300 mt-1 w-6 shrink-0 group-hover:text-indigo-300 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h3 className="font-medium text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors">
                      {task.title}
                    </h3>
                    <StatusBadge status={task.status} />
                  </div>
                  {task.description && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>
                <span className="text-slate-200 group-hover:text-indigo-400 transition-colors text-sm mt-1 shrink-0">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
