import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { SectionWithTaskCount } from "@/types/sections";

export const metadata = { title: "Tasks | GradFolio" };

async function getSectionsWithCounts(): Promise<SectionWithTaskCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .select("*, tasks(count)")
    .order("major", { ascending: true });

  if (error) throw new Error(error.message);

  return data.map((s: any) => ({
    ...s,
    task_count: s.tasks?.[0]?.count ?? 0,
  }));
}

const PALETTE = [
  {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    hoverBorder: "hover:border-indigo-400",
    dot: "bg-indigo-500",
    tag: "bg-indigo-100 text-indigo-600",
  },
  {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    hoverBorder: "hover:border-violet-400",
    dot: "bg-violet-500",
    tag: "bg-violet-100 text-violet-600",
  },
  {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    hoverBorder: "hover:border-sky-400",
    dot: "bg-sky-500",
    tag: "bg-sky-100 text-sky-600",
  },
  {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    hoverBorder: "hover:border-emerald-400",
    dot: "bg-emerald-500",
    tag: "bg-emerald-100 text-emerald-600",
  },
  {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    hoverBorder: "hover:border-amber-400",
    dot: "bg-amber-500",
    tag: "bg-amber-100 text-amber-600",
  },
  {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    hoverBorder: "hover:border-rose-400",
    dot: "bg-rose-500",
    tag: "bg-rose-100 text-rose-600",
  },
];

export default async function TasksPage() {
  const sections = await getSectionsWithCounts();

  // Group by major, preserving insertion order
  const byMajor = sections.reduce<Record<string, SectionWithTaskCount[]>>(
    (acc, s) => {
      if (!acc[s.major]) acc[s.major] = [];
      acc[s.major].push(s);
      return acc;
    },
    {}
  );

  const majors = Object.keys(byMajor).sort();
  const totalTasks = sections.reduce((a, s) => a + s.task_count, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">
            Browse sections and their tasks, organized by major.
          </p>
          <div className="flex gap-6 mt-4 text-sm text-gray-500">
            <span>
              <strong className="text-gray-900">{sections.length}</strong>{" "}
              sections
            </span>
            <span>
              <strong className="text-gray-900">{majors.length}</strong> majors
            </span>
            <span>
              <strong className="text-gray-900">{totalTasks}</strong> total
              tasks
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-12">
        {sections.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">📚</p>
            <p className="text-lg font-medium text-gray-600">
              No sections yet
            </p>
            <p className="text-sm mt-1">Ask an admin to create sections.</p>
          </div>
        ) : (
          majors.map((major, majorIndex) => {
            const majorSections = byMajor[major];
            const style = PALETTE[majorIndex % PALETTE.length];

            return (
              <section key={major}>
                {/* Major heading */}
                <div className="flex items-center gap-3 mb-5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`}
                  />
                  <h2 className="text-base font-semibold text-gray-800">
                    {major}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {majorSections.length} section
                    {majorSections.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {majorSections.map((section) => (
                    <Link
                      key={section.id}
                      href={`/tasks/sections/${section.id}`}
                      className={`group bg-white border-2 ${style.border} ${style.hoverBorder} rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style.tag}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${style.dot}`}
                          />
                          {section.major}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(section.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", year: "numeric" }
                          )}
                        </span>
                      </div>

                      {/* Name */}
                      <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-indigo-700 transition-colors">
                        {section.name}
                      </h3>

                      {/* Description */}
                      {section.description && (
                        <p className="text-sm text-gray-500 line-clamp-2 flex-1">
                          {section.description}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-100">
                        <span className="text-sm text-gray-500">
                          {section.task_count === 0
                            ? "No tasks yet"
                            : `${section.task_count} task${
                                section.task_count !== 1 ? "s" : ""
                              }`}
                        </span>
                        <span className="text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          View →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
