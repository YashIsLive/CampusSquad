import "server-only";
import { clientIp } from "@/lib/signup-guard";

/**
 * Cloudflare Turnstile: a bot check on sign-up, sign-in, email links and password reset.
 * Off when TURNSTILE_SECRET_KEY isn't set (local development and tests); required in production.
 */
export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/** True if the token is valid (or the check is switched off). Tokens are single-use. */
export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  const ip = await clientIp().catch(() => null);
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare unreachable: fail closed, the person can try again.
    return false;
  }
}

export const TURNSTILE_FAILED = "Please complete the check that you're human, then try again.";
