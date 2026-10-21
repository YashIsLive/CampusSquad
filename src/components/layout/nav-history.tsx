"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    /** Pages visited inside the app in this tab, oldest first (see BackButton). */
    __gotNextTrail?: string[];
  }
}

/**
 * Keeps the trail of in-app pages so "Back" knows whether going back stays on Got Next.
 * Arriving at the page before the current one counts as going back (pop); anything else is
 * forward (push). Works the same for our Back button and the browser's.
 */
export function NavHistory() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const key = `${pathname}?${search}`;
    const trail = (window.__gotNextTrail ??= []);
    if (trail.at(-1) === key) return; // same page (React may run effects twice in development)
    if (trail.at(-2) === key) trail.pop();
    else trail.push(key);
  }, [pathname, search]);
  return null;
}

/** True when the previous page in this tab's history is a Got Next page. */
export function canGoBackInApp() {
  return (window.__gotNextTrail?.length ?? 0) > 1;
}
