import * as Sentry from "@sentry/nextjs";
import { baseOptions } from "@/lib/sentry-options";

/** Browser error tracking (off without NEXT_PUBLIC_SENTRY_DSN). No session replay: it would record personal data. */
Sentry.init(baseOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
