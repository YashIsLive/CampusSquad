"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, MousePointerClick, X } from "lucide-react";
import { markTourSeen } from "@/app/actions/guide";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOURS, type TourKey, type TourStep } from "./tours";

export const START_TOUR_EVENT = "cs:start-tour";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8; // breathing room around the target
const HEADER = 64; // sticky header height + a little
const CARD_W = 360;
const MOVE_MS = 520;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  top: lerp(a.top, b.top, t),
  left: lerp(a.left, b.left, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
});
const same = (a: Rect, b: Rect) =>
  Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

function visibleTarget(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

const toRect = (r: DOMRect): Rect => ({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
const isPhone = () => window.innerWidth < 640;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How far to scroll so the target sits comfortably in view, leaving room for the card. */
function scrollDeltaFor(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  // On phones the card is pinned to the bottom; on desktop it sits next to the target.
  const bottomReserve = isPhone() ? 300 : 40;
  const top = HEADER + PAD;
  const bottom = window.innerHeight - bottomReserve;
  if (r.top >= top && r.bottom <= bottom) return 0;
  const room = bottom - top;
  const desiredTop = r.height < room ? top + (room - r.height) / 3 : top;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const next = Math.min(Math.max(0, window.scrollY + r.top - desiredTop), Math.max(0, max));
  return next - window.scrollY;
}

/** Card goes below the target if it fits, else above, else (tall targets) pinned at the bottom. */
type Placement = "below" | "above" | "overlay";
function placementFor(hole: Rect): Placement {
  const below = window.innerHeight - (hole.top + hole.height);
  if (below >= 230) return "below";
  if (hole.top - HEADER >= 230) return "above";
  return "overlay";
}

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
 * and everything else dimmed. One animation drives the page scroll, the spotlight and the card
 * together, so moving between steps is a single smooth glide instead of competing motions.
 *
 * Starts automatically the first time (with a short intro, unless `seen`), from a
 * `?tour=<key>&step=<id>` link, or from the header guide menu (START_TOUR_EVENT).
 */
export function PageTour({ tour, seen }: { tour: TourKey; seen: boolean }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  /** -1 = intro card. */
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<Placement>("below");
  const holeRef = useRef<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const finishedRef = useRef(seen);

  const showHole = useCallback((r: Rect | null) => {
    holeRef.current = r;
    setHole(r);
  }, []);

  const start = useCallback(
    (opts: { stepId?: string; intro?: boolean } = {}) => {
      const available = TOURS[tour].steps.filter((s) => visibleTarget(s.id));
      if (available.length === 0) return;
      returnFocus.current = document.activeElement as HTMLElement | null;
      const at = opts.stepId ? Math.max(0, available.findIndex((s) => s.id === opts.stepId)) : 0;
      setSteps(available);
      setIndex(opts.intro ? -1 : at);
    },
    [tour],
  );

  const close = useCallback(() => {
    setSteps(null);
    showHole(null);
    if (!finishedRef.current) {
      finishedRef.current = true;
      void markTourSeen({ tour });
    }
    returnFocus.current?.focus?.();
  }, [tour, showHole]);

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
          start({ stepId: params.get("step") ?? undefined });
          params.delete("tour");
          params.delete("step");
          const qs = params.toString();
          history.replaceState(history.state, "", window.location.pathname + (qs ? `?${qs}` : ""));
        } else if (!seen && !autoRanThisSession(tour)) {
          markAutoRan(tour);
          start({ intro: true });
        }
      },
      fromLink ? 350 : 900,
    );
    return () => {
      clearTimeout(t);
      window.removeEventListener(START_TOUR_EVENT, onStart);
    };
  }, [tour, seen, start]);

  const step = steps && index >= 0 ? steps[index] : undefined;

  // Move to the current step: scroll, spotlight and card glide together on one eased timeline,
  // then keep following the target (user scrolling, late layout shifts) without animation.
  useLayoutEffect(() => {
    if (!step) return;
    const el = visibleTarget(step.id);
    if (!el) return;

    let raf = 0;
    const delta = scrollDeltaFor(el);
    const startY = window.scrollY;
    const to = toRect(el.getBoundingClientRect());
    to.top -= delta; // where it will be once the scroll finishes
    const place = placementFor(to);
    const from = holeRef.current;
    let placed = false;
    const placeOnce = () => {
      if (placed) return;
      placed = true;
      setPlacement(place);
    };

    const follow = () => {
      placeOnce();
      const now = toRect(el.getBoundingClientRect());
      if (!holeRef.current || !same(now, holeRef.current)) showHole(now);
      raf = requestAnimationFrame(follow);
    };

    if (prefersReducedMotion() || (!from && delta === 0)) {
      if (delta) window.scrollTo({ top: startY + delta, behavior: "instant" });
      raf = requestAnimationFrame(follow);
    } else {
      const t0 = performance.now();
      const glide = (now: number) => {
        placeOnce();
        const t = Math.min(1, (now - t0) / MOVE_MS);
        const e = easeInOut(t);
        if (delta) window.scrollTo({ top: startY + delta * e, behavior: "instant" });
        // Re-measure the destination each frame so content shifting mid-glide is absorbed.
        const live = toRect(el.getBoundingClientRect());
        showHole(from ? lerpRect(from, live, e) : live);
        if (t < 1) raf = requestAnimationFrame(glide);
        else follow();
      };
      raf = requestAnimationFrame(glide);
    }
    return () => cancelAnimationFrame(raf);
  }, [step, showHole]);

  // Re-pick card placement when the window changes size.
  useEffect(() => {
    if (!steps) return;
    const onResize = () => holeRef.current && setPlacement(placementFor(holeRef.current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [steps]);

  useEffect(() => {
    if (steps) cardRef.current?.focus({ preventScroll: true });
  }, [steps, index]);

  // Escape closes the tour wherever focus is (the page stays usable while it's open).
  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog][data-open], [role=menu]")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, close]);

  if (!steps || typeof document === "undefined") return null;

  const meta = TOURS[tour];
  const intro = index === -1;
  const last = index === steps.length - 1;
  const next = () => (last ? close() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Desktop: the card rides along with the spotlight. Phone: pinned above the bottom nav.
  const desktop = typeof window !== "undefined" && !isPhone();
  let cardStyle: React.CSSProperties | undefined;
  let arrowLeft = 24;
  if (desktop && hole && !intro) {
    const left = Math.min(Math.max(12, hole.left), window.innerWidth - CARD_W - 12);
    arrowLeft = Math.min(Math.max(20, hole.left + Math.min(hole.width, 120) / 2 - left), CARD_W - 28);
    cardStyle =
      placement === "below"
        ? { left, top: hole.top + hole.height + 14 }
        : placement === "above"
          ? { left, top: hole.top - 14, transform: "translateY(-100%)" }
          : { left, bottom: 16 };
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]" data-testid="page-tour">
      {intro ? (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(20,17,14,0.55)] motion-safe:animate-[tour-fade_240ms_ease-out_both]" />
      ) : (
        hole && (
          <div aria-hidden="true" className="absolute rounded-xl" style={{ ...hole, boxShadow: "0 0 0 9999px rgba(20, 17, 14, 0.55)" }}>
            <div className="absolute inset-0 rounded-xl outline-2 outline-signal" />
            <div className="absolute inset-0 rounded-xl motion-safe:animate-[tour-pulse_1.8s_ease-out_infinite]" />
          </div>
        )
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (intro) return;
          if (e.key === "ArrowRight") next();
          if (e.key === "ArrowLeft") back();
        }}
        className={cn(
          "pointer-events-auto fixed rounded-xl border border-ink bg-card p-4 text-card-foreground shadow-ink outline-none",
          intro
            ? "inset-x-4 top-1/2 mx-auto max-w-sm -translate-y-1/2 motion-safe:animate-rise"
            : "inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto sm:w-[360px]",
          !intro && !cardStyle && "motion-safe:animate-rise",
        )}
        style={cardStyle}
      >
        {desktop && !intro && placement !== "overlay" && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute size-3 rotate-45 border-ink bg-card",
              placement === "below" ? "-top-[7px] border-t border-l" : "-bottom-[7px] border-r border-b",
            )}
            style={{ left: arrowLeft }}
          />
        )}

        {intro ? (
          <>
            <div className="mb-2 flex items-center gap-2 text-signal">
              <Compass className="size-5" aria-hidden="true" />
              <p className="label-mono">
                {meta.label} · {steps.length} stops
              </p>
            </div>
            <h2 id="tour-title" className="text-xl leading-snug font-extrabold">
              {meta.intro.title}
            </h2>
            <p id="tour-body" className="mt-1.5 text-sm text-muted-foreground">
              {meta.intro.body}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ink" onClick={() => setIndex(0)} autoFocus>
                Show me around <ArrowRight />
              </Button>
              <Button variant="ghost" onClick={close}>
                Not now
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">You can replay it any time from the ? button at the top.</p>
          </>
        ) : (
          step && (
            <>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="label-mono text-muted-foreground" aria-live="polite">
                  {meta.label} · {index + 1} of {steps.length}
                </p>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close tour"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              {/* Keyed so each step's text eases in instead of snapping. */}
              <div key={step.id} className="motion-safe:animate-[tour-swap_260ms_ease-out_both]">
                <h2 id="tour-title" className="text-lg leading-snug font-bold">
                  {step.title}
                </h2>
                <p id="tour-body" className="mt-1 text-sm text-muted-foreground">
                  {step.body}
                </p>
                {step.tryIt && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-md bg-signal-soft/60 px-2.5 py-1.5 text-xs text-foreground">
                    <MousePointerClick className="mt-px size-3.5 shrink-0 text-signal" aria-hidden="true" />
                    {step.tryIt}
                  </p>
                )}
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {!last ? (
                  <button type="button" onClick={close} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                    Skip tour
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Replay from the ? menu.</span>
                )}
                <div className="flex gap-1.5">
                  {index > 0 && (
                    <Button size="sm" variant="ghost" onClick={back} aria-label="Previous step">
                      <ArrowLeft />
                    </Button>
                  )}
                  <Button size="sm" variant="ink" onClick={next}>
                    {last ? "Got it" : "Next"} {!last && <ArrowRight />}
                  </Button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>,
    document.body,
  );
}
