import Link from "next/link";
import type { ReactNode } from "react";
import { Slots } from "@/components/noticeboard";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export type SheetMember = { id: string; name: string; avatarUrl?: string | null; href?: string; detail?: ReactNode; trailing?: ReactNode };
export type SheetOpening = { id: string; role: string; detail?: ReactNode; trailing?: ReactNode };

/**
 * A team as a numbered sheet: taken spots, open spots (lime — "who's got next?"), and spots
 * nobody has asked for yet. The visual centre of Got Next.
 */
export function TeamSheet({
  name,
  subtitle,
  size,
  members,
  openings = [],
  className,
  headingLevel = "h2",
  footer,
}: {
  name: ReactNode;
  subtitle?: ReactNode;
  /** Maximum team size for the event. */
  size: number;
  members: SheetMember[];
  openings?: SheetOpening[];
  className?: string;
  headingLevel?: "h2" | "h3";
  footer?: ReactNode;
}) {
  const Heading = headingLevel;
  const blanks = Math.max(0, size - members.length - openings.length);
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <section className={cn("overflow-hidden rounded-xl border border-ink bg-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-ink px-4 py-3">
        <div className="min-w-0">
          <Heading className="truncate text-xl font-extrabold">{name}</Heading>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="score text-2xl">
            {members.length}
            <span className="text-muted-foreground">/{size}</span>
          </span>
          <Slots filled={members.length} total={size} />
        </div>
      </header>
      <ol>
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-b border-rule px-4 py-2.5 last:border-b-0">
            <span className="score w-6 shrink-0 text-lg text-muted-foreground">{num()}</span>
            <UserAvatar name={m.name} src={m.avatarUrl ?? null} className="size-8" />
            <div className="min-w-0 flex-1">
              {m.href ? (
                <Link href={m.href} className="font-medium hover:underline">
                  {m.name}
                </Link>
              ) : (
                <p className="font-medium">{m.name}</p>
              )}
              {m.detail && <div className="truncate text-xs text-muted-foreground">{m.detail}</div>}
            </div>
            {m.trailing}
          </li>
        ))}
        {openings.map((o) => (
          <li key={o.id} className="flex items-center gap-3 border-b border-rule bg-court/35 px-4 py-2.5 last:border-b-0">
            <span className="score w-6 shrink-0 text-lg">{num()}</span>
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-full border-2 border-dashed border-ink/50 text-xs font-bold">
              ?
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                <span className="sr-only">Open spot: </span>
                {o.role}
              </p>
              {o.detail && <div className="truncate text-xs text-foreground/70">{o.detail}</div>}
            </div>
            {o.trailing}
          </li>
        ))}
        {Array.from({ length: blanks }, () => (
          <li key={`blank-${n}`} className="flex items-center gap-3 border-b border-rule px-4 py-2.5 text-muted-foreground last:border-b-0">
            <span className="score w-6 shrink-0 text-lg">{num()}</span>
            <span aria-hidden="true" className="size-8 rounded-full border border-dashed border-rule-strong" />
            <span className="text-sm">Free spot</span>
          </li>
        ))}
      </ol>
      {footer && <div className="border-t border-ink px-4 py-3">{footer}</div>}
    </section>
  );
}
