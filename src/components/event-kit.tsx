import { CircleHelp, Flag, Lightbulb, SquareTerminal, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { schema } from "@/db";
import { TIME_ZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

type EventType = (typeof schema.eventType.enumValues)[number];

export const TYPE_ICON: Record<EventType, LucideIcon> = {
  hackathon: Zap,
  quiz: CircleHelp,
  coding_contest: SquareTerminal,
  workshop: Wrench,
  ideathon: Lightbulb,
  ctf: Flag,
};

const weekday = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, weekday: "short" });
const day = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric" });
const month = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, month: "short" });

/**
 * The date in the event type's "kit": its colour and pattern, like a team jersey.
 * Hackathons are striped, quizzes dotted, contests lined, workshops gridded, ideathons ringed, CTFs checkered.
 */
export function KitTile({ type, date, className, size = "md" }: { type: EventType; date: Date; className?: string; size?: "md" | "lg" }) {
  const Icon = TYPE_ICON[type];
  return (
    <div
      className={cn(`kit kit-${type} flex flex-col items-center justify-between py-3 text-center`, className)}
      style={{ "--kit-bg": `var(--type-${type})`, "--kit-fg": `var(--type-fg-${type})` } as React.CSSProperties}
    >
      <span className="text-xs font-bold tracking-wide uppercase">{weekday.format(date)}</span>
      <span className={cn("score", size === "md" ? "text-[3.1rem]" : "text-[4.4rem]")}>{day.format(date)}</span>
      <span className="text-xs font-bold tracking-wide uppercase">{month.format(date)}</span>
      <Icon aria-hidden="true" className={cn("mt-1", size === "md" ? "size-4" : "size-5")} strokeWidth={2.4} />
    </div>
  );
}
