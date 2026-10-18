/**
 * Email-based auth (magic links, codes, confirmation and reset emails) needs an SMTP sender in
 * Supabase. Until one is set up it stays off; set AUTH_EMAIL_ENABLED=1 to turn it back on
 * (see docs/AUTH_SETUP.md). Google and instant password sign-up work either way.
 */
export function emailAuthEnabled() {
  return process.env.AUTH_EMAIL_ENABLED === "1";
}
