import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * "Remember this device": after a student proves their email on a browser (code, link or Google),
 * that browser may sign in with just email + password for TRUST_DAYS. A password typed anywhere
 * else needs a one-time email code first, so a leaked password alone isn't enough.
 *
 * The cookie holds signed `userId.expiry.signature` tokens (a few accounts per browser). It is
 * httpOnly, so page scripts can't read or copy it, and the HMAC means it can't be forged.
 */
export const TRUST_DAYS = 30;
const COOKIE = "cs_trusted_device";
const MAX_ACCOUNTS = 4;

function secret() {
  const explicit = process.env.AUTH_DEVICE_SECRET;
  if (explicit) return explicit;
  // Derived from a server-only secret so it works without extra setup; set AUTH_DEVICE_SECRET to rotate.
  return createHash("sha256").update(`cs-device:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev"}`).digest("hex");
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** A signed token trusting `userId` on this browser until `exp` (ms). Exported for tests. */
export function makeToken(userId: string, exp: number) {
  return `${userId}.${exp}.${sign(`${userId}.${exp}`)}`;
}

/** Valid, unexpired tokens in a cookie value. Exported for tests. */
export function parse(raw: string | undefined, now = Date.now()) {
  if (!raw) return [];
  return raw
    .split("~")
    .map((t) => {
      const [userId, exp, sig] = t.split(".");
      if (!userId || !exp || !sig) return null;
      const expected = sign(`${userId}.${exp}`);
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      if (Number(exp) < now) return null;
      return { userId, exp: Number(exp), token: t };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
}

export async function isTrustedDevice(userId: string) {
  const jar = await cookies();
  return parse(jar.get(COOKIE)?.value).some((t) => t.userId === userId);
}

export async function trustThisDevice(userId: string) {
  const jar = await cookies();
  const exp = Date.now() + TRUST_DAYS * 24 * 3600 * 1000;
  const fresh = makeToken(userId, exp);
  const others = parse(jar.get(COOKIE)?.value)
    .filter((t) => t.userId !== userId)
    .slice(-(MAX_ACCOUNTS - 1))
    .map((t) => t.token);
  jar.set(COOKIE, [...others, fresh].join("~"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRUST_DAYS * 24 * 3600,
  });
}

export async function forgetThisDevice(userId: string) {
  const jar = await cookies();
  const rest = parse(jar.get(COOKIE)?.value).filter((t) => t.userId !== userId);
  if (rest.length) jar.set(COOKIE, rest.map((t) => t.token).join("~"), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TRUST_DAYS * 24 * 3600 });
  else jar.delete(COOKIE);
}
