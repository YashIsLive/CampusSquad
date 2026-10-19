"use client";

/**
 * React ignores view transitions the browser skips because the tab is hidden, but it matches the
 * browser's exact error text. Newer Chromium words it "Transition was aborted because of invalid
 * state. Document hidden", which React doesn't recognise, so a harmless skip shows up as a
 * "Recoverable InvalidStateError". This rewrites just that message to the wording React expects.
 * Everything else about the transition is passed through untouched.
 */
const HIDDEN = "Skipping view transition because document visibility state has become hidden.";

export function normalize(error: unknown): unknown {
  if (error instanceof DOMException && error.name === "InvalidStateError" && /hidden|invalid state/i.test(error.message)) {
    return new DOMException(HIDDEN, "InvalidStateError");
  }
  return error;
}

if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
  const doc = document as Document & { __csVtShim?: boolean };
  if (!doc.__csVtShim) {
    doc.__csVtShim = true;
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = ((arg?: Parameters<typeof original>[0]) => {
      const transition = original(arg);
      const wrapped = new Map<PropertyKey, Promise<unknown>>();
      return new Proxy(transition, {
        get(target, prop) {
          if (prop === "ready" || prop === "finished" || prop === "updateCallbackDone") {
            if (!wrapped.has(prop)) {
              wrapped.set(
                prop,
                (Reflect.get(target, prop) as Promise<unknown>).catch((e) => {
                  throw normalize(e);
                }),
              );
            }
            return wrapped.get(prop);
          }
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }) as typeof document.startViewTransition;
  }
}

export function ViewTransitionShim() {
  return null;
}
