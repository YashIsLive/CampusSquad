import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/utils";

/** "Explore / COEP AI Club / COEP AI Hackathon" — orientation on deep pages. Last item is the current page. */
export function Breadcrumbs({ items, className }: { items: Array<{ href?: string; label: string }>; className?: string }) {
  // The back button returns to wherever you came from, or to the direct parent if you arrived from outside.
  const parent = [...items].reverse().find((item, i) => i > 0 && item.href)?.href ?? "/";
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <BackButton fallback={parent} />
      <Crumbs items={items} />
    </div>
  );
}

function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
      <ol className="label-mono flex min-w-0 items-center gap-1 text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            // On phones only the direct parent shows, as a back link; the page title is right below anyway.
            <li key={i} className={cn("flex min-w-0 items-center gap-1", last && "truncate")}>
              {i > 0 && <ChevronRight aria-hidden="true" className="size-3 shrink-0 opacity-60" />}
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
  tourId,
}: {
  tourId?: string;
  label: string;
  /** Unique per tab bar on a page, used to name the sliding indicator. */
  id: string;
  tabs: Array<{ href: string; label: string; active: boolean; badge?: ReactNode }>;
  className?: string;
}) {
  return (
    <nav aria-label={label} data-tour={tourId} className={cn("no-scrollbar flex gap-1 overflow-x-auto border-b border-rule", className)}>
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
