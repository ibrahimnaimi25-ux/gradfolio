import { createClient } from "@/lib/supabase/server";
import { getMajorNames } from "@/lib/majors-db";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Talent Directory | GradFolio",
  description: "Browse student portfolios and discover talent across all majors.",
};

type SearchParams = Promise<{ q?: string; major?: string }>;

type PublicStudent = {
  id: string;
  full_name: string | null;
  major: string | null;
  headline: string | null;
  skills: string | null;
  avatar_url: string | null;
  approved_count?: number;
};

const MAJOR_COLORS: Record<string, string> = {
  Cybersecurity: "bg-violet-50 text-violet-700 ring-violet-200",
  Marketing: "bg-pink-50 text-pink-700 ring-pink-200",
  Business: "bg-sky-50 text-sky-700 ring-sky-200",
};

function majorClass(major: string | null) {
  if (!major) return "bg-slate-100 text-slate-600 ring-slate-200";
  return MAJOR_COLORS[major] ?? "bg-indigo-50 text-indigo-700 ring-indigo-200";
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default async function TalentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q = "", major = "" } = await searchParams;
  const search = q.toLowerCase().trim();

  const supabase = await createClient();
  const majorNames = await getMajorNames(supabase);

  // Fetch all public student profiles
  let query = supabase
    .from("profiles")
    .select("id, full_name, major, headline, skills, avatar_url")
    .eq("role", "student")
    .eq("is_public", true)
    .order("full_name", { ascending: true });

  if (major) query = query.eq("major", major);

  const { data: rawStudents } = await query.returns<PublicStudent[]>();
  const students = rawStudents ?? [];

  // Fetch approved submission counts for displayed students
  const ids = students.map((s) => s.id);
  let countMap: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: counts } = await supabase
      .from("submissions")
      .select("user_id")
      .in("user_id", ids)
      .eq("review_status", "approved");
    (counts ?? []).forEach((row: { user_id: string }) => {
      countMap[row.user_id] = (countMap[row.user_id] ?? 0) + 1;
    });
  }

  // Client-side search filter on skills/name/headline
  const filtered = search
    ? students.filter((s) => {
        const haystack = [
          s.full_name,
          s.headline,
          s.skills,
          s.major,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
    : students;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">

        {/* Hero */}
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
            Talent Directory
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Find the right talent
          </h1>
          <p className="mt-3 text-base text-slate-500 max-w-xl mx-auto">
            Browse student portfolios with real, reviewed work samples — proof of skills, not just claims.
          </p>
        </div>

        {/* Search + filter bar */}
        <form method="GET" className="mb-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Search by name, skill, or keyword…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <select
            name="major"
            defaultValue={major}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-48"
          >
            <option value="">All majors</option>
            {majorNames.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Search
          </button>
          {(q || major) && (
            <Link
              href="/talent"
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 text-center"
            >
              Clear
            </Link>
          )}
        </form>

        {/* Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {filtered.length === 0
              ? "No students found"
              : `${filtered.length} student${filtered.length !== 1 ? "s" : ""}`}
            {major && ` in ${major}`}
            {search && ` matching "${q}"`}
          </p>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-center">
            <div className="mb-4 text-5xl">🔍</div>
            <h3 className="text-base font-semibold text-slate-700">No results found</h3>
            <p className="mt-1 text-sm text-slate-400">
              {students.length === 0
                ? "No students have made their portfolios public yet."
                : "Try a different search term or major filter."}
            </p>
            {(q || major) && (
              <Link
                href="/talent"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                View all talent
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((student) => {
              const skillTags = student.skills
                ? student.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4)
                : [];
              const approvedCount = countMap[student.id] ?? 0;

              return (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="group flex flex-col gap-4 rounded-3xl border border-black/5 bg-white p-6 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
                >
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    {student.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={student.avatar_url}
                        alt={student.full_name ?? "Student"}
                        className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm">
                        {getInitials(student.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {student.full_name ?? "Student"}
                      </h3>
                      {student.headline && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {student.headline}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Major */}
                  {student.major && (
                    <span
                      className={`self-start inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${majorClass(student.major)}`}
                    >
                      {student.major}
                    </span>
                  )}

                  {/* Skills */}
                  {skillTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skillTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                      {(student.skills?.split(",").length ?? 0) > 4 && (
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          +{(student.skills?.split(",").length ?? 0) - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">
                      {approvedCount > 0
                        ? `${approvedCount} task${approvedCount !== 1 ? "s" : ""} completed`
                        : "Getting started"}
                    </span>
                    <span className="text-xs font-medium text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      View portfolio →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
