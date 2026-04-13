"use client";

import Link from "next/link";
import { useTransition } from "react";

type Step = {
  label: string;
  done: boolean;
};

type OnboardingBannerProps = {
  profileUrl: string;
  steps: Step[];
  dismiss: () => Promise<void>;
};

export default function OnboardingBanner({
  profileUrl,
  steps,
  dismiss,
}: OnboardingBannerProps) {
  const [pending, startTransition] = useTransition();
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  function handleDismiss() {
    startTransition(async () => {
      await dismiss();
    });
  }

  if (allDone) return null;

  return (
    <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 md:p-8 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

        {/* Left: heading + checklist */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-base">
              🎓
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Complete your GradFolio profile
            </h2>
          </div>
          <p className="mt-1 mb-4 text-sm text-slate-500 pl-12">
            A complete profile makes you more visible to your program coordinator and helps showcase your work.
          </p>

          {/* Steps */}
          <div className="pl-12 flex flex-wrap gap-3 mb-4">
            {steps.map((step) => (
              <span
                key={step.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                  step.done
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-white text-slate-500 ring-slate-200"
                }`}
              >
                {step.done ? (
                  <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 inline-block" />
                )}
                {step.label}
              </span>
            ))}
          </div>

          {/* Progress bar */}
          <div className="pl-12">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/70 overflow-hidden border border-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-semibold text-indigo-700">
                {doneCount} / {steps.length} done
              </span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3 pl-12 md:pl-0 shrink-0">
          <Link
            href={profileUrl}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-sm"
          >
            Complete profile
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <button
            onClick={handleDismiss}
            disabled={pending}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      </div>
    </section>
  );
}
