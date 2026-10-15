import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Art = "board" | "team" | "ticket" | "inbox";

/** Line drawings in ink + one signal accent. Decorative only. */
const ART: Record<Art, ReactNode> = {
  // An empty pinboard: a pinned blank note.
  board: (
    <>
      <rect x="14" y="10" width="92" height="62" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="40" y="22" width="40" height="34" rx="2" fill="var(--card)" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" transform="rotate(-4 60 39)" />
      <circle cx="60" cy="22" r="4" fill="var(--signal)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M30 80 h60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // Three seats, one empty.
  team: (
    <>
      <circle cx="32" cy="34" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M18 64 a14 14 0 0 1 28 0" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="88" cy="34" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M74 64 a14 14 0 0 1 28 0" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="60" cy="30" r="10" fill="none" stroke="var(--signal)" strokeWidth="2" strokeDasharray="4 3" />
      <path d="M44 64 a16 16 0 0 1 32 0" fill="none" stroke="var(--signal)" strokeWidth="2" strokeDasharray="4 3" />
      <path d="M14 76 h92" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // A ticket stub.
  ticket: (
    <>
      <path d="M16 24 h88 v10 a8 8 0 0 0 0 16 v10 h-88 v-10 a8 8 0 0 0 0 -16 z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M78 26 v32" stroke="currentColor" strokeWidth="2" strokeDasharray="3 4" />
      <path d="M28 36 h36 M28 46 h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="91" cy="42" r="4" fill="var(--signal)" />
    </>
  ),
  // Inbox tray.
  inbox: (
    <>
      <path d="M20 46 l12 -26 h56 l12 26 v24 h-80 z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 46 h24 a16 16 0 0 0 32 0 h24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M52 28 h16" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
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
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-rule-strong bg-card/50 text-center",
        compact ? "px-4 py-6" : "px-6 py-12",
        className,
      )}
    >
      {art && !compact && (
        <svg viewBox="0 0 120 90" className="mb-1 h-20 w-28 text-ink/70" aria-hidden="true" focusable="false">
          {ART[art]}
        </svg>
      )}
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
