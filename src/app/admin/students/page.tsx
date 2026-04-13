import { requireStaff, getMajorFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Student Directory | GradFolio" };

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{
  q?: string;
  major?: string;
  sort?: string;
}>;

type StudentRow = {
  id: string;
  full_name: string | null;
  major: string | null;
  headline: string | null;
  avatar_url: string | null;
  resume_url: string | null;
};

type SubStats = {
  count: number;
  lastAt: string | null;
};

type StudentEnriched = StudentRow & {
  completeness: number;
  subStats: SubStats;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcCompleteness(s: StudentRow): number {
  const fields = [s.full_name?.trim(), s.major?.trim(), s.headline?.trim(), s.avatar_url];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function decodeMessage(v: string | undefined) {
  if (!v) return null;
  try { return decodeURIComponent(v).replaceAll("-", " ").trim(); }
  catch { return v.replaceAll("-", " ").trim(); }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompletenessBadge({ pct }: { pct: number }) {
  const { ring, dot, text } =
    pct === 100
      ? { ring: "ring-emerald-200 bg-emerald-50", dot: "bg-emerald-500", text: "text-emerald-700" }
      : pct >= 75
      ? { ring: "ring-blue-100 bg-blue-50", dot: "bg-blue-500", text: "text-blue-700" }
      : pct >= 50
      ? { ring: "ring-amber-200 bg-amber-50", dot: "bg-amber-500", text: "text-amber-700" }
      : { ring: "ring-rose-100 bg-rose-50", dot: "bg-rose-400", text: "text-rose-600" };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${ring} ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      {pct}%
    </span>
  );
}

function Avatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const initial = (name ?? "?")[0].toUpperCase();
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? "Student"}
        className="h-9 w-9 rounded-full object-cover shrink-0 border border-slate-200"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
      {initial}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").toLowerCase().trim();
  const majorFilter = params.major ?? "";
  const sort = params.sort ?? "name";

  const { profile } = await requireStaff();
  const staffMajorFilter = getMajorFilter(profile);
  const isAdmin = profile.role === "admin";
  const isManager = profile.role === "manager";
  const supabase = await createClient();

  // ── Fetch students ───────────────────────────────────────────────────────────
  let students: StudentRow[] = [];
  try {
    let query = supabase
      .from("profiles")
      .select("id, full_name, major, headline, avatar_url, resume_url")
      .eq("role", "student")
      .order("full_name", { ascending: true });

    if (staffMajorFilter !== null) {
      query = query.eq("major", staffMajorFilter);
    }

    const { data } = await query.returns<StudentRow[]>();
    students = data ?? [];
  } catch {
    // Fallback: optional columns not yet in DB
    let query = supabase
      .from("profiles")
      .select("id, full_name, major, resume_url")
      .eq("role", "student")
      .order("full_name", { ascending: true });

    if (staffMajorFilter !== null) {
      query = query.eq("major", staffMajorFilter);
    }

    const { data } = await query.returns<Array<{ id: string; full_name: string | null; major: string | null; resume_url: string | null }>>();
    students = (data ?? []).map((s) => ({ ...s, headline: null, avatar_url: null }));
  }

  // ── Submission stats ─────────────────────────────────────────────────────────
  const userIds = students.map((s) => s.id);
  const subStatsMap: Record<string, SubStats> = {};

  if (userIds.length > 0) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("user_id, submitted_at")
      .in("user_id", userIds)
      .order("submitted_at", { ascending: false })
      .returns<Array<{ user_id: string; submitted_at: string | null }>>();

    for (const sub of subs ?? []) {
      if (!subStatsMap[sub.user_id]) {
        subStatsMap[sub.user_id] = { count: 0, lastAt: sub.submitted_at };
      }
      subStatsMap[sub.user_id].count++;
    }
  }

  // ── Enrich ───────────────────────────────────────────────────────────────────
  const enriched: StudentEnriched[] = students.map((s) => ({
    ...s,
    completeness: calcCompleteness(s),
    subStats: subStatsMap[s.id] ?? { count: 0, lastAt: null },
  }));

  // ── Filters & search ─────────────────────────────────────────────────────────
  const allMajors = Array.from(new Set(enriched.map((s) => s.major).filter(Boolean) as string[])).sort();

  let filtered = enriched;
  if (q) {
    filtered = filtered.filter(
      (s) =>
        (s.full_name ?? "").toLowerCase().includes(q) ||
        (s.major ?? "").toLowerCase().includes(q) ||
        (s.headline ?? "").toLowerCase().includes(q)
    );
  }
  if (majorFilter && isAdmin) {
    filtered = filtered.filter((s) => s.major === majorFilter);
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "completeness") return b.completeness - a.completeness;
    if (sort === "submissions") return b.subStats.count - a.subStats.count;
    if (sort === "last_active") {
      const ta = a.subStats.lastAt ? new Date(a.subStats.lastAt).getTime() : 0;
      const tb = b.subStats.lastAt ? new Date(b.subStats.lastAt).getTime() : 0;
      return tb - ta;
    }
    // Default: name
    return (a.full_name ?? "").localeCompare(b.full_name ?? "");
  });

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  const totalStudents = enriched.length;
  const avgCompleteness = totalStudents
    ? Math.round(enriched.reduce((a, s) => a + s.completeness, 0) / totalStudents)
    : 0;
  const withResume = enriched.filter((s) => s.resume_url).length;
  const fullyComplete = enriched.filter((s) => s.completeness === 100).length;

  // ── URL helpers ──────────────────────────────────────────────────────────────
  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (majorFilter) p.set("major", majorFilter);
    if (sort !== "name") p.set("sort", sort);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `/admin/students${s ? `?${s}` : ""}`;
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  const SORT_OPTIONS = [
    { value: "name", label: "Name A–Z" },
    { value: "completeness", label: "Completeness" },
    { value: "submissions", label: "Most Submissions" },
    { value: "last_active", label: "Recently Active" },
  ];

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                {isManager ? `Manager — ${profile.assigned_major ?? ""}` : "Super Admin"}
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                Student Directory
              </h1>
              <p className="mt-3 text-base text-slate-500">
                {isManager
                  ? `Students enrolled in ${profile.assigned_major ?? "your major"}.`
                  : "All students across every major."}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 self-start inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              ← Dashboard
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-6 sm:grid-cols-4">
            {[
              { label: "Total Students", value: totalStudents, color: "text-slate-900" },
              { label: "Avg Completeness", value: `${avgCompleteness}%`, color: avgCompleteness >= 75 ? "text-emerald-600" : avgCompleteness >= 50 ? "text-amber-600" : "text-rose-600" },
              { label: "Resume Uploaded", value: `${withResume} / ${totalStudents}`, color: "text-slate-900" },
              { label: "Fully Complete", value: fullyComplete, color: fullyComplete > 0 ? "text-emerald-600" : "text-slate-400" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Filters ────────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-100 bg-white p-4">
          <form method="GET" className="flex flex-wrap gap-3">
            {/* Search */}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, major, headline…"
              className={`${inputClass} flex-1 min-w-48`}
            />

            {/* Major filter — admins only */}
            {isAdmin && allMajors.length > 1 && (
              <select
                name="major"
                defaultValue={majorFilter}
                className={`${inputClass} w-auto`}
              >
                <option value="">All majors</option>
                {allMajors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            {/* Sort */}
            <select
              name="sort"
              defaultValue={sort}
              className={`${inputClass} w-auto`}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Apply
            </button>

            {(q || majorFilter || sort !== "name") && (
              <Link
                href="/admin/students"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Reset
              </Link>
            )}
          </form>
        </section>

        {/* ── Results ────────────────────────────────────────────────────────── */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-center">
            <div className="mb-4 text-4xl">🎓</div>
            <h3 className="text-base font-semibold text-slate-800">
              {q || majorFilter ? "No students match your filters" : "No students yet"}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {q || majorFilter ? "Try clearing the filters." : "Students will appear here once they register."}
            </p>
            {(q || majorFilter) && (
              <Link
                href="/admin/students"
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Result count */}
            <p className="text-sm text-slate-500 px-1">
              Showing <strong className="text-slate-700">{sorted.length}</strong>{" "}
              {sorted.length === 1 ? "student" : "students"}
              {q && ` matching "${q}"`}
              {majorFilter && ` in ${majorFilter}`}
            </p>

            {/* Table — desktop */}
            <div className="hidden md:block rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Student
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Major
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Link href={buildUrl({ sort: "completeness" })} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                        Profile {sort === "completeness" && <span className="text-indigo-500">↓</span>}
                      </Link>
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Resume
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Link href={buildUrl({ sort: "submissions" })} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                        Submissions {sort === "submissions" && <span className="text-indigo-500">↓</span>}
                      </Link>
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Link href={buildUrl({ sort: "last_active" })} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                        Last Active {sort === "last_active" && <span className="text-indigo-500">↓</span>}
                      </Link>
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sorted.map((student) => (
                    <tr
                      key={student.id}
                      className="group transition-colors hover:bg-slate-50/60"
                    >
                      {/* Name + avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={student.full_name} avatarUrl={student.avatar_url} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {student.full_name ?? (
                                <span className="italic text-slate-400">No name</span>
                              )}
                            </p>
                            {student.headline && (
                              <p className="text-xs text-slate-400 truncate max-w-48">
                                {student.headline}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Major */}
                      <td className="px-5 py-4">
                        {student.major ? (
                          <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                            {student.major}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Not set</span>
                        )}
                      </td>

                      {/* Completeness */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                student.completeness === 100
                                  ? "bg-emerald-500"
                                  : student.completeness >= 50
                                  ? "bg-indigo-400"
                                  : "bg-rose-400"
                              }`}
                              style={{ width: `${student.completeness}%` }}
                            />
                          </div>
                          <CompletenessBadge pct={student.completeness} />
                        </div>
                      </td>

                      {/* Resume */}
                      <td className="px-5 py-4">
                        {student.resume_url ? (
                          <a
                            href={student.resume_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Submissions */}
                      <td className="px-5 py-4">
                        <span className={`text-sm font-semibold ${student.subStats.count > 0 ? "text-slate-900" : "text-slate-300"}`}>
                          {student.subStats.count}
                        </span>
                      </td>

                      {/* Last active */}
                      <td className="px-5 py-4">
                        <span className={`text-xs ${student.subStats.lastAt ? "text-slate-500" : "text-slate-300"}`}>
                          {timeAgo(student.subStats.lastAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/students/${student.id}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-700"
                          >
                            Portfolio
                          </Link>
                          <Link
                            href={`/admin/submissions?q=${encodeURIComponent(student.full_name ?? "")}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-700"
                          >
                            Submissions
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards — mobile */}
            <div className="space-y-3 md:hidden">
              {sorted.map((student) => (
                <div
                  key={student.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4"
                >
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <Avatar name={student.full_name} avatarUrl={student.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">
                        {student.full_name ?? <span className="italic text-slate-400">No name</span>}
                      </p>
                      {student.headline && (
                        <p className="text-xs text-slate-400 truncate">{student.headline}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {student.major && (
                          <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                            {student.major}
                          </span>
                        )}
                        <CompletenessBadge pct={student.completeness} />
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-5 text-xs text-slate-500 border-t border-slate-50 pt-3">
                    <span>
                      <strong className="text-slate-900">{student.subStats.count}</strong>{" "}
                      {student.subStats.count === 1 ? "submission" : "submissions"}
                    </span>
                    <span>Active: {timeAgo(student.subStats.lastAt)}</span>
                    {student.resume_url && (
                      <span className="text-emerald-600 font-medium">✓ Resume</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-slate-50 pt-3">
                    <Link
                      href={`/students/${student.id}`}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-700 transition hover:bg-white"
                    >
                      Portfolio
                    </Link>
                    <Link
                      href={`/admin/submissions?q=${encodeURIComponent(student.full_name ?? "")}`}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-700 transition hover:bg-white"
                    >
                      Submissions
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  );
}
