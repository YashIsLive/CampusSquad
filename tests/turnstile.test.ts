/**
 * The Turnstile check against Cloudflare's published test keys (real network call):
 * "1x…AA" always passes, "2x…AA" always fails. Skipped offline.
 */
import { afterEach, describe, expect, it } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

const saved = { site: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, secret: process.env.TURNSTILE_SECRET_KEY };
afterEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = saved.site;
  process.env.TURNSTILE_SECRET_KEY = saved.secret;
});
const use = (secret: string) => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
  process.env.TURNSTILE_SECRET_KEY = secret;
};

describe("Turnstile", () => {
  it("is off (always passes) when no keys are configured", async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstile(undefined)).toBe(true);
  });

  it("rejects a missing token when on", async () => {
    use("1x0000000000000000000000000000000AA");
    expect(await verifyTurnstile(null)).toBe(false);
  });

  it("accepts what Cloudflare accepts, rejects what it rejects", async () => {
    use("1x0000000000000000000000000000000AA");
    expect(await verifyTurnstile("XXXX.DUMMY.TOKEN.XXXX")).toBe(true);
    use("2x0000000000000000000000000000000AA");
    expect(await verifyTurnstile("XXXX.DUMMY.TOKEN.XXXX")).toBe(false);
  });
});
