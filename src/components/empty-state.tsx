import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Art = "board" | "team" | "ticket" | "inbox";

/** The dot motif from the logo: how many spots are taken in each situation. Decorative only. */
const ART: Record<Art, { taken: number; total: number }> = {
  board: { taken: 0, total: 4 }, // nothing posted yet
  team: { taken: 2, total: 4 }, // a team still looking
  ticket: { taken: 1, total: 1 }, // just you
  inbox: { taken: 0, total: 3 }, // nothing new
};

export function EmptyState({
  title,
  description,
  action,
  compact = false,
  icon,
  art,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  icon?: ReactNode;
  art?: Art;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-rule bg-card text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
        className,
      )}
    >
      {art && !compact && (
        <span aria-hidden="true" className="mb-2 flex gap-2">
          {Array.from({ length: ART[art].total }, (_, i) => (
            <span
              key={i}
              className={cn("size-5 rounded-full", i < ART[art].taken ? "bg-ink" : "border-2 border-dashed border-rule-strong")}
            />
          ))}
        </span>
      )}
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
