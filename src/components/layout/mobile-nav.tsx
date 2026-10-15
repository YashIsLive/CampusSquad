"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { CalendarCheck, Compass, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Explore", icon: Compass, match: (p: string) => p === "/" || (p.startsWith("/events/") && !p.endsWith("/new")) },
  { href: "/me/events", label: "My events", icon: CalendarCheck, match: (p: string) => p.startsWith("/me/events") },
  { href: "/events/new", label: "Post", icon: Plus, match: (p: string) => p === "/events/new" },
  { href: "/me/applications", label: "Teams", icon: Users, match: (p: string) => p.startsWith("/me/applications") || p.startsWith("/teams/") },
];

/** Phone tab bar: 4 big targets (≥ 56px tall), labels always visible, active item marked with an ink bar. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
      style={{ viewTransitionName: "mobile-nav" }}
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && (
                  <ViewTransition name="mobile-nav-indicator" share="slide-indicator" default="none">
                    <span aria-hidden="true" className="absolute top-0 h-0.5 w-10 rounded-full bg-ink" />
                  </ViewTransition>
                )}
                <Icon className={cn("size-5", href === "/events/new" && "rounded-md bg-ink p-0.5 text-paper")} strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
