import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const featureCards = [
  {
    title: "Real-world tasks",
    description:
      "Students work on practical tasks connected to real majors, not just theory or static course exercises.",
  },
  {
    title: "Proof-based portfolios",
    description:
      "Completed work becomes visible proof of skill that can be shown to employers, universities, and mentors.",
  },
  {
    title: "Built for multiple majors",
    description:
      "GradFolio is designed to grow across different fields so each student can find relevant experience.",
  },
];

const audienceCards = [
  {
    title: "For students",
    description:
      "Build confidence, gain practical exposure, and create a stronger story for internships and jobs.",
  },
  {
    title: "For universities",
    description:
      "Give students a modern platform that helps connect education with real employment readiness.",
  },
  {
    title: "For employers",
    description:
      "Discover students through actual work quality instead of relying only on CVs and grades.",
  },
];

const stats = [
  { value: "Real", label: "experience-first model" },
  { value: "Multi", label: "major platform vision" },
  { value: "Proof", label: "of skills through work" },
];

export default function HomePage() {
  return (
    <main className="pb-20">
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-indigo-100/40 blur-3xl" />
          <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-indigo-100/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-violet-100/20 blur-3xl" />
        </div>

        <Container className="py-20 md:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
                Real experience for fresh graduates
              </div>

              <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
                Turn student skills into
                <span className="block text-indigo-600">real proof of work</span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                GradFolio helps students and fresh graduates complete practical
                tasks related to their major, build a stronger portfolio, and
                become more ready for real opportunities.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button href="/register" className="px-6 py-3 text-base">
                  Get Started
                </Button>
                <Button href="/tasks" variant="secondary" className="px-6 py-3 text-base">
                  Browse Tasks
                </Button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                    <div className="mt-1 text-sm text-slate-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pl-6">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
                <div className="grid gap-4">
                  <div className="rounded-2xl bg-slate-900 p-5 text-white">
                    <p className="text-sm font-medium text-slate-300">Student journey</p>
                    <h3 className="mt-2 text-2xl font-semibold">
                      Join tasks. Submit work. Build credibility.
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      A more modern way to help graduates move from learning to
                      real contribution.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-medium text-slate-500">Major-based</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        Relevant opportunities
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-medium text-slate-500">Portfolio-ready</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        Visible proof of skill
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 p-5">
                    <p className="text-sm font-medium text-indigo-700">
                      Long-term vision
                    </p>
                    <p className="mt-2 text-base leading-7 text-slate-700">
                      Connect students, universities, and companies through a
                      task-based system that turns learning into opportunity.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 md:py-20">
        <Container>
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
              Core value
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              A platform built around action, not just claims
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Instead of only saying a student is capable, GradFolio gives them
              a place to demonstrate it through actual completed work.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {featureCards.map((feature) => (
              <Card
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <CardContent className="p-6">
                  <div className="mb-5 h-12 w-12 rounded-2xl bg-blue-50" />
                  <h3 className="text-xl font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-4 md:py-8">
        <Container>
          <div className="rounded-[2rem] border border-slate-200 bg-slate-900 px-8 py-10 text-white md:px-12 md:py-14">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Why it matters
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                  A stronger bridge between education and employment
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                  Many graduates leave university with knowledge but without
                  enough visible practical work. GradFolio helps close that gap
                  with meaningful tasks, measurable progress, and a better path
                  into the job market.
                </p>
              </div>

              <div className="grid gap-4">
                {audienceCards.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="pt-16">
        <Container>
          <div className="rounded-[2rem] border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-8 text-center md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-700">
              Start building
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Build experience before the job asks for it
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Join the platform, explore practical tasks, and start turning your
              work into a portfolio that speaks for you.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button href="/register" className="px-6 py-3 text-base">
                Create Account
              </Button>
              <Button href="/tasks" variant="secondary" className="px-6 py-3 text-base">
                Explore Tasks
              </Button>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}