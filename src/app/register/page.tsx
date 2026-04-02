import AuthForm from "@/components/auth-form";
import { Container } from "@/components/ui/container";

export default function RegisterPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
              Join GradFolio
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Create your account and start building real experience
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Choose your major, access relevant tasks, submit your work, and
              grow a portfolio that proves your skills.
            </p>

            <div className="mt-8 grid gap-4">
              <div className="rounded-2xl bg-slate-50 p-5">
                <h2 className="font-semibold text-slate-900">Choose your major</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Students only see tasks related to their field, plus any tasks
                  assigned directly by admin.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <h2 className="font-semibold text-slate-900">Build your portfolio</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Complete practical tasks and turn your submissions into proof
                  of your abilities.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <h2 className="font-semibold text-slate-900">Grow with real work</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  GradFolio helps bridge the gap between university learning and
                  job-ready experience.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <AuthForm mode="register" />
          </div>
        </div>
      </Container>
    </main>
  );
}