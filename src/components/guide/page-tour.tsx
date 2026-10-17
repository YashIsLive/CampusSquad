"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { markTourSeen } from "@/app/actions/guide";
import { Button } from "@/components/ui/button";
import { TOURS, type TourKey, type TourStep } from "./tours";

export const START_TOUR_EVENT = "cs:start-tour";

type Rect = { top: number; left: number; width: number; height: number };

function visibleTarget(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Remember within this browser session that a tour auto-ran, so a remount (e.g. a router refresh
// that arrives with stale "not seen" props) never restarts it.
const sessionKey = (tour: TourKey) => `cs-tour-autoran:${tour}`;
function autoRanThisSession(tour: TourKey) {
  try {
    return sessionStorage.getItem(sessionKey(tour)) === "1";
  } catch {
    return false;
  }
}
function markAutoRan(tour: TourKey) {
  try {
    sessionStorage.setItem(sessionKey(tour), "1");
  } catch {
    // Storage unavailable (private mode): the server-side "seen" flag still applies on next load.
  }
}

/**
 * Spotlight tour for one page. Non-blocking: the page stays usable, the current target is ringed
 * and everything else dimmed. Starts automatically the first time (unless `seen`), from a
 * `?tour=<key>&step=<id>` link, or from the header guide menu (START_TOUR_EVENT).
 */
export function PageTour({ tour, seen }: { tour: TourKey; seen: boolean }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const finishedRef = useRef(seen);

  const start = useCallback(
    (stepId?: string) => {
      const available = TOURS[tour].steps.filter((s) => visibleTarget(s.id));
      if (available.length === 0) return;
      returnFocus.current = document.activeElement as HTMLElement | null;
      const at = stepId ? Math.max(0, available.findIndex((s) => s.id === stepId)) : 0;
      setSteps(available);
      setIndex(at);
    },
    [tour],
  );

  const close = useCallback(() => {
    setSteps(null);
    setRect(null);
    if (!finishedRef.current) {
      finishedRef.current = true;
      void markTourSeen({ tour });
    }
    returnFocus.current?.focus?.();
  }, [tour]);

  // Entry points: deep link, header menu, first visit.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get("tour") === tour;
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent<{ tour?: TourKey }>).detail;
      if (!detail?.tour || detail.tour === tour) start();
    };
    window.addEventListener(START_TOUR_EVENT, onStart);
    const t = setTimeout(
      () => {
        if (fromLink) {
          start(params.get("step") ?? undefined);
          params.delete("tour");
          params.delete("step");
          const qs = params.toString();
          history.replaceState(history.state, "", window.location.pathname + (qs ? `?${qs}` : ""));
        } else if (!seen && !autoRanThisSession(tour)) {
          markAutoRan(tour);
          start();
        }
      },
      fromLink ? 350 : 900,
    );
    return () => {
      clearTimeout(t);
      window.removeEventListener(START_TOUR_EVENT, onStart);
    };
  }, [tour, seen, start]);

  const step = steps?.[index];

  // Keep the spotlight glued to the target: track it every frame while a step is showing, so
  // entrance animations, scrolling, resizes and late layout shifts never leave it misaligned.
  useLayoutEffect(() => {
    if (!step) return;
    const el = visibleTarget(step.id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    let raf = 0;
    let last: Rect | null = null;
    const tick = () => {
      const r = el.getBoundingClientRect();
      if (!last || Math.abs(r.top - last.top) > 0.5 || Math.abs(r.left - last.left) > 0.5 || Math.abs(r.width - last.width) > 0.5 || Math.abs(r.height - last.height) > 0.5) {
        last = { top: r.top, left: r.left, width: r.width, height: r.height };
        setRect(last);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (step) cardRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Escape closes the tour wherever focus is (the page stays usable while it's open).
  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog][data-open], [role=menu]")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, close]);

  if (!steps || !step || typeof document === "undefined") return null;

  const last = index === steps.length - 1;
  const next = () => (last ? close() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const pad = 6;
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const below = hole ? hole.top + hole.height + 12 : 0;
  const placeAbove = hole ? below + 220 > viewportH && hole.top > 240 : false;
  const cardLeft = hole ? Math.min(Math.max(12, hole.left), viewportW - 352) : 12;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]" data-testid="page-tour">
      {hole && (
        <div
          aria-hidden="true"
          className="absolute rounded-lg outline-2 outline-offset-0 outline-signal transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
          style={{ ...hole, boxShadow: "0 0 0 9999px rgba(20, 17, 14, 0.55)" }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") next();
          if (e.key === "ArrowLeft") back();
        }}
        className="pointer-events-auto fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] w-auto rounded-lg border border-ink bg-card p-4 text-card-foreground shadow-ink outline-none motion-safe:animate-rise sm:inset-x-auto sm:bottom-auto sm:w-[340px]"
        style={
          hole && viewportW >= 640
            ? placeAbove
              ? { left: cardLeft, top: Math.max(12, hole.top - 12), transform: "translateY(-100%)" }
              : { left: cardLeft, top: Math.min(below, viewportH - 220) }
            : undefined
        }
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="label-mono text-muted-foreground" aria-live="polite">
            {TOURS[tour].label} · {index + 1} of {steps.length}
          </p>
          <button type="button" onClick={close} aria-label="Close tour" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" className="text-lg leading-snug font-bold">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1 text-sm text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.id} className={i === index ? "h-1.5 w-4 rounded-full bg-ink" : "size-1.5 rounded-full bg-rule-strong"} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {index > 0 && (
              <Button size="sm" variant="ghost" onClick={back} aria-label="Previous step">
                <ArrowLeft />
              </Button>
            )}
            <Button size="sm" variant="ink" onClick={next}>
              {last ? "Done" : "Next"} {!last && <ArrowRight />}
            </Button>
          </div>
        </div>
        {!last && (
          <button type="button" onClick={close} className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline">
            Skip tour
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
