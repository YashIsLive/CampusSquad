import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Error tracking (Sentry), shared by browser, server and edge.
 * Off unless NEXT_PUBLIC_SENTRY_DSN is set. Built to send no personal data: no emails, IPs,
 * cookies, auth headers, entry codes or request bodies leave the app.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CODE = /\b[A-HJ-NP-Z2-9]{10}\b/g; // check-in codes
const scrub = (s: string) => s.replace(EMAIL, "[email]").replace(CODE, "[code]");

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/cookie|authorization|x-forwarded-for|x-real-ip/i.test(h)) delete event.request.headers[h];
      }
    }
    if (event.request.query_string && typeof event.request.query_string === "string") {
      event.request.query_string = event.request.query_string.replace(/(token_hash|code|next)=[^&]*/g, "$1=[removed]");
    }
  }
  if (event.message) event.message = scrub(event.message);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrub(ex.value);
  event.breadcrumbs = event.breadcrumbs?.map((b) => (b.message ? { ...b, message: scrub(b.message) } : b));
  return event;
}

export const baseOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  // Errors are what matter at this size; a small slice of traces shows slow pages.
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
};
