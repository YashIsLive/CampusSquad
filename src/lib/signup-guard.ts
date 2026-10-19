import "server-only";
import { headers } from "next/headers";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
const LOCAL = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1", "unknown"]);

/** Best-effort client IP (Vercel and most proxies set x-forwarded-for). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Instant sign-up skips Supabase's email-based throttling, so cap new accounts per IP.
 * In-memory per server instance: enough to stop a naive script; put a CAPTCHA in front before
 * a public launch at scale.
 */
export function allowSignup(ip: string, now = Date.now()) {
  // Your own machine during development (tests create many accounts) isn't throttled.
  if (process.env.NODE_ENV !== "production" && LOCAL.has(ip)) return true;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}
