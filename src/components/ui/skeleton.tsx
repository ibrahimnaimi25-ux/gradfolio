import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-100",
        className
      )}
    />
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="bg-white border border-slate-100 rounded-xl px-5 py-4 flex items-start gap-4">
      <Skeleton className="w-6 h-4 mt-1 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function SectionCardSkeleton() {
  return (
    <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="pt-2 mt-auto border-t border-slate-100">
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}
