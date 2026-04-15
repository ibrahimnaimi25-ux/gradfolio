import AuthForm from "@/components/auth-form";
import { Container } from "@/components/ui/container";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMajorNames } from "@/lib/majors-db";

export const metadata = { title: "Register | GradFolio" };

const benefits = [
  {
    title: "Choose your major",
    description:
      "Access tasks relevant to your field, plus any tasks assigned directly by an admin.",
  },
  {
    title: "Build your portfolio",
    description:
      "Complete practical tasks and turn your submissions into visible proof of your skills.",
  },
  {
    title: "Grow with real work",
    description:
      "Bridge the gap between university learning and job-ready experience.",
  },
];

export default async function RegisterPage() {
  const supabase = await createClient();
  const majorNames = await getMajorNames(supabase);
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 py-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm md:p-10">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                G
              </div>
              <span className="text-sm font-bold text-slate-900">GradFolio</span>
            </Link>

            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
              Join GradFolio
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Start building real experience
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-500">
              Choose your major, access relevant tasks, submit your work, and
              grow a portfolio that proves your skills.
            </p>

            <div className="mt-8 space-y-4">
              {benefits.map((b) => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                    <svg
                      className="h-3.5 w-3.5 text-indigo-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{b.title}</p>
                    <p className="text-sm leading-6 text-slate-500">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <AuthForm mode="register" majors={majorNames} />
          </div>
        </div>
      </Container>
    </main>
  );
}
