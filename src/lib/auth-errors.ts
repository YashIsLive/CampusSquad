/** Only allow same-site relative redirects ("/x", never "//evil.com" or "https://…"). */
export function safeNext(next: string | null | undefined, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

type AuthLikeError = { message?: string; code?: string; status?: number };

/** Supabase auth errors → messages a student can act on. */
export function authErrorMessage(err: AuthLikeError | string | null | undefined): string {
  if (!err) return "Something went wrong. Please try again.";
  const code = typeof err === "string" ? err : (err.code ?? "");
  const msg = (typeof err === "string" ? err : (err.message ?? "")).toLowerCase();

  if (code === "over_email_send_rate_limit" || msg.includes("rate limit") || code === "over_request_rate_limit") {
    return "Too many emails were requested. Wait a minute and try again.";
  }
  if (code === "email_address_not_authorized" || msg.includes("not authorized")) {
    return "We can't send email to this address yet — the site's email sender isn't fully set up. Try again later or contact the organizers.";
  }
  if (code === "email_address_invalid" || msg.includes("email address") && msg.includes("invalid")) {
    return "That email address doesn't look deliverable. Check it for typos.";
  }
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "Wrong email or password.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the link, or use “Email me a link” instead.";
  }
  if (code === "user_already_exists" || msg.includes("already registered")) return "An account with this email already exists. Sign in instead.";
  if (code === "weak_password" || msg.includes("password should")) return "Pick a stronger password: at least 8 characters with letters and numbers.";
  if (code === "otp_expired" || msg.includes("expired")) return "That link or code has expired. Request a new one.";
  if (msg.includes("token has expired or is invalid") || code === "otp_invalid") return "That code isn't right, or it has expired.";
  if (msg.includes("code verifier") || msg.includes("pkce") || code === "bad_code_verifier") {
    return "That link only works in the browser you requested it from. Request a new link here, or use the code from the email.";
  }
  if (code === "provider_disabled" || msg.includes("provider is not enabled")) return "That sign-in method isn't turned on yet.";
  if (code === "signup_disabled" || msg.includes("signups not allowed")) return "New sign-ups are paused right now.";
  return typeof err === "string" ? err : (err.message ?? "Something went wrong. Please try again.");
}
