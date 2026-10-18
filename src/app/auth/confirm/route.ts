import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorMessage, safeNext } from "@/lib/auth-errors";
import { destinationAfterSignIn, markEmailProven, syncProviderVerification } from "@/lib/auth";

const OTP_TYPES = new Set<EmailOtpType>(["email", "magiclink", "signup", "recovery", "invite", "email_change"]);

/**
 * Landing route for every auth email and OAuth redirect.
 *  - ?token_hash=…&type=…  → verifyOtp. Works on any device (recommended email template).
 *  - ?code=…               → PKCE exchange. Needs the same browser that started sign-in.
 *  - neither               → tokens may be in the URL #fragment (implicit links), which only the
 *                            browser can read; hand off to /auth/finish (the fragment survives the redirect).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next") ?? (type === "recovery" ? "/auth/reset-password" : "/"));
  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`, url.origin));

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return fail(authErrorMessage(providerError));

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(authErrorMessage(error));
    // Clicking a link sent to the address proves the student owns it.
    await markEmailProven();
    return NextResponse.redirect(new URL(type === "recovery" ? "/auth/reset-password" : await destinationAfterSignIn(next), url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(authErrorMessage(error));
    await syncProviderVerification();
    return NextResponse.redirect(new URL(await destinationAfterSignIn(next), url.origin));
  }

  return NextResponse.redirect(new URL(`/auth/finish?next=${encodeURIComponent(next)}`, url.origin));
}
