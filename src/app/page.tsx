import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-white text-gray-900">
      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Real Experience for Fresh Graduates
        </p>

        <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
          Build your portfolio by working on real-world tasks
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
          GradFolio helps fresh graduates join practical tasks related to their
          major, submit real work, and grow a portfolio that proves their skills.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/register"
            className="rounded-xl bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700"
          >
            Get Started
          </Link>

          <Link
            href="/tasks"
            className="rounded-xl border border-gray-300 px-6 py-3 text-gray-800 transition hover:bg-gray-100"
          >
            Browse Tasks
          </Link>
        </div>
      </section>
    </main>
  );
}