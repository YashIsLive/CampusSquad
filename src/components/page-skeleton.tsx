import { Skeleton } from "@/components/ui/skeleton";

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
