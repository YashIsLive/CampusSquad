import type { ReactNode } from "react";
import { TIME_ZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Team-sheet primitives shared across pages. (File name kept from the first design so imports
 * stay stable.)
 */

const monthFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, month: "short" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short" });

/** Fixture date: big condensed day number, month and weekday in small caps. */
export function DateBlock({ date, className, size = "md" }: { date: Date; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center text-center leading-none", size === "lg" ? "w-16" : "w-11", className)}>
      <span className="label-mono text-muted-foreground">{monthFmt.format(date)}</span>
      <span className={cn("score", size === "sm" && "text-[1.9rem]", size === "md" && "text-[2.3rem]", size === "lg" && "text-[3.4rem]")}>
        {dayFmt.format(date)}
      </span>
      <span className="label-mono text-muted-foreground">{weekdayFmt.format(date)}</span>
    </div>
  );
}

/** Flat status tag ("Closing soon", "Full", "Checked in"). */
export function Stamp({ children, tone = "signal", className }: { children: ReactNode; tone?: "signal" | "ink" | "ok"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap",
        tone === "signal" && "bg-signal-soft text-signal-ink",
        tone === "ink" && "bg-ink text-paper",
        tone === "ok" && "bg-ok/12 text-ok",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A quiet line of facts separated by dots: "Offline · Pune · Teams of 2–4". */
export function MetaLine({ items, className }: { items: Array<ReactNode | false | null | undefined>; className?: string }) {
  const shown = items.filter(Boolean);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground", className)}>
      {shown.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

/**
 * Team spots as dots — filled are taken, lime are open: ●●○○.
 * The same motif as the logo, so "a spot is open" reads the same everywhere.
 */
export function Slots({
  filled,
  total,
  className,
  size = "sm",
}: {
  filled: number;
  total: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const shown = Math.min(Math.max(total, 0), 12);
  const taken = Math.min(filled, shown);
  return (
    <span role="img" aria-label={`${taken} of ${total} spots taken`} className={cn("inline-flex items-center gap-1", className)}>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full",
            size === "sm" ? "size-2.5" : "size-3.5",
            i < taken ? "bg-ink" : "bg-court ring-1 ring-ink/25 ring-inset motion-safe:animate-[slot-fill_320ms_var(--ease-out)_both]",
          )}
          style={i >= taken ? { animationDelay: `${(i - taken) * 60}ms` } : undefined}
        />
      ))}
    </span>
  );
}
