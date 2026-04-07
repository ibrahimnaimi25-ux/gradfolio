import { SectionCardSkeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-100 px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="h-8 w-24 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-4 w-72 rounded-xl bg-slate-100 animate-pulse" />
          <div className="flex gap-6 mt-4">
            <div className="h-4 w-20 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-4 w-16 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-4 w-20 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="h-4 w-32 rounded-xl bg-slate-100 animate-pulse" />
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((j) => (
                <SectionCardSkeleton key={j} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

