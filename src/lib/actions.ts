import "server-only";
import { z } from "zod";
import { AppError, toUserMessage } from "@/lib/errors";
import { getCurrentUser, needsConsent, type CurrentUser } from "@/lib/auth";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Wraps a server action: validates input with Zod, requires a signed-in (and by default onboarded) user,
 * and converts thrown errors into a safe `{ ok: false, error }` result.
 */
export function authedAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, user: CurrentUser) => Promise<T>,
  opts: { allowUnonboarded?: boolean } = {},
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      const first = Object.values(flat.fieldErrors).flat()[0] ?? flat.formErrors[0];
      return {
        ok: false,
        error: typeof first === "string" ? first : "Please check the form.",
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
      };
    }
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Please sign in first." };
    if (!opts.allowUnonboarded && !user.onboardedAt) {
      return { ok: false, error: "Finish your profile first." };
    }
    if (!opts.allowUnonboarded && needsConsent(user)) {
      return { ok: false, error: "Please accept the updated terms first (reload the page)." };
    }
    try {
      return { ok: true, data: await handler(parsed.data, user) };
    } catch (err) {
      // redirect()/notFound() throw special errors that must propagate.
      if (isNextControlFlow(err)) throw err;
      return { ok: false, error: toUserMessage(err) };
    }
  };
}

export function fail(message: string): never {
  throw new AppError(message);
}

function isNextControlFlow(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}
