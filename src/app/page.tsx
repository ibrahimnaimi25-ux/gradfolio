import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const steps = [
  {
    number: "01",
    title: "Create your account",
    description: "Sign up in seconds with your university email. Choose your major and you're ready to go.",
    color: "bg-indigo-500",
    light: "bg-indigo-50 text-indigo-700",
  },
  {
    number: "02",
    title: "Pick tasks in your field",
    description: "Browse practical, real-world tasks built for your major. Each task is a chance to apply what you've learned.",
    color: "bg-violet-500",
    light: "bg-violet-50 text-violet-700",
  },
  {
    number: "03",
    title: "Submit your work",
    description: "Upload your deliverables — text, files, links, or images. Your work is reviewed and stored in your portfolio.",
    color: "bg-sky-500",
    light: "bg-sky-50 text-sky-700",
  },
  {
    number: "04",
    title: "Build your proof",
    description: "Every reviewed submission becomes visible proof of your skill. Share your public portfolio with anyone.",
    color: "bg-emerald-500",
    light: "bg-emerald-50 text-emerald-700",
  },
];

const features = [
  {
    icon: "🎯",
    title: "Major-matched tasks",
    description: "Every task is assigned to a specific major so you always work on things that are relevant to your career path.",
  },
  {
    icon: "📂",
    title: "Shareable portfolio",
    description: "Your completed, reviewed work builds a public portfolio page you can share with employers and universities.",
  },
  {
    icon: "✅",
    title: "Expert review",
    description: "Admins and managers review your submissions and leave feedback, giving your work real credibility.",
  },
  {
    icon: "🏆",
    title: "Proof over promises",
    description: "Stop telling employers what you can do — show them. Every submission is timestamped evidence of your ability.",
  },
  {
    icon: "📅",
    title: "Real deadlines",
    description: "Tasks have due dates so you experience the rhythm of professional work, not just academic timelines.",
  },
  {
    icon: "🔒",
    title: "Your work, secured",
    description: "All files and submissions are stored securely. Only you and authorised reviewers can access your data.",
  },
];

const audiences = [
  {
    emoji: "🎓",
    role: "For students",
    headline: "Stand out before you graduate",
    body: "Build a real portfolio of completed work while you're still studying. When interviews ask for experience, you'll have something tangible to show.",
    cta: "Create free account",
    href: "/register",
    accent: "indigo",
  },
  {
    emoji: "🏢",
    role: "For companies",
    headline: "Discover talent through real work",
    body: "Stop screening CVs blindly. Find students who've already demonstrated the skills you need through actual completed tasks in their field.",
    cta: "Get in touch",
    href: "/register",
    accent: "violet",
  },
  {
    emoji: "🏫",
    role: "For universities",
    headline: "Bridge education and employment",
    body: "Give your students a structured platform to gain practical exposure and produce evidence of readiness — while still enrolled.",
    cta: "Learn more",
    href: "/register",
    accent: "sky",
  },
];

const testimonials = [
  {
    quote: "I had three interviews ask me about my portfolio before they even looked at my CV. GradFolio changed how I approach job hunting.",
    name: "Reem A.",
    major: "Marketing",
    initials: "RA",
    color: "bg-indigo-500",
  },
  {
    quote: "The tasks were genuinely challenging. I learned more from one submission than I did from a full semester of theory.",
    name: "Khalid M.",
    major: "Computer Science",
    initials: "KM",
    color: "bg-violet-500",
  },
  {
    quote: "Having my work reviewed and approved by a real manager made it feel legitimate — not just another student project.",
    name: "Sara H.",
    major: "Business Admin",
    initials: "SH",
    color: "bg-emerald-500",
  },
];

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-white">
        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-indigo-100/50 blur-3xl" />
          <div className="absolute -right-32 top-10 h-80 w-80 rounded-full bg-violet-100/40 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-sky-100/30 blur-3xl" />
        </div>

        <Container className="pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="grid items-center gap-16 lg:grid-cols-2">

            {/* Left copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                Real experience. Real proof.
              </div>

              <h1 className="mt-6 text-5xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
                Your skills deserve
                <span className="block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  proof, not promises
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-500 md:text-xl">
                GradFolio connects students and fresh graduates with real tasks in their field.
                Complete work, get reviewed, and build a portfolio that opens doors — while you're still studying.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300"
                >
                  Start for free
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-base font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Sign in
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Free to join
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  No experience required
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Portfolio-ready from day one
                </span>
              </div>
            </div>

            {/* Right — UI preview card */}
            <div className="relative">
              <div className="rounded-[2.5rem] border border-slate-200/80 bg-white p-5 shadow-2xl shadow-slate-200/60">
                {/* Mock task card */}
                <div className="rounded-2xl bg-slate-900 px-6 py-5 text-white">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Open
                    </span>
                    <span className="text-xs text-slate-400">Due in 5 days</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold">Competitive Analysis Report</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Research 3 competitors in your market and produce a structured analysis with strategic recommendations.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300">
                      Marketing
                    </span>
                    <span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">
                      File upload
                    </span>
                  </div>
                </div>

                {/* Progress area */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-400">Your progress</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-2 w-3/4 rounded-full bg-indigo-500" />
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-slate-700">3 / 4 tasks done</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-medium text-emerald-600">Latest review</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-bold text-emerald-700">Approved</p>
                    </div>
                    <p className="mt-1 text-xs text-emerald-600">Great structure!</p>
                  </div>
                </div>

                {/* Submission bar */}
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-indigo-700">Submit your work</p>
                    <p className="text-xs text-indigo-500">Upload file, link, or text</p>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -right-4 -top-4 rounded-2xl border border-violet-100 bg-white px-4 py-3 shadow-lg shadow-violet-100/50">
                <p className="text-xs font-semibold text-slate-500">Portfolio</p>
                <p className="text-lg font-bold text-slate-900">12 submissions</p>
                <div className="mt-1 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100 bg-slate-50 py-20 md:py-28">
        <Container>
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              From sign-up to portfolio in four steps
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-500">
              No complicated setup. Just create an account and start building real proof of your skills.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.number} className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-12 hidden h-0.5 w-6 translate-x-full bg-slate-200 lg:block" />
                )}
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${step.color} text-lg font-bold text-white shadow-sm`}>
                  {step.number}
                </div>
                <h3 className="text-base font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700"
            >
              Get started free
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </Container>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100 py-20 md:py-28">
        <Container>
          <div className="mb-14 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Everything you need
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Built for students who want real outcomes
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-2xl bg-slate-100 text-2xl transition group-hover:bg-indigo-50">
                  {f.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{f.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Audience cards ───────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100 bg-slate-50 py-20 md:py-28">
        <Container>
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Who it's for
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              One platform, three communities
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {audiences.map((a) => (
              <div
                key={a.role}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <div className="mb-5 text-4xl">{a.emoji}</div>
                <p className={`mb-2 text-xs font-semibold uppercase tracking-widest text-${a.accent}-600`}>
                  {a.role}
                </p>
                <h3 className="text-xl font-bold text-slate-900">{a.headline}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-500">{a.body}</p>
                <div className="mt-7">
                  <Link
                    href={a.href}
                    className={`inline-flex items-center gap-1.5 rounded-xl bg-${a.accent}-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-${a.accent}-700`}
                  >
                    {a.cta}
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100 py-20 md:py-28">
        <Container>
          <div className="mx-auto mb-14 max-w-xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Student stories
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Hear from people already building
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <svg className="mb-5 h-8 w-8 text-indigo-200" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="flex-1 text-sm leading-7 text-slate-600">{t.quote}</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.color} text-sm font-bold text-white`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.major}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <Container>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-8 py-16 text-center shadow-2xl shadow-indigo-300/40 md:px-16 md:py-20">
            {/* Background decoration */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-violet-400/20 blur-2xl" />
            </div>

            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">
                Ready to start?
              </p>
              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                Build experience before the job asks for it
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-indigo-200 md:text-lg">
                Join students who are already completing real tasks, earning reviews, and walking into interviews with proof of their skills.
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-indigo-700 shadow-lg shadow-indigo-900/20 transition hover:bg-indigo-50"
                >
                  Create free account
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/30 px-8 py-4 text-base font-semibold text-white transition hover:bg-white/10"
                >
                  I already have an account
                </Link>
              </div>

              <p className="mt-6 text-sm text-indigo-300">
                Free forever for students · No credit card needed
              </p>
            </div>
          </div>
        </Container>
      </section>

    </main>
  );
}
