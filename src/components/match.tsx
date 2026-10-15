import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Match score as a labelled meter: the number carries the meaning, the bar is a glanceable aid. */
export function MatchMeter({ score, className, label = "match" }: { score: number; className?: string; label?: string }) {
  const tone = score >= 75 ? "bg-ok" : score >= 40 ? "bg-type-quiz" : "bg-rule-strong";
  return (
    <div className={cn("flex w-20 shrink-0 flex-col items-end gap-1", className)}>
      <span className="font-display text-lg leading-none font-extrabold tabular-nums">
        {score}
        <span className="text-xs font-bold">%</span>
      </span>
      <span
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${score}% ${label}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(4, score)}%` }} />
      </span>
      <span className="label-mono text-[0.6rem] text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Skill tag. Required skills are solid ink, nice-to-haves outlined. Skills the viewer has get a
 * check mark (not just a colour change) plus screen-reader text.
 */
export function SkillChip({ name, required = true, held = false, level }: { name: string; required?: boolean; held?: boolean; level?: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-xs font-medium",
        required ? "border-ink bg-ink text-paper" : "border-ink/30 text-foreground",
        held && !required && "border-ok",
      )}
    >
      {held && <Check aria-hidden="true" className={cn("size-3", required ? "text-[color:var(--marker)]" : "text-ok")} strokeWidth={3} />}
      {name}
      {level !== undefined && <span className="label-mono opacity-70">L{level}</span>}
      {!required && <span className="sr-only">(nice to have)</span>}
      {held && <span className="sr-only">(you have this)</span>}
    </span>
  );
}
