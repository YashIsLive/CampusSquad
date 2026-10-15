import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Explore / COEP AI Club / COEP AI Hackathon" — orientation on deep pages. Last item is the current page. */
export function Breadcrumbs({ items, className }: { items: Array<{ href?: string; label: string }>; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="label-mono flex min-w-0 items-center gap-1 text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          const parent = i === items.length - 2;
          return (
            // On phones only the direct parent shows, as a back link; the page title is right below anyway.
            <li key={i} className={cn("min-w-0 items-center gap-1", parent ? "flex" : "hidden sm:flex", last && "truncate")}>
              {i > 0 && <ChevronRight aria-hidden="true" className={cn("size-3 shrink-0 opacity-60", parent && "hidden sm:block")} />}
              {parent && <ChevronLeft aria-hidden="true" className="size-3.5 shrink-0 sm:hidden" />}
              {item.href && !last ? (
                <Link href={item.href} className="truncate rounded-sm py-1 hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="truncate text-foreground">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Link-based tabs (server rendered, shareable URLs). The active underline is a named view
 * transition, so it slides to the new tab when you switch.
 */
export function TabNav({
  label,
  id,
  tabs,
  className,
}: {
  label: string;
  /** Unique per tab bar on a page, used to name the sliding indicator. */
  id: string;
  tabs: Array<{ href: string; label: string; active: boolean; badge?: ReactNode }>;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("no-scrollbar flex gap-1 overflow-x-auto border-b border-rule", className)}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "relative flex h-11 shrink-0 items-center gap-2 px-3 text-sm transition-colors",
            t.active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.badge}
          {t.active && (
            <ViewTransition name={`tab-indicator-${id}`} share="slide-indicator" default="none">
              <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-sm bg-ink" />
            </ViewTransition>
          )}
        </Link>
      ))}
    </nav>
  );
}
