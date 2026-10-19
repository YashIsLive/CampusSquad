import { cn } from "@/lib/utils";

/**
 * The mark: a team of four with one spot still open (●●●○).
 * That open spot is the whole idea of Got Next — someone's got next.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <circle cx="11" cy="11" r="4.25" fill="var(--paper)" />
      <circle cx="21" cy="11" r="4.25" fill="var(--paper)" />
      <circle cx="11" cy="21" r="4.25" fill="var(--paper)" />
      <circle cx="21" cy="21" r="4.25" fill="var(--court)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark className="size-7" />
      <span className="font-display text-[1.2rem] leading-none font-extrabold tracking-[-0.04em] [font-stretch:118%]">
        got next
      </span>
    </span>
  );
}
