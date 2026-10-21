import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-options";

describe("Sentry scrubbing", () => {
  it("strips personal data before an error report leaves the app", () => {
    const event = {
      type: undefined,
      message: "Failed for riya@coep.seed.test with code W76BYZH9NT",
      user: { id: "u1", email: "riya@coep.seed.test", ip_address: "1.2.3.4" },
      request: {
        cookies: { "sb-access-token": "secret" },
        data: { password: "hunter2" },
        headers: { cookie: "a=b", authorization: "Bearer x", "x-forwarded-for": "1.2.3.4", "user-agent": "test" },
        query_string: "token_hash=abc&next=%2Fme&tab=teams",
      },
      exception: { values: [{ type: "Error", value: "No profile for meera@pict.seed.test" }] },
      breadcrumbs: [{ message: "signed in as aarav@coep.seed.test" }],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event)!;
    expect(out.user).toEqual({ id: "u1" });
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.headers).toEqual({ "user-agent": "test" });
    expect(out.request?.query_string).toBe("token_hash=[removed]&next=[removed]&tab=teams");
    expect(out.message).toBe("Failed for [email] with code [code]");
    expect(out.exception?.values?.[0].value).toBe("No profile for [email]");
    expect(out.breadcrumbs?.[0].message).toBe("signed in as [email]");
  });
});
