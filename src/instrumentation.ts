import * as Sentry from "@sentry/nextjs";
import { baseOptions } from "@/lib/sentry-options";

/** Server and edge error tracking (off without NEXT_PUBLIC_SENTRY_DSN). */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(baseOptions);
  }
}

/** Errors thrown while rendering or in server actions/route handlers. */
export const onRequestError = Sentry.captureRequestError;
