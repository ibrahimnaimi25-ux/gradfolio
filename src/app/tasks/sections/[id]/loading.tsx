import { TaskCardSkeleton } from "@/components/ui/skeleton";

export default function SectionLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-3">
          <div className="h-4 w-32 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-3 w-20 rounded-xl bg-slate-100 animate-pulse mt-4" />
          <div className="h-7 w-64 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-4 w-96 rounded-xl bg-slate-100 animate-pulse" />
          <div className="flex gap-8 pt-2">
            <div className="space-y-1">
              <div className="h-3 w-10 rounded bg-slate-100 animate-pulse" />
              <div className="h-7 w-8 rounded-xl bg-slate-100 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-14 rounded bg-slate-100 animate-pulse" />
              <div className="h-5 w-28 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
