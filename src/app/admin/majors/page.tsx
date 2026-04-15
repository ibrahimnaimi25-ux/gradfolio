import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Manage Majors | GradFolio" };

type SearchParams = Promise<{ success?: string; error?: string }>;

type MajorRow = {
  id: string;
  name: string;
  created_at: string;
};

// ─── Server actions ────────────────────────────────────────────────────────────

async function createMajor(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/majors?error=Name+is+required");

  const { error } = await supabase.from("majors").insert({ name });
  if (error) redirect(`/admin/majors?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/majors");
  redirect("/admin/majors?success=created");
}

async function deleteMajor(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) redirect("/admin/majors?error=Missing+ID");

  const { error } = await supabase.from("majors").delete().eq("id", id);
  if (error) redirect(`/admin/majors?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/majors");
  redirect("/admin/majors?success=deleted");
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminMajorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { success, error } = await searchParams;

  const { data: majors } = await supabase
    .from("majors")
    .select("id, name, created_at")
    .order("name", { ascending: true })
    .returns<MajorRow[]>();

  const majorList = majors ?? [];

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-1">
          Super Admin
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Majors</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage the list of majors available across the platform.
        </p>
      </div>

      {/* Alerts */}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success === "created" ? "Major created successfully." : "Major deleted."}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Add major form */}
      <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Add New Major
        </h2>
        <form action={createMajor} className="flex gap-3">
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Data Science"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            + Add Major
          </button>
        </form>
      </section>

      {/* Majors list */}
      <section className="rounded-3xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Current Majors
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {majorList.length} total
            </span>
          </div>
        </div>

        {majorList.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No majors yet. Add one above to get started.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {majorList.map((major) => (
              <li
                key={major.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-900">
                    {major.name}
                  </span>
                </div>
                <form action={deleteMajor}>
                  <input type="hidden" name="id" value={major.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-rose-500 transition hover:text-rose-700"
                    onClick={(e) => {
                      if (!confirm(`Delete "${major.name}"? This cannot be undone.`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Note */}
      <p className="text-xs text-slate-400 text-center">
        Deleting a major does not remove existing tasks, sections, or student profiles that reference it.
      </p>
    </div>
  );
}
