import { describe, expect, it } from "vitest";
import { normalize } from "@/components/view-transition-shim";

// React only ignores these exact messages (react-dom customizeViewTransitionError).
const REACT_IGNORES = "Skipping view transition because document visibility state has become hidden.";

describe("view transition shim", () => {
  it("rewrites Chromium's newer 'Document hidden' wording to the one React ignores", () => {
    const out = normalize(new DOMException("Transition was aborted because of invalid state. Document hidden", "InvalidStateError"));
    expect(out).toBeInstanceOf(DOMException);
    expect((out as DOMException).message).toBe(REACT_IGNORES);
  });

  it("leaves every other error alone", () => {
    const abort = new DOMException("Transition was skipped", "AbortError");
    expect(normalize(abort)).toBe(abort);
    const other = new Error("boom");
    expect(normalize(other)).toBe(other);
  });
});
