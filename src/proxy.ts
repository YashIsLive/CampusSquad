import { createServerClient } from "@supabase/ssr";
import { redirectTo } from "@/lib/redirect";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie on every request. Authorization happens in pages/actions, not here. */
export async function proxy(request: NextRequest) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|s/|api/og|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
