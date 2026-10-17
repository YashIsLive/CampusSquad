"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin progress bar at the top of the window during page navigations. Starts on any same-origin
 * link click, finishes when the new route renders. Purely visual (screen readers get Next's
 * route announcer), and silent when motion is reduced.
 */
export function NavProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      clearTimeout(timer.current);
      // Only show for navigations that take a moment.
      timer.current = setTimeout(() => setState("loading"), 120);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // When the route changes, finish the bar (state adjusted during render, not in an effect).
  const routeKey = `${pathname}?${params.toString()}`;
  const [prevKey, setPrevKey] = useState(routeKey);
  if (prevKey !== routeKey) {
    setPrevKey(routeKey);
    setState((s) => (s === "loading" ? "done" : "idle"));
  }

  useEffect(() => {
    clearTimeout(timer.current);
  }, [routeKey]);

  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setState("idle"), 300);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 motion-reduce:hidden"
    >
      <div
        className="h-full bg-signal transition-[width,opacity] ease-out"
        style={{
          width: state === "idle" ? "0%" : state === "loading" ? "75%" : "100%",
          opacity: state === "idle" ? 0 : 1,
          transitionDuration: state === "loading" ? "8s, 150ms" : "200ms, 300ms",
        }}
      />
    </div>
  );
}
