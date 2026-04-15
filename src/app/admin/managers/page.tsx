import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMajorNames } from "@/lib/majors-db";

export const metadata = { title: "Manage Managers | GradFolio" };

type SearchParams = Promise<{ success?: string; error?: string }>;

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  major: string | null;
  assigned_major: string | null;
};

// ─── Server actions ───────────────────────────────────────────────────────────

async function promoteToManager(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const userId = String(formData.get("user_id") || "").trim();
  const assignedMajor = String(formData.get("assigned_major") || "").trim();

  if (!userId || !assignedMajor) redirect("/admin/managers?error=missing-fields");
  const validMajors = await getMajorNames(supabase);
  if (!validMajors.includes(assignedMajor))
    redirect("/admin/managers?error=invalid-major");

  const { error } = await supabase
    .from("profiles")
    .update({ role: "manager", assigned_major: assignedMajor })
    .eq("id", userId);

  if (error) redirect(`/admin/managers?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/managers");
  revalidatePath("/dashboard");
  redirect("/admin/managers?success=promoted-to-manager");
}

async function updateManagerMajor(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const userId = String(formData.get("user_id") || "").trim();
  const assignedMajor = String(formData.get("assigned_major") || "").trim();

  if (!userId || !assignedMajor) redirect("/admin/managers?error=missing-fields");
  const validMajors = await getMajorNames(supabase);
  if (!validMajors.includes(assignedMajor))
    redirect("/admin/managers?error=invalid-major");

  const { error } = await supabase
    .from("profiles")
    .update({ assigned_major: assignedMajor })
    .eq("id", userId)
    .eq("role", "manager");

  if (error) redirect(`/admin/managers?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/managers");
  redirect("/admin/managers?success=major-updated");
}

async function demoteManager(formData: FormData) {
  "use server";
  const { supabase } = await requireSuperAdmin();
  const userId = String(formData.get("user_id") || "").trim();

  if (!userId) redirect("/admin/managers?error=missing-user-id");

  const { error } = await supabase
    .from("profiles")
    .update({ role: "student", assigned_major: null })
    .eq("id", userId);

  if (error) redirect(`/admin/managers?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/managers");
  revalidatePath("/dashboard");
  redirect("/admin/managers?success=demoted-to-student");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function decodeMessage(value: string | undefined) {
  if (!value) return null;
  try { return decodeURIComponent(value).replaceAll("-", " ").trim(); }
  catch { return value.replaceAll("-", " ").trim(); }
}

export default async function AdminManagersPage({
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

  // Fetch current managers
  const { data: managers } = await supabase
    .from("profiles")
    .select("id, full_name, role, major, assigned_major")
    .eq("role", "manager")
    .order("full_name", { ascending: true })
    .returns<ProfileRow[]>();

  // Fetch students available for promotion
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, role, major, assigned_major")
    .eq("role", "student")
    .order("full_name", { ascending: true })
    .returns<ProfileRow[]>();

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="min-h-screen pb-20 pt-10">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 space-y-8">

        {/* Header */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
            Super Admin Only
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
            Manager Team
          </h1>
          <p className="mt-3 text-base text-slate-500">
            Assign managers to majors. Each manager can only see and manage their
            assigned major's tasks, sections, and submissions.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Managers", value: managers?.length ?? 0 },
              { label: "Majors covered", value: new Set(managers?.map((m) => m.assigned_major).filter(Boolean)).size },
              { label: "Students", value: students?.length ?? 0 },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
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

        {/* Current managers */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Current Managers
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Change a manager's assigned major or demote them back to student.
            </p>
          </div>

          {!managers || managers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No managers yet. Promote a student below to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {managers.map((manager) => (
                <div
                  key={manager.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700 shrink-0">
                      {(manager.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {manager.full_name || `User ${manager.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {manager.assigned_major
                          ? `Assigned to: ${manager.assigned_major}`
                          : "No major assigned"}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                      Manager
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {/* Change major */}
                    <form action={updateManagerMajor} className="flex gap-2 flex-1">
                      <input type="hidden" name="user_id" value={manager.id} />
                      <select
                        name="assigned_major"
                        defaultValue={manager.assigned_major ?? ""}
                        className={`${inputClass} flex-1`}
                      >
                        <option value="">Select a major</option>
                        {majorNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="shrink-0 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                      >
                        Update
                      </button>
                    </form>

                    {/* Demote */}
                    <form action={demoteManager}>
                      <input type="hidden" name="user_id" value={manager.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        Demote to Student
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Promote a student */}
        <section className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Promote to Manager
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a student and assign them a major. They will immediately get
              manager access to that major's tasks and submissions.
            </p>
          </div>

          {!students || students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No students available to promote.
            </div>
          ) : (
            <form action={promoteToManager} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Student
                  </label>
                  <select name="user_id" required className={inputClass}>
                    <option value="">Select a student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name || `User ${student.id.slice(0, 8)}`}
                        {student.major ? ` — ${student.major}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Assign Major
                  </label>
                  <select name="assigned_major" required className={inputClass}>
                    <option value="">Select a major</option>
                    {majorNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                The promoted user will be able to create tasks, manage sections, and
                review submissions — but only for their assigned major.
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Promote to Manager
              </button>
            </form>
          )}
        </section>

      </div>
    </main>
  );
}
