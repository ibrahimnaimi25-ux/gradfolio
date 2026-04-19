import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMajorNames } from "@/lib/majors-db";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Select your major | GradFolio" };

async function saveMajor(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const major = String(formData.get("major") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();

  if (!major) redirect("/onboarding/major?error=Please+select+a+major");

  const updatePayload: Record<string, string> = { major };
  if (fullName) updatePayload.full_name = fullName;

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    redirect(`/onboarding/major?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?welcome=1");
}

export default async function OnboardingMajorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If user already has a major, they shouldn't be here
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, major, full_name")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null; major: string | null; full_name: string | null }>();

  // Redirect non-students away — they don't need a major
  if (profile?.role === "company") redirect("/company/dashboard");
  if (profile?.role === "admin") redirect("/dashboard");
  if (profile?.role === "manager") redirect("/manager/dashboard");

  if (profile?.major) redirect("/dashboard");

  const majors = await getMajorNames(supabase);
  const { error } = await searchParams;

  // Pre-fill full name from auth metadata if available
  const defaultName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    "";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-8 shadow-xl md:p-10">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">G</div>
          <span className="text-sm font-bold text-slate-900">GradFolio</span>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
          One quick step
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Welcome{user.user_metadata?.name ? `, ${user.user_metadata.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Choose your major to see your curriculum, challenges, and deadlines.
          You can update your profile with more details anytime.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={saveMajor} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              name="full_name"
              type="text"
              defaultValue={defaultName}
              placeholder="Your full name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Your Major <span className="text-rose-500">*</span>
            </label>
            <select
              name="major"
              required
              defaultValue=""
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            >
              <option value="" disabled>
                Select your major…
              </option>
              {majors.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-400">
              Don&apos;t see your major? Contact your administrator.
            </p>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Continue to GradFolio →
          </button>
        </form>

        <p className="mt-6 text-xs text-center text-slate-400">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline hover:text-slate-600">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-slate-600">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
