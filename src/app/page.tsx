import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

const features = [
  {
    title: "Real experience",
    description:
      "Students work on practical tasks that simulate real company needs and build confidence before getting hired.",
  },
  {
    title: "Portfolio building",
    description:
      "Each completed task becomes proof of skill that students can show to employers, universities, and mentors.",
  },
  {
    title: "Multi-major platform",
    description:
      "GradFolio can support different majors so more students can find relevant work and grow in their field.",
  },
];

export default function HomePage() {
  return (
    <main className="pb-16">
      <section className="relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              Real experience for fresh graduates
            </p>

            <h1 className="text-5xl font-bold tracking-tight text-slate-900 md:text-7xl">
              Build your portfolio by working on real-world tasks
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
              GradFolio helps fresh graduates join practical tasks related to
              their major, submit real work, and grow a portfolio that proves
              their skills.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button href="/register" className="px-6 py-3 text-base">
                Get Started
              </Button>
              <Button href="/tasks" variant="secondary" className="px-6 py-3 text-base">
                Browse Tasks
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-6 md:py-10">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="h-full">
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-1.5 w-16 rounded-full bg-blue-600" />
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-12 md:py-16">
        <Container>
          <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-sm md:p-12">
            <div className="grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Why GradFolio
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  A better bridge between education and employment
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Many graduates struggle because they have knowledge but no
                  proof of practical work. GradFolio solves that by giving them
                  meaningful tasks, visible progress, and a stronger story to
                  present when applying for opportunities.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-900">For students</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Gain confidence, practical exposure, and portfolio-ready
                    work.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-900">For universities</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Support students with a practical system that improves
                    readiness for the job market.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-900">For employers</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Discover graduates who already practiced meaningful work in
                    their area.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}