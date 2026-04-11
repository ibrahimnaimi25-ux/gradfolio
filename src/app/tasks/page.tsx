import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { SectionWithTaskCount } from "@/types/sections";

export const metadata = { title: "Tasks | GradFolio" };

type SearchParams = Promise<{ q?: string }>;

const PALETTE = [
  {
    border: "border-indigo-200",
    hoverBorder: "hover:border-indigo-400",
    dot: "bg-indigo-500",
    tag: "bg-indigo-50 text-indigo-700",
    accent: "group-hover:text-indigo-700",
    arrow: "group-hover:text-indigo-400",
  },
  {
    border: "border-violet-200",
    hoverBorder: "hover:border-violet-400",
    dot: "bg-violet-500",
    tag: "bg-violet-50 text-violet-700",
    accent: "group-hover:text-violet-700",
    arrow: "group-hover:text-violet-400",
  },
  {
    border: "border-sky-200",
    hoverBorder: "hover:border-sky-400",
    dot: "bg-sky-500",
    tag: "bg-sky-50 text-sky-700",
    accent: "group-hover:text-sky-700",
    arrow: "group-hover:text-sky-400",
  },
  {
    border: "border-emerald-200",
    hoverBorder: "hover:border-emerald-400",
    dot: "bg-emerald-500",
    tag: "bg-emerald-50 text-emerald-700",
    accent: "group-hover:text-emerald-700",
    arrow: "group-hover:text-emerald-400",
  },
  {
    border: "border-amber-200",
    hoverBorder: "hover:border-amber-400",
    dot: "bg-amber-500",
    tag: "bg-amber-50 text-amber-700",
    accent: "group-hover:text-amber-700",
    arrow: "group-hover:text-amber-400",
  },
  {
    border: "border-rose-200",
    hoverBorder: "hover:border-rose-400",
    dot: "bg-rose-500",
    tag: "bg-rose-50 text-rose-700",
    accent: "group-hover:text-rose-700",
    arrow: "group-hover:text-rose-400",
  },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = await searchParams;
  const q = (params?.q || "").toLowerCase().trim();

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  let userMajor: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, major")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.role === "admin";
    userMajor = profile?.major ?? null;
  }

  const { data } = await supabase
    .from("sections")
    .select("*, tasks(count)")
    .order("major", { ascending: true });

  const allSections: SectionWithTaskCount[] = (data ?? []).map((s: any) => ({
    ...s,
    task_count: s.tasks?.[0]?.count ?? 0,
  }));

  // Guests and admins see all sections; students see only their major
  const majorFiltered =
    !user || isAdmin
      ? allSections
      : allSections.filter((s) => s.major === userMajor);

  // Apply search filter (section name or description)
  const sections = q
    ? majorFiltered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q)
      )
    : majorFiltered;

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
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="border-b border-slate-100 px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
            {isAdmin ? "All Sections" : "Browse Sections"}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tasks</h1>
              <p className="text-slate-500 mt-1 text-sm">
                {isAdmin
                  ? "All sections across every major."
                  : user && userMajor
                  ? `Sections for your major — ${userMajor}.`
                  : "Explore tasks across all majors."}
              </p>
            </div>
            {/* Major badge for logged-in students */}
            {user && !isAdmin && userMajor && (
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                Your major: {userMajor}
              </span>
            )}
          </div>
          {majorFiltered.length > 0 && (
            <div className="flex flex-wrap gap-5 mt-4 text-sm text-slate-500">
              <span>
                <strong className="text-slate-900">{sections.length}</strong>{" "}
                {sections.length === 1 ? "section" : "sections"}
                {q ? " matching search" : ""}
              </span>
              {isAdmin && (
                <span>
                  <strong className="text-slate-900">{majors.length}</strong>{" "}
                  {majors.length === 1 ? "major" : "majors"}
                </span>
              )}
              <span>
                <strong className="text-slate-900">{totalTasks}</strong> total tasks
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Section search filter */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto">
          <form method="GET" className="flex gap-3 items-center max-w-sm">
            <input
              name="q"
              defaultValue={q}
              placeholder="Filter sections by name…"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Search
            </button>
            {q && (
              <a
                href="/tasks"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </a>
            )}
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-12">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-5">
              📚
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">
              {q
                ? `No sections match "${q}"`
                : user && userMajor && !isAdmin
                ? `No sections for ${userMajor} yet`
                : "No sections yet"}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs">
              {q
                ? "Try a different search term."
                : user && userMajor && !isAdmin
                ? "An admin hasn't created any sections for your major yet. Check back soon."
                : "Ask an admin to create sections and assign tasks."}
            </p>
            <div className="mt-6 flex gap-3">
              {q && (
                <a
                  href="/tasks"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Clear search
                </a>
              )}
              {user && (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  ← Back to Dashboard
                </Link>
              )}
            </div>
          </div>
        ) : (
          majors.map((major, majorIndex) => {
            const majorSections = byMajor[major];
            const style = PALETTE[majorIndex % PALETTE.length];

            return (
              <section key={major}>
                <div className="flex items-center gap-3 mb-5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                  <h2 className="text-sm font-semibold text-slate-800">{major}</h2>
                  <span className="text-xs text-slate-400">
                    {majorSections.length} {majorSections.length === 1 ? "section" : "sections"}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {majorSections.map((section) => (
                    <Link
                      key={section.id}
                      href={`/tasks/sections/${section.id}`}
                      className={`group bg-white border-2 ${style.border} ${style.hoverBorder} rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${style.tag}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {section.major}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(section.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <h3 className={`font-semibold text-slate-900 text-base leading-snug transition-colors ${style.accent}`}>
                        {section.name}
                      </h3>

                      {section.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 flex-1">
                          {section.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 mt-auto border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-500">
                          {section.task_count === 0
                            ? "No tasks yet"
                            : `${section.task_count} task${section.task_count !== 1 ? "s" : ""}`}
                        </span>
                        <span className={`text-xs font-semibold opacity-0 group-hover:opacity-100 transition-all duration-200 ${style.arrow}`}>
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
