import { createServerClient } from "@supabase/ssr";
import { redirectTo } from "@/lib/redirect";
import { maintenanceMode } from "@/lib/switches";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie on every request. Authorization happens in pages/actions, not here. */
export async function proxy(request: NextRequest) {
  // Emergency switch: everything except health checks shows a "back soon" page.
  if (maintenanceMode() && !/^\/(api\/health|\.well-known\/)/.test(request.nextUrl.pathname)) {
    return new NextResponse(MAINTENANCE_PAGE, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store" },
    });
  }

  // If Supabase falls back to the Site URL (e.g. a redirect URL missing from its allow-list),
  // the auth code lands on an ordinary page. Route it to the confirm handler instead of losing it.
  const { pathname, searchParams } = request.nextUrl;
  if (searchParams.has("code") && !pathname.startsWith("/auth/")) {
    return redirectTo(`/auth/confirm?code=${encodeURIComponent(searchParams.get("code")!)}&next=${encodeURIComponent(pathname)}`);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|s/|api/og|monitoring|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

const MAINTENANCE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Back soon · Got Next</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f3f0;color:#0f0f0e;font:16px/1.5 system-ui,sans-serif;padding:24px}@media(prefers-color-scheme:dark){body{background:#0e0e0d;color:#f2f2ee}}main{max-width:28rem}.dots{display:flex;gap:8px;margin-bottom:24px}.dots span{width:18px;height:18px;border-radius:50%;background:currentColor}.dots span:last-child{background:#cdf24a}h1{font-size:2.5rem;line-height:1;margin:0 0 12px;font-weight:900;letter-spacing:-.03em}p{margin:0;opacity:.75}</style></head>
<body><main><div class="dots"><span></span><span></span><span></span><span></span></div><h1>Back in a few minutes</h1><p>We're doing some work on Got Next. Your account and teams are safe. Please try again shortly.</p></main></body></html>`;
