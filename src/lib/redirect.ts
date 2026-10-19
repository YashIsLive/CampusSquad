import { NextResponse } from "next/server";

/**
 * Redirect to a path on this site using a relative Location header. The browser resolves it
 * against the address it actually used (localhost, a LAN IP from a phone, the real domain), so
 * a dev server bound to 0.0.0.0 never sends anyone to http://0.0.0.0:3000.
 * Cookies set through `cookies()` in the same handler are still attached.
 */
export function redirectTo(path: string, status: 302 | 303 | 307 = 307) {
  const location = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return new NextResponse(null, { status, headers: { Location: location } });
}
