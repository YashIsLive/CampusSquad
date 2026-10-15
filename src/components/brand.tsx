import { cn } from "@/lib/utils";

/** Logo mark: an ink tile with a torn-off signal corner, like a ticket stub. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="var(--ink)" />
      <path d="M21 1 h3 a7 7 0 0 1 7 7 v3 z" fill="var(--signal)" />
      <path d="M8.5 19.5 a6 6 0 1 1 6 -7" fill="none" stroke="var(--paper)" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 20.5 c1.5 1.4 6.5 1.6 6.5 -1.4 c0 -3 -6 -1.8 -6 -4.9 c0 -2.6 4.3 -2.7 5.8 -1.3" fill="none" stroke="var(--paper)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark className="size-7" />
      <span className="font-display text-[1.15rem] leading-none font-bold tracking-tight">
        campus<span className="text-signal-ink">squad</span>
      </span>
    </span>
  );
}
