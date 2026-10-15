import type { ReactNode } from "react";
import { TIME_ZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

const monthFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, month: "short" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short" });

/** Calendar tear-off: month in signal mono, big day number. */
export function DateBlock({ date, className, size = "md" }: { date: Date; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center overflow-hidden rounded-md border border-ink/80 bg-paper text-center text-ink",
        size === "sm" && "w-11",
        size === "md" && "w-14",
        size === "lg" && "w-20",
        className,
      )}
    >
      <span className={cn("label-mono w-full bg-ink py-0.5 text-paper", size === "lg" && "py-1")}>{monthFmt.format(date)}</span>
      <span
        className={cn(
          "font-display leading-none font-bold tabular-nums",
          size === "sm" && "pt-1 text-lg",
          size === "md" && "pt-1.5 text-2xl",
          size === "lg" && "pt-2 text-4xl",
        )}
      >
        {dayFmt.format(date)}
      </span>
      <span className={cn("label-mono pb-1 text-[0.6rem] text-muted-foreground", size === "lg" && "pb-1.5")}>{weekdayFmt.format(date)}</span>
    </div>
  );
}

/** Rubber-stamp label ("Closing soon", "Full", "Checked in"). Rotated, animates in once. */
export function Stamp({ children, tone = "signal", className }: { children: ReactNode; tone?: "signal" | "ink" | "ok"; className?: string }) {
  return (
    <span
      className={cn(
        "label-mono inline-block -rotate-[8deg] rounded-sm border-2 px-1.5 py-0.5 font-semibold motion-safe:animate-[stamp-in_420ms_cubic-bezier(0.2,0.7,0.2,1)_both]",
        tone === "signal" && "border-signal text-signal-ink",
        tone === "ink" && "border-ink text-ink",
        tone === "ok" && "border-ok text-ok",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Push-pin dot for pinned items on the board. */
export function Pin({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute top-2 left-1/2 z-10 size-3.5 -translate-x-1/2 rounded-full border-2 border-ink bg-signal shadow-[1px_2px_0_0_rgba(0,0,0,0.35)]", className)}
    />
  );
}

/** Mono metadata row: items separated by thin dots. */
export function MetaLine({ items, className }: { items: Array<ReactNode | false | null | undefined>; className?: string }) {
  const shown = items.filter(Boolean);
  return (
    <p className={cn("label-mono flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground", className)}>
      {shown.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true" className="size-[3px] rounded-full bg-current opacity-60" />}
          {item}
        </span>
      ))}
    </p>
  );
}
