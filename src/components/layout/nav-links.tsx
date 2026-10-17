"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { cn } from "@/lib/utils";

export const PRIMARY_NAV = [
  { href: "/", label: "Explore", match: (p: string) => p === "/" || p.startsWith("/events/") && !p.endsWith("/new") },
  { href: "/me/events", label: "My events", match: (p: string) => p.startsWith("/me/events") },
  { href: "/me/applications", label: "Teams", match: (p: string) => p.startsWith("/me/applications") || p.startsWith("/teams/") },
];

/** Desktop primary nav. The underline is a shared view-transition element, so it slides between items. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden h-full items-stretch gap-1 sm:flex">
      {PRIMARY_NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            data-tour={item.href === "/me/applications" ? "teams-nav" : undefined}
            className={cn(
              "relative flex items-center px-2.5 text-sm transition-colors",
              active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {active && (
              <ViewTransition name="nav-underline" share="slide-indicator" default="none">
                <span aria-hidden="true" className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-ink" />
              </ViewTransition>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
