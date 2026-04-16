// ─── DB migration required ────────────────────────────────────────────────────
// Run in your Supabase SQL editor:
//
//   CREATE TABLE IF NOT EXISTS cohorts (
//     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     name       text NOT NULL,
//     major      text NOT NULL,
//     start_date date,
//     end_date   date,
//     status     text NOT NULL DEFAULT 'active'
//                  CHECK (status IN ('active', 'archived')),
//     created_at timestamptz DEFAULT now()
//   );
//
//   ALTER TABLE tasks
//     ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES cohorts(id) ON DELETE SET NULL;
//
//   ALTER TABLE tasks
//     ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMajorNames } from "@/lib/majors-db";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cohorts | GradFolio" };

type SearchParams = Promise<{ success?: string; error?: string }>;

type CohortRow = {
  id: string;
  name: string;
  major: string;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "archived";
  created_at: string;
  task_count?: number;
};

// ─── Server actions ────────────────────────────────────────────────────────────

async function createCohort(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const name = String(formData.get("name") || "").trim();
  const major = String(formData.get("major") || "").trim();
  const startDate = String(formData.get("start_date") || "").trim() || null;
  const endDate = String(formData.get("end_date") || "").trim() || null;

  if (!name) redirect("/admin/cohorts?error=name-is-required");
  if (!major) redirect("/admin/cohorts?error=major-is-required");

  const { error } = await supabase.from("cohorts").insert({
    name,
    major,
    start_date: startDate,
    end_date: endDate,
    status: "active",
  });

  if (error) redirect(`/admin/cohorts?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cohorts");
  revalidatePath("/dashboard");
  redirect("/admin/cohorts?success=cohort-created");
}

async function archiveCohort(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const id = String(formData.get("cohort_id") || "").trim();
  if (!id) redirect("/admin/cohorts?error=missing-id");

  const { error } = await supabase
    .from("cohorts")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) redirect(`/admin/cohorts?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cohorts");
  redirect("/admin/cohorts?success=cohort-archived");
}

async function activateCohort(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const id = String(formData.get("cohort_id") || "").trim();
  if (!id) redirect("/admin/cohorts?error=missing-id");

  const { error } = await supabase
    .from("cohorts")
    .update({ status: "active" })
    .eq("id", id);

  if (error) redirect(`/admin/cohorts?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cohorts");
  redirect("/admin/cohorts?success=cohort-activated");
}

async function deleteCohort(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const id = String(formData.get("cohort_id") || "").trim();
  if (!id) redirect("/admin/cohorts?error=missing-id");

  // Unlink tasks before deleting
  await supabase.from("tasks").update({ cohort_id: null }).eq("cohort_id", id);

  const { error } = await supabase.from("cohorts").delete().eq("id", id);
  if (error) redirect(`/admin/cohorts?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cohorts");
  revalidatePath("/tasks");
  redirect("/admin/cohorts?success=cohort-deleted");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeMessage(value: string | undefined) {
  if (!value) return null;
  try { return decodeURIComponent(value).replaceAll("-", " ").trim(); }
  catch { return value.replaceAll("-", " ").trim(); }
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminCohortsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const successMessage = decodeMessage(params.success);
  const errorMessage = decodeMessage(params.error);

  await requireSuperAdmin();
  const supabase = await createClient();
  const majorNames = await getMajorNames(supabase);

  // Fetch cohorts with task counts (best-effort)
  let cohorts: CohortRow[] = [];
  try {
    const { data } = await supabase
      .from("cohorts")
      .select("id, name, major, start_date, end_date, status, created_at")
      .order("created_at", { ascending: false })
      .returns<CohortRow[]>();
    cohorts = data ?? [];

    // Enrich with task counts
    if (cohorts.length > 0) {
      const cohortIds = cohorts.map((c) => c.id);
      const { data: taskCounts } = await supabase
        .from("tasks")
        .select("cohort_id")
        .in("cohort_id", cohortIds)
        .returns<{ cohort_id: string }[]>();
      const countMap: Record<string, number> = {};
      (taskCounts ?? []).forEach((t) => {
        countMap[t.cohort_id] = (countMap[t.cohort_id] ?? 0) + 1;
      });
      cohorts = cohorts.map((c) => ({ ...c, task_count: countMap[c.id] ?? 0 }));
    }
  } catch {
    // Table may not exist yet
  }

  const active = cohorts.filter((c) => c.status === "active");
  const archived = cohorts.filter((c) => c.status === "archived");

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="min-h-screen pb-24 pt-10">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 space-y-8">

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Super Admin</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">Cohorts</h1>
          <p className="mt-3 text-base text-slate-500">
            Group tasks into semesters or cohorts. Students on the dashboard see their active cohort.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total Cohorts", value: cohorts.length },
              { label: "Active", value: active.length },
              { label: "Archived", value: archived.length },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Alerts */}
        {(successMessage || errorMessage) && (
          <div className="space-y-3">
            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                ✓ {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                ✗ {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Create cohort */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-bold text-slate-900">Create Cohort</h2>
          <p className="mb-6 text-sm text-slate-500">
            Add a new semester or programme cohort. Link tasks to it in Task Management.
          </p>
          <form action={createCohort} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Cohort Name</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Spring 2026 — Cybersecurity"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Major</label>
                <select name="major" required className={inputClass}>
                  <option value="">Select a major</option>
                  {majorNames.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Start Date <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input name="start_date" type="date" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  End Date <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input name="end_date" type="date" className={inputClass} />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Create Cohort
            </button>
          </form>
        </section>

        {/* Active cohorts */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Active Cohorts</h2>
          {active.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No active cohorts. Create one above.
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((cohort) => (
                <div key={cohort.id} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{cohort.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cohort.major}
                        {cohort.start_date && ` · ${formatDate(cohort.start_date)} → ${formatDate(cohort.end_date)}`}
                        {(cohort.task_count ?? 0) > 0 && ` · ${cohort.task_count} tasks`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={archiveCohort}>
                        <input type="hidden" name="cohort_id" value={cohort.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Archive
                        </button>
                      </form>
                      <form action={deleteCohort}>
                        <input type="hidden" name="cohort_id" value={cohort.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Archived cohorts */}
        {archived.length > 0 && (
          <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-slate-900 text-slate-400">Archived Cohorts</h2>
            <div className="space-y-3">
              {archived.map((cohort) => (
                <div key={cohort.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{cohort.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cohort.major}
                        {cohort.start_date && ` · ${formatDate(cohort.start_date)} → ${formatDate(cohort.end_date)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={activateCohort}>
                        <input type="hidden" name="cohort_id" value={cohort.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Re-activate
                        </button>
                      </form>
                      <form action={deleteCohort}>
                        <input type="hidden" name="cohort_id" value={cohort.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
