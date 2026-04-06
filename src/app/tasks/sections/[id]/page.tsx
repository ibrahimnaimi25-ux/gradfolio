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

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    active: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-600",
    draft: "bg-amber-100 text-amber-700",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${cls}`}>
      {status}
    </span>
  );
}

export default async function SectionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: section, error } = await supabase
    .from("sections")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !section) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, status, major, assignment_type, submission_type")
    .eq("section_id", id)
    .order("created_at", { ascending: true });

  const taskList = tasks ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <nav className="text-sm text-gray-400 mb-4 flex items-center gap-1.5">
            <Link href="/tasks" className="hover:text-indigo-600 transition">Tasks</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{section.name}</span>
          </nav>
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
            {section.major}
          </span>
          <h1 className="text-2xl font-bold text-gray-900">{section.name}</h1>
          {section.description && (
            <p className="text-gray-500 mt-2 max-w-xl">{section.description}</p>
          )}
          <div className="mt-6 flex items-center gap-8">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{taskList.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Created</p>
              <p className="text-sm font-medium text-gray-700">
                {new Date(section.created_at).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {taskList.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-lg font-medium text-gray-600">No tasks in this section</p>
            <p className="text-sm mt-1">Assign tasks to this section from the admin panel.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {taskList.map((task: any, i: number) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="group bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-start gap-4 hover:shadow-sm hover:border-indigo-200 transition-all block"
              >
                <span className="text-sm font-mono text-gray-300 mt-0.5 w-6 shrink-0 group-hover:text-indigo-300 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h3 className="font-medium text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors">
                      {task.title}
                    </h3>
                    <StatusBadge status={task.status} />
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                  )}
                </div>
                <span className="text-gray-300 group-hover:text-indigo-400 transition-colors text-sm mt-0.5 shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}